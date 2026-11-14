'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { deleteBlock, deleteMessage, logDeletion } from '@/lib/sales-delete';

/**
 * SAHA SATIŞ — server action'ları (Faz 1)
 * Noktalar · F02 aday değerlendirmesi · F03 ziyaret · F04 tadım
 *
 * Yetki: veritabanı kuralları (RLS) asıl savunmadır. Buradaki kontroller
 * kullanıcıya anlamlı hata mesajı vermek ve yanlışlıkla yazmayı önlemek
 * içindir — tek başına güvenlik katmanı sayılmaz.
 */

const uuid = z.string().uuid();

/** Saha satış erişimi: admin, departman müdürü ya da satış departmanı üyesi. */
async function salesCtx() {
  const ctx = await getCtx();
  if (ctx.isCustomer) throw new Error('Bu bölüme erişiminiz yok.');
  return ctx;
}

/** Silme yetkisi: admin ve departman müdürü. Veritabanı da aynı kuralı uyguluyor. */
function canDelete(ctx: Awaited<ReturnType<typeof salesCtx>>): boolean {
  return ['super_admin', 'admin'].includes(ctx.profile.role)
    || ctx.managedDepartmentIds.length > 0;
}

// ============================================================
// NOKTALAR
// ============================================================

const outletSchema = z.object({
  name: z.string().min(2, 'Nokta adı en az 2 karakter olmalı.').max(200),
  type_id: uuid.nullable().optional(),
  city: z.string().max(80).optional().default(''),
  district: z.string().max(80).optional().default(''),
  address: z.string().max(400).optional().default(''),
  phone: z.string().max(40).optional().default(''),
  email: z.string().max(160).optional().default(''),
  legal_name: z.string().max(200).optional().default(''),
  tax_office: z.string().max(120).optional().default(''),
  tax_number: z.string().max(40).optional().default(''),
  current_supplier: z.string().max(160).optional().default(''),
  top_selling_drink: z.string().max(160).optional().default(''),
  preferred_contact_time: z.string().max(80).optional().default(''),
  chain_decision: z.enum(['sube_karar', 'merkez_karar', 'karma']).default('sube_karar'),
  status: z.enum(['aday', 'aktif', 'pasif', 'kaybedildi']).default('aday')
});

function readOutlet(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  return outletSchema.safeParse({
    name: s('name'),
    type_id: s('type_id') || null,
    city: s('city'),
    district: s('district'),
    address: s('address'),
    phone: s('phone'),
    email: s('email'),
    legal_name: s('legal_name'),
    tax_office: s('tax_office'),
    tax_number: s('tax_number'),
    current_supplier: s('current_supplier'),
    top_selling_drink: s('top_selling_drink'),
    preferred_contact_time: s('preferred_contact_time'),
    chain_decision: (s('chain_decision') || 'sube_karar') as any,
    status: (s('status') || 'aday') as any
  });
}

/**
 * Aylık potansiyel (KOLİ). Form bu alanı göndermiyorsa `undefined`
 * döner ve sütuna hiç dokunulmaz; boş gönderirse null yazılır.
 *
 * Bu sayı itiraz analizinin TL ağırlığını veriyor: "fiyat yüksek" diyen
 * on bakkal ile tek bir otel aynı kayıp değil.
 */
function readPotential(fd: FormData): { potential_monthly_volume: number | null } | {} {
  if (!fd.has('potential_monthly_cases')) return {};
  const raw = String(fd.get('potential_monthly_cases') ?? '').trim().replace(',', '.');
  if (!raw) return { potential_monthly_volume: null };
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? { potential_monthly_volume: Math.round(n * 100) / 100 } : {};
}

/**
 * Nokta formundaki muhasebe / satın alma kişilerini yazar.
 *
 * Bu iki kişi veritabanında outlet_contacts'ta duruyor ama saha açısından
 * firma bilgisinin parçası ve nokta kartındaki "eksik bilgi" uyarısının
 * kaynağı — bu yüzden nokta formuyla aynı gönderimde kaydediliyor.
 *
 * Rol başına tek kayıt tutuluyor: aynı rolde kayıt varsa güncellenir,
 * yoksa açılır. Ad boş bırakılırsa mevcut kayda dokunulmaz (kullanıcı
 * yalnızca vergi no eklemek için formu açmış olabilir).
 */
