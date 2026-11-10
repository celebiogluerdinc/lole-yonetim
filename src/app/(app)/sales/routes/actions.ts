'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';

/**
 * F01 — GÜNLÜK ROTA VE ZİYARET PLANI
 *
 * Gün başında doldurulur. Formun en kıymetli tarafı plan ile gerçekleşenin
 * karşılaştırılabilmesi: kâğıtta "sonuç" sütunu serbest metindi ve sayılamıyordu;
 * burada her durak bir duruma bağlı, gün sonunda "planlanan 10 / gerçekleşen 7 /
 * ertelenen 3" otomatik çıkıyor.
 */

const uuid = z.string().uuid();

async function salesCtx() {
  const ctx = await getCtx();
  if (ctx.isCustomer) throw new Error('Bu bölüme erişiminiz yok.');
  return ctx;
}

/**
 * Günlük ziyaret hedefi: önce şehre özel kural, yoksa varsayılan.
 * F01 formundan geldi — İstanbul 5, diğer şehirler 10.
 */
async function resolveTarget(supabase: any, companyId: string, city: string | null): Promise<number> {
  const { data } = await supabase.from('sales_targets')
    .select('scope, scope_value, target_value')
    .eq('company_id', companyId)
    .eq('period', 'gunluk')
    .eq('metric', 'ziyaret')
    .in('scope', ['sehir', 'varsayilan']);

  const rows = data ?? [];
  if (city) {
    const hit = rows.find((r: any) =>
      r.scope === 'sehir' &&
      (r.scope_value ?? '').toLocaleLowerCase('tr-TR') === city.toLocaleLowerCase('tr-TR'));
    if (hit) return Math.round(Number(hit.target_value));
  }
  const def = rows.find((r: any) => r.scope === 'varsayilan');
  return def ? Math.round(Number(def.target_value)) : 10;
}

const isoDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

/**
 * Rotayı var say, yoksa aç.
 *
 * Gerekçe: temsilcinin "bu noktayı bugüne ekle" demesi için önce
 * "rota kur" formunu doldurmak zorunda kalması, tek tıkla yapılacak işi
 * iki ekrana bölüyordu. Plan yoksa burada sessizce açılıyor; şehir,
 * eklenen noktaların şehrinden tahmin ediliyor ki hedef doğru çıksın.
 */
