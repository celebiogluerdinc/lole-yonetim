'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

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
    return { error: `"${i.name}" adında bir nokta bu ilçede zaten var. Mevcut kaydı kullanın.` };
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
    assigned_user_id: profile.id,
    created_by: profile.id
  }).select('id').single();
  if (error) return { error: error.message };

  revalidatePath('/sales/outlets');
  return { ok: true, id: data.id as string };
}

export async function updateOutlet(formData: FormData) {
  const id = String(formData.get('outlet_id') ?? '');
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz nokta.' };
  const parsed = readOutlet(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase } = await salesCtx();
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
    status: i.status
  }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/sales/outlets/${id}`);
  revalidatePath('/sales/outlets');
  return { ok: true };
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
  submit: z.boolean().default(false)
});

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

  const visitId = s('visit_id');
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
    objection_note: i.objection_note || null,
    our_answer: i.our_answer || null,
    customer_comment: i.customer_comment || null,
    private_note: i.private_note || null,
    sales_order_id: i.sales_order_id || null,
    status: i.submit ? 'gonderildi' : 'taslak'
  };

  let id = visitId;
  if (uuid.safeParse(visitId).success) {
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

  if (scoreRows.length) {
    await supabase.from('visit_scores').delete().eq('visit_id', id);
    const { error } = await supabase.from('visit_scores').insert(scoreRows);
    if (error) return { error: `Puanlar kaydedilemedi: ${error.message}` };
  }

  // --- Tadım (F04) ---
  const tastedIds = formData.getAll('tasted').map(String).filter(Boolean);
  if (tastedIds.length) {
    await supabase.from('visit_tastings').delete().eq('visit_id', id);
    const rows = tastedIds.map(pid => {
      const n = (k: string) => {
        const v = Number(String(formData.get(`${k}_${pid}`) ?? '').trim());
        return Number.isFinite(v) && v > 0 ? v : null;
      };
      return {
        visit_id: id,
        company_id: companyId,
        product_id: pid,
        batch_id: String(formData.get(`batch_${pid}`) ?? '') || null,
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
  const action = s('followup_action');
  if (action) {
    const due = s('followup_due');
    if (!due) return { error: 'Takip için son tarih zorunludur.' };
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

/** Taslak ziyareti siler (yalnızca sahibi, yalnızca taslakken). */
export async function deleteVisit(visitId: string) {
  if (!uuid.safeParse(visitId).success) return { error: 'Geçersiz ziyaret.' };
  const { supabase, profile } = await salesCtx();
  const { data: v } = await supabase.from('visits')
    .select('id, user_id, status, outlet_id').eq('id', visitId).maybeSingle();
  if (!v) return { error: 'Ziyaret bulunamadı.' };
  if (v.user_id !== profile.id || v.status !== 'taslak') {
    return { error: 'Yalnızca kendi taslak ziyaretinizi silebilirsiniz.' };
  }
  const { error } = await supabase.from('visits').delete().eq('id', visitId);
  if (error) return { error: error.message };
  revalidatePath('/sales/visits');
  return { ok: true };
}

// ============================================================
// TAKİPLER
// ============================================================

export async function closeFollowUp(id: string, evidence: string) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz takip.' };
  const ev = z.string().min(3, 'Kapanış kanıtı en az 3 karakter olmalı.').max(1000)
    .safeParse(evidence.trim());
  // Kanıtsız kapanış, kapanmamış takiple aynı şeydir — bu yüzden zorunlu.
  if (!ev.success) return { error: ev.error.issues[0].message };

  const { supabase, profile } = await salesCtx();
  const { error } = await supabase.from('follow_ups').update({
    status: 'kapandi',
    closure_evidence: ev.data,
    verifier_user_id: profile.id,
    verified_at: new Date().toISOString()
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/sales/follow-ups');
  revalidatePath('/sales');
  return { ok: true };
}