async function saveRoleContacts(
  supabase: any, companyId: string, outletId: string, fd: FormData
) {
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  const wanted: { role: 'muhasebe' | 'satin_alma'; prefix: string }[] = [
    { role: 'muhasebe', prefix: 'acct' },
    { role: 'satin_alma', prefix: 'purch' }
  ];

  // Form bu alanları hiç göndermiyorsa (eski sürüm ekran) sessiz geç.
  if (wanted.every(w => fd.get(`${w.prefix}_name`) === null)) return null;

  const { data: existing } = await supabase.from('outlet_contacts')
    .select('id, role').eq('outlet_id', outletId);

  for (const w of wanted) {
    const full_name = s(`${w.prefix}_name`);
    if (!full_name) continue;
    if (full_name.length < 2) return `${w.role === 'muhasebe' ? 'Muhasebe' : 'Satın alma'} kişisinin adı en az 2 karakter olmalı.`;

    const row = {
      full_name,
      phone: s(`${w.prefix}_phone`) || null,
      email: s(`${w.prefix}_email`) || null
    };
    const hit = (existing ?? []).find((c: any) => c.role === w.role);
    const { error } = hit
      ? await supabase.from('outlet_contacts').update(row).eq('id', hit.id)
      : await supabase.from('outlet_contacts').insert({
          company_id: companyId,            // NOT NULL
          outlet_id: outletId,
          role: w.role,
          ...row
          // decision_authority gönderilmiyor: NOT NULL + varsayılan 'yok'
        });
    if (error) return `Kişi kaydedilemedi: ${error.message}`;
  }
  return null;
}