async function ensureRoutePlan(
  supabase: any, userId: string, companyId: string, date: string, cityHint: string | null
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await supabase.from('route_plans')
    .select('id').eq('user_id', userId).eq('plan_date', date).maybeSingle();
  if (existing) return { id: existing.id as string };

  const target = await resolveTarget(supabase, companyId, cityHint);
  const { data, error } = await supabase.from('route_plans').insert({
    company_id: companyId,
    user_id: userId,
    plan_date: date,
    city: cityHint,
    target_visits: target
  }).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/**
 * Seçilen noktaları bir güne durak olarak ekler (varsayılan: bugün).
 *
 * "Bugün" ekranından ve takip listesinden tek dokunuşla çağrılıyor:
 * geciken bir takibi gördüğü anda temsilci onu rotasına atabiliyor,
 * aradaki "rota ekranına git, durak ekle, nokta ara" adımları kalktı.
 * Zaten rotada olan nokta ikinci kez eklenmez.
 */
export async function addOutletsToDay(outletIds: string[], date?: string) {
  const ids = (outletIds ?? []).filter(x => uuid.safeParse(x).success);
  if (!ids.length) return { error: 'Nokta seçilmedi.' };

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : isoDate(new Date());

  const { data: picked } = await supabase.from('outlets')
    .select('id, name, city').in('id', ids);
  const rows = picked ?? [];
  if (!rows.length) return { error: 'Nokta bulunamadı.' };

  const cityHint = rows.find((o: any) => o.city)?.city ?? null;
  const plan = await ensureRoutePlan(supabase, profile.id, companyId, day, cityHint);
  if ('error' in plan) return { error: plan.error };

  const { data: current } = await supabase.from('route_stops')
    .select('outlet_id, position').eq('route_plan_id', plan.id);
  const already = new Set((current ?? []).map((s: any) => s.outlet_id).filter(Boolean));
  const nextPos = (current ?? []).length;

  const fresh = rows.filter((o: any) => !already.has(o.id));
  if (!fresh.length) return { error: 'Seçilen noktalar bugünün rotasında zaten var.' };

  const { error } = await supabase.from('route_stops').insert(
    fresh.map((o: any, idx: number) => ({
      route_plan_id: plan.id,
      company_id: companyId,
      outlet_id: o.id,
      position: nextPos + idx
    }))
  );
  if (error) return { error: error.message };

  revalidatePath('/sales');
  revalidatePath('/sales/routes');
  revalidatePath('/sales/follow-ups');
  return { ok: true, added: fresh.length };
}

/**
 * Günü boş sayfadan başlatmamak için: sistem bugünü ÖNERİR.
 *
 * Sıra önemli — temsilcinin zamanı sınırlı, en pahalı iş en önce:
 *   1) geciken takiplerin noktaları (söz verilmiş, gecikmiş iş)
 *   2) bugün vadesi gelen takiplerin noktaları
 *   3) uzun süre ziyaret edilmemiş A, sonra B segment noktalar
 * Hedef sayısı kadar durak önerilir; temsilci sonra düzenler.
 */
export async function seedDayRoute(date?: string) {
  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : isoDate(new Date());
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();

  const [{ data: fups }, { data: neglected }] = await Promise.all([
    supabase.from('follow_ups')
      .select('outlet_id, due_date')
      .eq('owner_user_id', profile.id).eq('status', 'acik')
      .lte('due_date', day).not('outlet_id', 'is', null)
      .order('due_date').limit(40),
    supabase.from('outlets')
      .select('id, city, segment, last_visit_at')
      .eq('company_id', companyId).eq('is_active', true).in('segment', ['A', 'B'])
      .or(`last_visit_at.is.null,last_visit_at.lt.${since14}`)
      .order('last_visit_at', { ascending: true, nullsFirst: true })
      .limit(60)
  ]);

  const ordered: string[] = [];
  const push = (id: string | null) => {
    if (id && !ordered.includes(id)) ordered.push(id);
  };
  for (const f of fups ?? []) push(f.outlet_id);
  for (const o of (neglected ?? []).filter((x: any) => x.segment === 'A')) push(o.id);
  for (const o of (neglected ?? []).filter((x: any) => x.segment === 'B')) push(o.id);

  if (!ordered.length) {
    return { error: 'Önerilecek nokta bulunamadı — rotayı elle kurun.' };
  }

  const cityHint = (neglected ?? []).find((o: any) => o.city)?.city ?? null;
  const target = await resolveTarget(supabase, companyId, cityHint);

  const r = await addOutletsToDay(ordered.slice(0, target), day);
  if ('error' in r && r.error) return r;
  return { ok: true, added: (r as any).added as number };
}

/**
 * Durakları ilçeye göre yeniden sıralar.
 *
 * Şehirde gidip gelmek, saha temsilcisinin en büyük zaman kaybı. Rotayı
 * elle kurarken duraklar akla geldiği sırada giriliyor; bu tek düğme onları
 * ilçe ilçe toplar, ilçe içinde de saate göre sıralar. Gerçekleşmiş duraklar
 * listenin başında kalır — geçmişi karıştırmanın anlamı yok.
 */
export async function groupStopsByDistrict(planId: string) {
  if (!uuid.safeParse(planId).success) return { error: 'Geçersiz rota.' };
  const { supabase } = await salesCtx();

  const { data: stops, error } = await supabase.from('route_stops')
    .select('id, planned_time, position, status, district, outlets:outlet_id(district)')
    .eq('route_plan_id', planId);
  if (error) return { error: error.message };
  if (!stops || stops.length < 2) return { error: 'Sıralanacak yeterli durak yok.' };

  // İki kaynak: kayıtlı noktanın ilçesi ya da serbest durağın kendi ilçesi.
  // İlçesi yazılmamış durak en sona gitsin diye '￿' ile dolduruyoruz.
  const key = (s: any) =>
    (s.outlets?.district ?? s.district ?? '￿').toLocaleLowerCase('tr-TR');
  const sorted = [...stops].sort((a: any, b: any) => {
    // önce işi bitmiş duraklar, sonra bekleyenler
    const ad = a.status === 'planlandi' ? 1 : 0;
    const bd = b.status === 'planlandi' ? 1 : 0;
    if (ad !== bd) return ad - bd;
    const k = key(a).localeCompare(key(b), 'tr');
    if (k !== 0) return k;
    const at = a.planned_time ?? '99:99';
    const bt = b.planned_time ?? '99:99';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.position - b.position;
  });

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].position === i) continue;
    const { error: e } = await supabase.from('route_stops')
      .update({ position: i }).eq('id', sorted[i].id);
    if (e) return { error: e.message };
  }

  revalidatePath('/sales/routes');
  revalidatePath('/sales');
  return { ok: true };
}

