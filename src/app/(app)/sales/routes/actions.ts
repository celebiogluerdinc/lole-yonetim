'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

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

export async function addRouteStop(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const planId = s('route_plan_id');
  if (!uuid.safeParse(planId).success) return { error: 'Geçersiz rota.' };

  const outletId = s('outlet_id');
  const label = s('outlet_label');
  if (!outletId && !label) return { error: 'Nokta seçin veya adını yazın.' };

  const { supabase, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { count } = await supabase.from('route_stops')
    .select('id', { count: 'exact', head: true }).eq('route_plan_id', planId);

  const { error } = await supabase.from('route_stops').insert({
    route_plan_id: planId,
    company_id: companyId,
    planned_time: s('planned_time') || null,
    outlet_id: outletId || null,
    outlet_label: outletId ? null : label,
    purpose: s('purpose') || null,
    contact_person: s('contact_person') || null,
    position: count ?? 0
  });
  if (error) return { error: error.message };

  revalidatePath('/sales/routes');
  return { ok: true };
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