/** Yeni nokta açar. Nokta kodu verilmezse şirket içinde sıradan üretilir. */
export async function createOutlet(formData: FormData) {
  const parsed = readOutlet(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // Aynı ilçede aynı adla nokta varsa uyar — mükerrer kartoteks en sinsi veri sorunudur
  const { data: dupe } = await supabase.from('outlets')
    .select('id, name, district')
    .eq('company_id', companyId)
    .ilike('name', i.name)
    .limit(1).maybeSingle();
  if (dupe && (dupe.district ?? '') === (i.district ?? '')) {
    // Mevcut kaydın kimliğini de döndürüyoruz: kullanıcı aynı noktayı
    // ikinci kez açmak yerine tek tıkla mevcut karta gidebilsin.
    return {
      error: `"${i.name}" adında bir nokta bu ilçede zaten var.`,
      existingId: dupe.id as string
    };
  }

  const { data, error } = await supabase.from('outlets').insert({
    company_id: companyId,
    name: i.name,
    type_id: i.type_id || null,
    city: i.city || null,
    district: i.district || null,
    address: i.address || null,
    phone: i.phone || null,
    email: i.email || null,
    legal_name: i.legal_name || null,
    tax_office: i.tax_office || null,
    tax_number: i.tax_number || null,
    current_supplier: i.current_supplier || null,
    top_selling_drink: i.top_selling_drink || null,
    preferred_contact_time: i.preferred_contact_time || null,
    chain_decision: i.chain_decision,
    status: i.status,
    ...readPotential(formData),
    assigned_user_id: profile.id,
    created_by: profile.id
  }).select('id').single();
  if (error) return { error: error.message };

  // Nokta açıldı; kişiler yazılamazsa noktayı geri almıyoruz — kart zaten
  // eksik bilgiyi gösterip aynı formdan tamamlatıyor.
  const cErr = await saveRoleContacts(supabase, companyId, data.id, formData);

  revalidatePath('/sales/outlets');
  return { ok: true, id: data.id as string, warn: cErr ?? undefined };
}

export async function updateOutlet(formData: FormData) {
  const id = String(formData.get('outlet_id') ?? '');
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz nokta.' };
  const parsed = readOutlet(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  const { error } = await supabase.from('outlets').update({
    name: i.name,
    type_id: i.type_id || null,
    city: i.city || null,
    district: i.district || null,
    address: i.address || null,
    phone: i.phone || null,
    email: i.email || null,
    legal_name: i.legal_name || null,
    tax_office: i.tax_office || null,
    tax_number: i.tax_number || null,
    current_supplier: i.current_supplier || null,
    top_selling_drink: i.top_selling_drink || null,
    preferred_contact_time: i.preferred_contact_time || null,
    chain_decision: i.chain_decision,
    status: i.status,
    ...readPotential(formData)
  }).eq('id', id);
  if (error) return { error: error.message };

  const cErr = await saveRoleContacts(supabase, companyId, id, formData);
  if (cErr) return { error: cErr };

  revalidatePath(`/sales/outlets/${id}`);
  revalidatePath('/sales/outlets');
  return { ok: true };
}

/**
 * Tahsilat ve vade riski — elle güncellenen iki sayı.
 *
 * Cari takip muhasebede; burada yalnızca temsilcinin kapıda bilmesi
 * gereken şey duruyor: açık bakiye ve gecikme günü. Nokta kartının
 * başında kırmızı şerit olarak görünüyor ("menüye giren ama ödemeyen
 * nokta zarardır").
 */
export async function updateOutletBalance(formData: FormData) {
  const id = String(formData.get('outlet_id') ?? '');
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz nokta.' };
  const num = (k: string) => {
    const raw = String(formData.get(k) ?? '').trim().replace(/\./g, '').replace(',', '.');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const balance = num('open_balance');
  const overdue = num('overdue_days');
  if (Number.isNaN(balance) || Number.isNaN(overdue)) {
    return { error: 'Bakiye ve gecikme günü sayı olmalı.' };
  }

  const { supabase } = await salesCtx();
  const { error } = await supabase.from('outlets').update({
    open_balance: balance,
    overdue_days: overdue === null ? null : Math.round(overdue),
    balance_note: String(formData.get('balance_note') ?? '').trim().slice(0, 300) || null,
    balance_updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/sales/outlets/${id}`);
  revalidatePath('/sales/outlets');
  return { ok: true as const };
}

const contactSchema = z.object({
  outlet_id: uuid,
  full_name: z.string().min(2, 'Ad soyad en az 2 karakter olmalı.').max(160),
  role: z.enum(['sahip', 'isletme_muduru', 'satin_alma', 'muhasebe', 'depo', 'sef', 'diger']),
  phone: z.string().max(40).optional().default(''),
  email: z.string().max(160).optional().default(''),
  decision_authority: z.enum(['karar_verir', 'etkiler', 'yok']).nullable().optional(),
  preferred_contact_time: z.string().max(80).optional().default(''),
  is_primary: z.boolean().default(false)
});

export async function addOutletContact(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const parsed = contactSchema.safeParse({
    outlet_id: s('outlet_id'),
    full_name: s('full_name'),
    role: (s('role') || 'diger') as any,
    phone: s('phone'),
    email: s('email'),
    decision_authority: (s('decision_authority') || null) as any,
    preferred_contact_time: s('preferred_contact_time'),
    is_primary: formData.get('is_primary') === 'on'
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  if (i.is_primary) {
    await supabase.from('outlet_contacts').update({ is_primary: false }).eq('outlet_id', i.outlet_id);
  }
  const { error } = await supabase.from('outlet_contacts').insert({
    company_id: companyId,                       // NOT NULL — eksikse kayıt reddedilir
    outlet_id: i.outlet_id,
    full_name: i.full_name,
    role: i.role,
    phone: i.phone || null,
    email: i.email || null,
    // decision_authority NOT NULL + varsayılan 'yok'.
    // Açıkça null geçmek varsayılanı DEVRE DIŞI bırakır ve kayıt reddedilir;
    // bu yüzden boşsa alanı hiç göndermiyoruz.
    ...(i.decision_authority ? { decision_authority: i.decision_authority } : {}),
    preferred_contact_time: i.preferred_contact_time || null,
    is_primary: i.is_primary
  });
  if (error) return { error: error.message };
  revalidatePath(`/sales/outlets/${i.outlet_id}`);
  return { ok: true };
}

/**
 * Noktayı siler; bağlı kaydı varsa PASİFE alır.
 *
 * Veritabanındaki `trg_outlet_delete_guard` bağlı kayıt varsa silmeyi
 * reddediyor (nokta CASCADE ile ziyaret/teklif/siparişe bağlı — korumasız
 * bir silme tüm ticari geçmişi sessizce götürürdü). O hatayı burada
 * yakalayıp pasife alıyoruz: nokta listelerden kalkıyor, geçmiş kalıyor.
 */
export async function deleteOutlet(outletId: string, reason?: string) {
  if (!uuid.safeParse(outletId).success) return { error: 'Geçersiz nokta.' };
  const ctx = await salesCtx();
  if (!canDelete(ctx)) return { error: 'Nokta silme yetkisi yalnızca admin ve müdürde.' };
  const { supabase, profile, companyId } = ctx;

  const { data: o } = await supabase.from('outlets')
    .select('id, name, status').eq('id', outletId).maybeSingle();
  if (!o) return { error: 'Nokta bulunamadı.' };

  const { error } = await supabase.from('outlets').delete().eq('id', outletId);

  if (error) {
    if (deleteBlock(error.message) === 'bagli_kayit') {
      const { error: e2 } = await supabase.from('outlets')
        .update({ status: 'pasif', is_active: false }).eq('id', outletId);
      if (e2) return { error: e2.message };
      await logDeletion(supabase, companyId, profile.id, 'outlet', outletId,
        `${o.name} (pasife alındı)`, reason);
      revalidatePath('/sales/outlets');
      revalidatePath(`/sales/outlets/${outletId}`);
      return { blocked: true as const, message: deleteMessage(error.message) };
    }
    return { error: deleteMessage(error.message) };
  }

  await logDeletion(supabase, companyId, profile.id, 'outlet', outletId, o.name, reason);
  revalidatePath('/sales/outlets');
  revalidatePath('/sales');
  return { ok: true as const };
}

/** Pasife alma / geri açma — silmeden listeden kaldırmanın yolu. */
export async function setOutletActive(outletId: string, active: boolean) {
  if (!uuid.safeParse(outletId).success) return { error: 'Geçersiz nokta.' };
  const ctx = await salesCtx();
  if (!canDelete(ctx)) return { error: 'Bu işlem için admin veya müdür olmalısınız.' };

  const { error } = await ctx.supabase.from('outlets').update(
    active ? { is_active: true, status: 'aday' } : { is_active: false, status: 'pasif' }
  ).eq('id', outletId);
  if (error) return { error: error.message };

  revalidatePath('/sales/outlets');
  revalidatePath(`/sales/outlets/${outletId}`);
  return { ok: true as const };
}

export async function deleteOutletContact(contactId: string) {
  if (!uuid.safeParse(contactId).success) return { error: 'Geçersiz kayıt.' };
  const { supabase } = await salesCtx();
  const { data: c } = await supabase.from('outlet_contacts')
    .select('outlet_id').eq('id', contactId).maybeSingle();
  const { error } = await supabase.from('outlet_contacts').delete().eq('id', contactId);
  if (error) return { error: error.message };
  if (c?.outlet_id) revalidatePath(`/sales/outlets/${c.outlet_id}`);
  return { ok: true };
}

/**
 * Nokta bazlı tedarik ayarları (F10 girdileri).
 * Güvenlik stoku GÜN olarak tutulur; şişe karşılığı o ürünün
 * günlük satışından hesaplanır — böylece nokta başına tek sayı yetiyor
 * ve çok satan ürün otomatik olarak daha yüksek stok alıyor.
 */
export async function updateSupplySettings(formData: FormData) {
  const schema = z.object({
    outlet_id: uuid,
    lead_days: z.coerce.number().int().min(0).max(60),
    safety_stock_days: z.coerce.number().int().min(0).max(60)
  });
  const parsed = schema.safeParse({
    outlet_id: String(formData.get('outlet_id') ?? ''),
    lead_days: String(formData.get('lead_days') ?? ''),
    safety_stock_days: String(formData.get('safety_stock_days') ?? '')
  });
  if (!parsed.success) return { error: 'Tedarik süresi ve güvenlik stoku 0–60 gün arasında olmalı.' };
  const i = parsed.data;

  const { supabase } = await salesCtx();
  const { error } = await supabase.from('outlets').update({
    lead_days: i.lead_days,
    safety_stock_days: i.safety_stock_days
  }).eq('id', i.outlet_id);
  if (error) return { error: error.message };

  revalidatePath(`/sales/outlets/${i.outlet_id}`);
  return { ok: true };
}

// ============================================================
// F02 — ADAY NOKTA DEĞERLENDİRMESİ
// ============================================================

/**
 * F02 kaydeder. Puanlar 0–2; "bilinmiyor" için satır NULL skorla yazılır
 * (hiç bakılmamış olmaktan farklıdır). Toplam ve A/B/C önceliğini
 * veritabanı trigger'ı hesaplar — burada hesaplanırsa iki ayrı doğru
 * ortaya çıkar ve hangisinin geçerli olduğu belirsizleşir.
 */
export async function saveAssessment(formData: FormData) {
  const outletId = String(formData.get('outlet_id') ?? '');
  if (!uuid.safeParse(outletId).success) return { error: 'Geçersiz nokta.' };
  const s = (k: string) => String(formData.get(k) ?? '').trim();

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: assessment, error } = await supabase.from('outlet_assessments').insert({
    company_id: companyId,
    outlet_id: outletId,
    visit_id: s('visit_id') || null,
    assessed_by: profile.id,
    contact_name: s('contact_name') || null,
    contact_role: s('contact_role') || null,
    contact_info: s('contact_info') || null,
    preferred_contact_time: s('preferred_contact_time') || null,
    customer_profile: s('customer_profile') || null,
    note: s('note') || null
  }).select('id').single();
  if (error) return { error: error.message };

  // kriter puanları: score_<criterionId> = '0' | '1' | '2' | '' (bilinmiyor)
  const { data: criteria } = await supabase.from('score_criteria')
    .select('id').eq('company_id', companyId).eq('form_code', 'F02').eq('is_active', true);

  const rows = (criteria ?? []).map((c: any) => {
    const raw = String(formData.get(`score_${c.id}`) ?? '').trim();
    const val = raw === '' ? null : Number(raw);
    return {
      assessment_id: assessment.id,
      criterion_id: c.id,
      score: val !== null && Number.isFinite(val) && val >= 0 && val <= 2 ? val : null,
      evidence: String(formData.get(`evidence_${c.id}`) ?? '').trim() || null
    };
  });
  if (rows.length) {
    const { error: e2 } = await supabase.from('outlet_assessment_scores').insert(rows);
    if (e2) return { error: e2.message };
  }

  revalidatePath(`/sales/outlets/${outletId}`);
  return { ok: true, id: assessment.id as string };
}

// ============================================================
// F03 + F04 — ZİYARET VE TADIM
// ============================================================

const visitSchema = z.object({
  outlet_id: uuid,
  visit_date: z.string().min(10),
  visit_type: z.enum(['ilk_ziyaret', 'rutin', 'tanitim_tadim', 'siparis', 'tahsilat', 'sikayet']),
  outcome: z.enum(['tadim_planlandi', 'teklif_istendi', 'siparis', 'takip', 'olumsuz']),
  met_person_name: z.string().max(160).optional().default(''),
  met_person_role: z.string().max(120).optional().default(''),
  met_decision_authority: z.enum(['karar_verir', 'etkiler', 'yok']).nullable().optional(),
  main_need: z.string().max(2000).optional().default(''),
  offered_solution: z.string().max(2000).optional().default(''),
  outlet_comment: z.string().max(2000).optional().default(''),
  objection_stated_id: uuid.nullable().optional(),
  objection_real_id: uuid.nullable().optional(),
  objection_note: z.string().max(1000).optional().default(''),
  our_answer: z.string().max(2000).optional().default(''),
  customer_comment: z.string().max(2000).optional().default(''),
  private_note: z.string().max(2000).optional().default(''),
  sales_order_id: uuid.nullable().optional(),
  client_uuid: uuid.nullable().optional(),
  submit: z.boolean().default(false)
});

/** Sonuca göre varsayılan takip: yazılmasa da söz kayda geçsin. */
const DEFAULT_FOLLOWUP: Record<string, { action: string; days: number }> = {
  takip: { action: 'Tekrar ziyaret', days: 7 },
  tadim_planlandi: { action: 'Tadım yap', days: 3 }
};

const plusDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Ziyaret kaydeder (taslak veya gönderilmiş).
 *
 * Kural: "olumsuz" sonucu için itiraz nedeni zorunlu. Serbest metin yerine
 * listeden seçim istiyoruz çünkü serbest metin raporlanamaz — ve bu modülün
 * en değerli çıktısı itiraz dağılımı.
 */
export async function saveVisit(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const parsed = visitSchema.safeParse({
    outlet_id: s('outlet_id'),
    visit_date: s('visit_date'),
    visit_type: (s('visit_type') || 'rutin') as any,
    outcome: (s('outcome') || 'takip') as any,
    met_person_name: s('met_person_name'),
    met_person_role: s('met_person_role'),
    met_decision_authority: (s('met_decision_authority') || null) as any,
    main_need: s('main_need'),
    offered_solution: s('offered_solution'),
    outlet_comment: s('outlet_comment'),
    objection_stated_id: s('objection_stated_id') || null,
    objection_real_id: s('objection_real_id') || null,
    objection_note: s('objection_note'),
    our_answer: s('our_answer'),
    customer_comment: s('customer_comment'),
    private_note: s('private_note'),
    sales_order_id: s('sales_order_id') || null,
    client_uuid: s('client_uuid') || null,
    submit: formData.get('submit') === '1'
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  if (i.outcome === 'olumsuz' && !i.objection_stated_id) {
    return { error: 'Olumsuz sonuç için itiraz nedeni seçilmelidir.' };
  }
  // Ziyaret "sipariş" ile kapanacaksa bağlı sipariş kaydı zorunlu.
  // Veritabanı da zorluyor; burada erken ve anlaşılır hata veriyoruz.
  if (i.outcome === 'siparis' && i.submit && !i.sales_order_id) {
    return { error: 'Sipariş sonucu için önce sipariş kaydı oluşturup ziyarete bağlayın.' };
  }

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  let visitId = s('visit_id');

  /* ÇEVRİMDIŞI TEKİLLEŞTİRME
     Form, şebeke yokken kuyruğa alınıp sonra yeniden gönderilebiliyor;
     ilk deneme sunucuya ulaşıp yanıtı kaybolmuş olabilir. Her form
     açılışında üretilen client_uuid aynı ziyaretin iki kez yazılmasını
     engelliyor: kayıt varsa güncelleme yoluna giriyoruz. */
  if (!uuid.safeParse(visitId).success && i.client_uuid) {
    const { data: prior } = await supabase.from('visits')
      .select('id').eq('client_uuid', i.client_uuid).eq('user_id', profile.id).maybeSingle();
    if (prior) visitId = prior.id as string;
  }

  // Ziyaret süresi: form açılış ve gönderim anı. Saat sırası bozuksa
  // (cihaz saati) süreyi hiç yazmıyoruz — yanlış süre, süre olmamasından kötü.
  const isoOrNull = (k: string) => {
    const v = s(k);
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };
  let startedAt = isoOrNull('started_at');
  let endedAt = isoOrNull('ended_at');
  if (startedAt && endedAt && endedAt < startedAt) { startedAt = null; endedAt = null; }

  const payload = {
    company_id: companyId,
    outlet_id: i.outlet_id,
    user_id: profile.id,
    visit_date: i.visit_date,
    visit_type: i.visit_type,
    outcome: i.outcome,
    met_person_name: i.met_person_name || null,
    met_person_role: i.met_person_role || null,
    met_decision_authority: i.met_decision_authority || null,
    main_need: i.main_need || null,
    offered_solution: i.offered_solution || null,
    outlet_comment: i.outlet_comment || null,
    objection_stated_id: i.objection_stated_id || null,
    objection_real_id: i.objection_real_id || null,
    objection_stated_note: i.objection_note || null,
    our_answer: i.our_answer || null,
    customer_comment: i.customer_comment || null,
    private_note: i.private_note || null,
    sales_order_id: i.sales_order_id || null,
    ...(i.client_uuid ? { client_uuid: i.client_uuid } : {}),
    ...(startedAt ? { started_at: startedAt } : {}),
    ...(endedAt ? { ended_at: endedAt } : {}),
    status: i.submit ? 'gonderildi' : 'taslak'
  };

  const isUpdate = uuid.safeParse(visitId).success;
  let id = visitId;
  if (isUpdate) {
    const { error } = await supabase.from('visits').update(payload).eq('id', visitId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from('visits').insert(payload).select('id').single();
    if (error) return { error: error.message };
    id = data.id;
  }

  // --- Puanlar (F03, 1–5) ---
  const { data: criteria } = await supabase.from('score_criteria')
    .select('id, weight').eq('company_id', companyId)
    .eq('form_code', 'F03').eq('is_active', true);

  const scoreRows = (criteria ?? [])
    .map((c: any) => {
      const raw = String(formData.get(`score_${c.id}`) ?? '').trim();
      const val = Number(raw);
      if (!raw || !Number.isFinite(val) || val < 1 || val > 5) return null;
      return {
        visit_id: id,
        criterion_id: c.id,
        score: val,
        weight_snapshot: c.weight,     // ağırlık anlık görüntüsü: kriter sonradan
        evidence: String(formData.get(`evidence_${c.id}`) ?? '').trim() || null
      };                               // değişse de geçmiş skor değişmez
    })
    .filter(Boolean) as any[];

  // Güncellemede önce eski puanlar silinir: kullanıcı tüm puanları
  // temizlediyse eski değerler kalmamalı. Silme hatası yutulmaz —
  // yutulursa ekleme çift kayıt üretir.
  if (isUpdate || scoreRows.length) {
    const { error: eDel } = await supabase.from('visit_scores').delete().eq('visit_id', id);
    if (eDel) return { error: `Puanlar güncellenemedi: ${eDel.message}` };
  }
  if (scoreRows.length) {
    const { error } = await supabase.from('visit_scores').insert(scoreRows);
    if (error) return { error: `Puanlar kaydedilemedi: ${error.message}` };
  }

  // --- Tadım (F04) ---
  const tastedIds = formData.getAll('tasted').map(String).filter(Boolean);
  if (isUpdate || tastedIds.length) {
    const { error: eDel } = await supabase.from('visit_tastings').delete().eq('visit_id', id);
    if (eDel) return { error: `Tadım güncellenemedi: ${eDel.message}` };
  }
  if (tastedIds.length) {
    const rows = tastedIds.map(pid => {
      const n = (k: string) => {
        const v = Number(String(formData.get(`${k}_${pid}`) ?? '').trim());
        return Number.isFinite(v) && v > 0 ? v : null;
      };
      return {
        visit_id: id,
        company_id: companyId,
        product_id: pid,
        bottles_opened: Number(formData.get(`opened_${pid}`) ?? 0) || 0,
        bottles_left_sealed: Number(formData.get(`sealed_${pid}`) ?? 0) || 0,
        taste_score: n('taste'),
        packaging_score: n('pack'),
        price_perception: n('price'),
        // müşterinin birebir sözü — ASLA özetlenmez, raporda alıntı olarak çıkar
        customer_verbatim: String(formData.get(`verbatim_${pid}`) ?? '').trim() || null,
        verdict: String(formData.get(`verdict_${pid}`) ?? '') || null
      };
    });
    const { error } = await supabase.from('visit_tastings').insert(rows);
    if (error) return { error: `Tadım kaydedilemedi: ${error.message}` };

    const preferred = s('preferred_product_id');
    const { error: eSum } = await supabase.from('visit_tasting_summary').upsert({
      visit_id: id,
      company_id: companyId,
      preferred_product_id: preferred || null,
      preference_reason: s('preference_reason') || null,
      menu_match: s('menu_match') || null,
      sample_purpose: s('sample_purpose') || null,
      delivery_confirmed: formData.get('delivery_confirmed') === 'on',
      unused_disposition: s('unused_disposition') || null,
      received_by: s('received_by') || null,
      sample_approval_no: s('sample_approval_no') || null
    }, { onConflict: 'visit_id' });
    if (eSum) return { error: `Tadım özeti kaydedilemedi: ${eSum.message}` };
  }

  // --- Takip (tüm formların ortak "Sonraki adım" bloğu) ---
  /* TAKİP
     Denetim bulgusu: sonuç "takip" seçilip takip yazılmadan kaydedilen
     ziyaret, geciken-takip motorunu boş bırakıyordu. Artık söz kayda
     geçmeden ziyaret kapanmıyor: iş yazılmadıysa sonuca göre varsayılan
     iş, tarih yazılmadıysa varsayılan vade kullanılıyor. Kapalı bir
     bölümdeki alan için hata mesajı göstermek yerine makul varsayılan. */
  let action = s('followup_action');
  let due = s('followup_due');
  const def = DEFAULT_FOLLOWUP[i.outcome];
  // Bu ziyaretin mevcut takipleri: yeniden gönderimde (çevrimdışı kuyruk,
  // taslaktan gönderme) aynı takip ikinci kez açılmasın.
  const { data: priorFups } = isUpdate
    ? await supabase.from('follow_ups')
        .select('id, action').eq('source_type', 'visit').eq('source_id', id)
    : { data: [] as any[] };
  if (i.submit && !action && def && !(priorFups ?? []).length) action = def.action;
  if (action && (priorFups ?? []).some((f: any) => f.action === action)) action = '';
  if (action) {
    if (!due) due = plusDays(i.visit_date, def?.days ?? 7);
    const owner = s('followup_owner') || profile.id;
    const { error } = await supabase.from('follow_ups').insert({
      company_id: companyId,
      source_type: 'visit',
      source_id: id,
      outlet_id: i.outlet_id,
      action,
      owner_user_id: owner,
      due_date: due,
      created_by: profile.id
    });
    if (error) return { error: `Takip kaydedilemedi: ${error.message}` };
  }

  revalidatePath('/sales/visits');
  revalidatePath(`/sales/outlets/${i.outlet_id}`);
  revalidatePath('/sales');
  return { ok: true, id };
}

/**
 * Ziyareti siler.
 *
 * Temsilci yalnızca KENDİ TASLAĞINI silebilir: gönderilmiş ziyaret artık
 * veri tarihidir, puan ortalamasını ve itiraz dağılımını besliyor.
 * Gönderilmiş kaydı admin ve müdür silebilir — yanlış noktaya girilen
 * ziyaret tek tek düzeltilebilsin diye.
 */
export async function deleteVisit(visitId: string, reason?: string) {
  if (!uuid.safeParse(visitId).success) return { error: 'Geçersiz ziyaret.' };
  const ctx = await salesCtx();
  const { supabase, profile, companyId } = ctx;

  const { data: v } = await supabase.from('visits')
    .select('id, user_id, status, outlet_id, visit_date, outlets:outlet_id(name)')
    .eq('id', visitId).maybeSingle();
  if (!v) return { error: 'Ziyaret bulunamadı.' };

  const own = v.user_id === profile.id && v.status === 'taslak';
  if (!own && !canDelete(ctx)) {
    return { error: 'Gönderilmiş ziyareti yalnızca admin veya müdür silebilir.' };
  }

  const { error } = await supabase.from('visits').delete().eq('id', visitId);
  if (error) return { error: deleteMessage(error.message) };

  await logDeletion(supabase, companyId, profile.id, 'visit', visitId,
    `${(v as any).outlets?.name ?? 'Nokta'} · ${v.visit_date}`, reason);
  revalidatePath('/sales/visits');
  revalidatePath(`/sales/outlets/${v.outlet_id}`);
  revalidatePath('/sales');
  return { ok: true as const };
}

/** Takibi siler. Yanlış açılan takip gün boyu kırmızı rozet gösteriyordu. */
export async function deleteFollowUp(id: string, reason?: string) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz takip.' };
  const ctx = await salesCtx();
  const { supabase, profile, companyId } = ctx;

  const { data: f } = await supabase.from('follow_ups')
    .select('id, action, created_by, outlet_id').eq('id', id).maybeSingle();
  if (!f) return { error: 'Takip bulunamadı.' };
  if (f.created_by !== profile.id && !canDelete(ctx)) {
    return { error: 'Başkasının açtığı takibi yalnızca admin veya müdür silebilir.' };
  }

  const { error } = await supabase.from('follow_ups').delete().eq('id', id);
  if (error) return { error: deleteMessage(error.message) };

  await logDeletion(supabase, companyId, profile.id, 'follow_up', id, f.action ?? '—', reason);
  revalidatePath('/sales/follow-ups');
  revalidatePath('/sales');
  return { ok: true as const };
}

// ============================================================
// TAKİPLER
// ============================================================

/**
 * Takibi kapatır. Kanıt zorunlu; sonuç ve (kaybedildiyse) sebep isteğe bağlı.
 *
 * Sonuç alanı neden var: kayıp sebebi eskiden yalnızca ziyaret anında
 * yazılabiliyordu. Ziyaret "takip" çıkıp haftalar sonra kaybedilen nokta
 * hiçbir sebebe bağlanmıyordu — itiraz analizinin en büyük kör noktası.
 */
export async function closeFollowUp(
  id: string, evidence: string,
  result?: 'kazanildi' | 'kaybedildi' | 'devam' | null,
  lostReasonId?: string | null
) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz takip.' };
  const ev = z.string().min(3, 'Kapanış kanıtı en az 3 karakter olmalı.').max(1000)
    .safeParse(evidence.trim());
  // Kanıtsız kapanış, kapanmamış takiple aynı şeydir — bu yüzden zorunlu.
  if (!ev.success) return { error: ev.error.issues[0].message };

  const res = result && ['kazanildi', 'kaybedildi', 'devam'].includes(result) ? result : null;
  const reason = res === 'kaybedildi' && lostReasonId && uuid.safeParse(lostReasonId).success
    ? lostReasonId : null;

  const { supabase, profile } = await salesCtx();
  const { error } = await supabase.from('follow_ups').update({
    status: 'kapandi',
    closure_evidence: ev.data,
    verifier_user_id: profile.id,
    verified_at: new Date().toISOString(),
    result: res,
    lost_reason_id: reason
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/sales/follow-ups');
  revalidatePath('/sales');
  return { ok: true as const };
}

// ============================================================
// ZİYARET FOTOĞRAFLARI (raf / teşhir)
// ============================================================

const MAX_VISIT_PHOTOS = 8;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

/**
 * Ziyarete raf/teşhir fotoğrafı ekler.
 *
 * Depolama yolu `<şirket>/visits/<ziyaret>/<dosya>` — veritabanındaki
 * `vphoto_path_guard` politikası bu biçimi zorluyor. Olay kaydı
 * fotoğraflarıyla aynı desen: önce hepsini denetle, sonra yükle; satır
 * yazılamazsa dosyayı da bırakma.
 */
export async function uploadVisitPhotos(formData: FormData) {
  const visitId = String(formData.get('visit_id') ?? '');
  if (!uuid.safeParse(visitId).success) return { error: 'Geçersiz ziyaret.' };
  const kindRaw = String(formData.get('kind') ?? 'raf');
  const kind = ['raf', 'dolap', 'teshir', 'tadim', 'diger'].includes(kindRaw) ? kindRaw : 'raf';
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: 'Fotoğraf seçilmedi.' };

  const { supabase, profile } = await salesCtx();
  const { data: v } = await supabase.from('visits')
    .select('id, company_id, outlet_id').eq('id', visitId).maybeSingle();
  if (!v) return { error: 'Ziyaret bulunamadı.' };

  const { count } = await supabase.from('visit_photos')
    .select('id', { count: 'exact', head: true }).eq('visit_id', visitId);
  if ((count ?? 0) + files.length > MAX_VISIT_PHOTOS) {
    return { error: `Bir ziyarete en fazla ${MAX_VISIT_PHOTOS} fotoğraf eklenebilir.` };
  }

  const ok: { file: File; ext: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) return { error: `"${file.name}" 10MB sınırını aşıyor.` };
    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    if (file.type ? !IMG_TYPES.has(file.type) : !IMG_EXT.has(ext)) {
      return { error: `"${file.name}" bir fotoğraf değil.` };
    }
    ok.push({ file, ext });
  }

  let added = 0;
  for (const { file, ext } of ok) {
    const path = `${v.company_id}/visits/${visitId}/${crypto.randomUUID()}.${ext || 'jpg'}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from('attachments')
      .upload(path, buf, { contentType: file.type || 'image/jpeg' });
    if (upErr) return { error: `Yükleme başarısız: ${upErr.message}`, added };

    const { error: rowErr } = await supabase.from('visit_photos').insert({
      visit_id: visitId,
      company_id: v.company_id,
      uploaded_by: profile.id,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type || null,
      kind
    });
    if (rowErr) {
      await supabase.storage.from('attachments').remove([path]);
      return { error: `Fotoğraf kaydedilemedi: ${rowErr.message}`, added };
    }
    added++;
  }

  revalidatePath(`/sales/visits/${visitId}`);
  revalidatePath(`/sales/outlets/${v.outlet_id}`);
  return { ok: true as const, added };
}