export async function createRoutePlan(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const parsed = z.object({
    plan_date: z.string().min(10, 'Tarih zorunludur.'),
    city: z.string().max(80).optional().default(''),
    district: z.string().max(120).optional().default(''),
    vehicle: z.string().max(80).optional().default(''),
    team: z.string().max(80).optional().default('')
  }).safeParse({
    plan_date: s('plan_date'), city: s('city'), district: s('district'),
    vehicle: s('vehicle'), team: s('team')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // Aynı güne ikinci plan açılmasın — rota günde bir kurulur
  const { data: dupe } = await supabase.from('route_plans')
    .select('id').eq('user_id', profile.id).eq('plan_date', i.plan_date).maybeSingle();
  if (dupe) return { error: 'Bu güne ait rotanız zaten var.' };

  const target = await resolveTarget(supabase, companyId, i.city || null);

  const { data, error } = await supabase.from('route_plans').insert({
    company_id: companyId,
    user_id: profile.id,
    plan_date: i.plan_date,
    city: i.city || null,
    district: i.district || null,
    vehicle: i.vehicle || null,
    team: i.team || null,
    target_visits: target
  }).select('id').single();
  if (error) return { error: error.message };

  revalidatePath('/sales/routes');
  return { ok: true, id: data.id as string, target };
}

/**
 * Durak ekler. Kayıtlı nokta ZORUNLU DEĞİL.
 *
 * Rotanın amacı yalnız mevcut müşteriyi gezmek değil, yeni nokta bulmak.
 * Kartotekte olmayan bir yer ("sanayi sitesi karşısındaki kebapçı")
 * doğrudan adıyla yazılabiliyor; şehir ve ilçe durağın kendi
 * sütunlarında duruyor ki ilçeye göre sıralamaya girsin.
 */
export async function addRouteStop(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const planId = s('route_plan_id');
  if (!uuid.safeParse(planId).success) return { error: 'Geçersiz rota.' };

  const outletId = s('outlet_id');
  const label = s('outlet_label');
  if (!outletId && label.length < 2) {
    return { error: 'Durak adı yazın (kartotekte kayıtlı nokta seçmek zorunlu değil).' };
  }

  const { supabase, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // Serbest durak için konumu durağın kendisi taşıyor; rota planında
  // şehir varsa ve durakta yazılmadıysa oradan devralıyor.
  let city = s('city') || null;
  let district = s('district') || null;
  if (!outletId && !city) {
    const { data: p } = await supabase.from('route_plans')
      .select('city, district').eq('id', planId).maybeSingle();
    city = p?.city ?? null;
    if (!district) district = p?.district ?? null;
  }

  const { count } = await supabase.from('route_stops')
    .select('id', { count: 'exact', head: true }).eq('route_plan_id', planId);

  const { error } = await supabase.from('route_stops').insert({
    route_plan_id: planId,
    company_id: companyId,
    planned_time: s('planned_time') || null,
    outlet_id: outletId || null,
    outlet_label: outletId ? null : label,
    city: outletId ? null : city,
    district: outletId ? null : district,
    purpose: s('purpose') || null,
    contact_person: s('contact_person') || null,
    position: count ?? 0
  });
  if (error) return { error: error.message };

  revalidatePath('/sales/routes');
  revalidatePath('/sales');
  return { ok: true };
}

/**
 * Serbest durağı kartoteğe geçirir ve durağa bağlar.
 *
 * Gerekçe: ziyaret kaydı nokta istiyor. Potansiyel müşteriye gidilip
 * görüşüldüyse o yer artık bir aday noktadır; her gün yeniden elle
 * yazılması hem zaman kaybı hem de mükerrer kayıt üretir.
 *
 * Nokta "aday" statüsünde açılıyor; tip ve fatura bilgileri nokta
 * kartından tamamlanıyor — sahada durağı dönüştürmek tek tık olsun.
 */
export async function convertStopToOutlet(stopId: string) {
  if (!uuid.safeParse(stopId).success) return { error: 'Geçersiz durak.' };
  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: stop } = await supabase.from('route_stops')
    .select('id, outlet_id, outlet_label, city, district, contact_person')
    .eq('id', stopId).maybeSingle();
  if (!stop) return { error: 'Durak bulunamadı.' };
  if (stop.outlet_id) return { error: 'Bu durak zaten kayıtlı bir noktaya bağlı.' };

  const name = (stop.outlet_label ?? '').trim();
  if (name.length < 2) return { error: 'Durağın adı yazılmamış.' };

  // Aynı ilçede aynı adla nokta varsa yeni kayıt açmıyoruz, mevcuda bağlıyoruz —
  // mükerrer kartoteks en sinsi veri sorunu.
  const { data: dupe } = await supabase.from('outlets')
    .select('id, district').eq('company_id', companyId).ilike('name', name).limit(1).maybeSingle();

  let outletId: string;
  let reused = false;
  if (dupe && (dupe.district ?? '') === (stop.district ?? '')) {
    outletId = dupe.id as string;
    reused = true;
  } else {
    const { data: created, error } = await supabase.from('outlets').insert({
      company_id: companyId,
      name,
      city: stop.city || null,
      district: stop.district || null,
      status: 'aday',
      assigned_user_id: profile.id,
      created_by: profile.id
    }).select('id').single();
    if (error) return { error: error.message };
    outletId = created.id as string;
  }

  const { error: e2 } = await supabase.from('route_stops')
    .update({ outlet_id: outletId }).eq('id', stopId);
  if (e2) return { error: e2.message };

  revalidatePath('/sales/routes');
  revalidatePath('/sales/outlets');
  revalidatePath('/sales');
  return { ok: true as const, id: outletId, reused };
}

/** Durağın sonucunu işaretler. Ertelenen/iptal için neden zorunlu. */
export async function setRouteStopStatus(stopId: string, status: string, note?: string) {
  if (!uuid.safeParse(stopId).success) return { error: 'Geçersiz durak.' };
  const st = z.enum(['planlandi', 'gerceklesti', 'ertelendi', 'iptal']).safeParse(status);
  if (!st.success) return { error: 'Geçersiz durum.' };

  const trimmed = (note ?? '').trim();
  if ((st.data === 'ertelendi' || st.data === 'iptal') && trimmed.length < 3) {
    // Nedeni yazılmayan erteleme, rota raporunu işe yaramaz hale getirir.
    return { error: 'Erteleme ve iptal için neden yazılmalıdır.' };
  }

  const { supabase } = await salesCtx();
  const { error } = await supabase.from('route_stops')
    .update({ status: st.data, result_note: trimmed || null })
    .eq('id', stopId);
  if (error) return { error: error.message };

  revalidatePath('/sales/routes');
  return { ok: true };
}

export async function deleteRouteStop(stopId: string) {
  if (!uuid.safeParse(stopId).success) return { error: 'Geçersiz durak.' };
  const { supabase } = await salesCtx();
  const { error } = await supabase.from('route_stops')
    .delete().eq('id', stopId).eq('status', 'planlandi');
  if (error) return { error: error.message };
  revalidatePath('/sales/routes');
  return { ok: true };
}

/** Gün kapanışı: rota engeli / erteleme notu yazılır, plan kilitlenir. */
export async function closeRouteDay(formData: FormData) {
  const planId = String(formData.get('route_plan_id') ?? '');
  if (!uuid.safeParse(planId).success) return { error: 'Geçersiz rota.' };
  const note = String(formData.get('blocker_note') ?? '').trim().slice(0, 1000);

  const { supabase } = await salesCtx();

  const { count: pending } = await supabase.from('route_stops')
    .select('id', { count: 'exact', head: true })
    .eq('route_plan_id', planId).eq('status', 'planlandi');
  if ((pending ?? 0) > 0) {
    return { error: `${pending} durak hâlâ "planlandı" durumunda. Gerçekleşti, ertelendi veya iptal olarak işaretleyin.` };
  }

  const { error } = await supabase.from('route_plans')
    .update({ blocker_note: note || null, closed_at: new Date().toISOString() })
    .eq('id', planId);
  if (error) return { error: error.message };

  revalidatePath('/sales/routes');
  revalidatePath('/sales');
  return { ok: true };
}

export async function reopenRouteDay(planId: string) {
  if (!uuid.safeParse(planId).success) return { error: 'Geçersiz rota.' };
  const { supabase } = await salesCtx();
  const { error } = await supabase.from('route_plans')
    .update({ closed_at: null }).eq('id', planId);
  if (error) return { error: error.message };
  revalidatePath('/sales/routes');
  return { ok: true };
}
