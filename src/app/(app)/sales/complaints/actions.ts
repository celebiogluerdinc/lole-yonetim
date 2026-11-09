'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { deleteMessage, logDeletion } from '@/lib/sales-delete';

/**
 * F11 Hasar/şikâyet · F10 Takip ve tekrar sipariş
 *
 * Ürün güvenliği kuralları veritabanında zorlanıyor (trigger):
 *   • karantinaya alınmadan "çözüldü" yapılamaz
 *   • açık güvenlik şikâyeti olan parti tadıma kapanır
 * Buradaki kontroller kullanıcıya önceden anlamlı uyarı vermek için.
 */

const uuid = z.string().uuid();

async function salesCtx() {
  const ctx = await getCtx();
  if (ctx.isCustomer) throw new Error('Bu bölüme erişiminiz yok.');
  return ctx;
}

// ============================================================
// F11 — ŞİKÂYET
// ============================================================

const complaintSchema = z.object({
  outlet_id: uuid,
  category: z.enum(['teslimat_hasari', 'tat_beklentisi', 'hizmet', 'urun_guvenligi', 'diger']),
  event_description: z.string().min(5, 'Olay açıklaması en az 5 karakter olmalı.').max(2000),
  product_id: uuid.nullable().optional(),
  batch_id: uuid.nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(0).nullable().optional(),
  shipment_doc_no: z.string().max(80).optional().default(''),
  notified_person: z.string().max(160).optional().default(''),
  quarantined: z.boolean().default(false),
  quarantined_qty: z.coerce.number().int().min(0).nullable().optional()
});

export async function createComplaint(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const n = (k: string) => { const v = s(k); return v === '' ? null : Number(v); };

  const parsed = complaintSchema.safeParse({
    outlet_id: s('outlet_id'),
    category: (s('category') || 'diger') as any,
    event_description: s('event_description'),
    product_id: s('product_id') || null,
    batch_id: s('batch_id') || null,
    expiry_date: s('expiry_date') || null,
    quantity: n('quantity'),
    shipment_doc_no: s('shipment_doc_no'),
    notified_person: s('notified_person'),
    quarantined: formData.get('quarantined') === 'on',
    quarantined_qty: n('quarantined_qty')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  // Ürün güvenliği şüphesinde ürün satıştan ayrılmalı. Veritabanı da
  // engelliyor ama kullanıcıyı formu göndermeden uyarmak daha iyi.
  if (i.category === 'urun_guvenligi') {
    if (!i.product_id) return { error: 'Ürün güvenliği şikâyetinde ürün seçilmelidir.' };
    if (i.quarantined && !i.quarantined_qty) {
      return { error: 'Karantinaya alınan adet girilmelidir.' };
    }
  }

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data, error } = await supabase.from('outlet_complaints').insert({
    company_id: companyId,
    outlet_id: i.outlet_id,
    reported_by: profile.id,
    category: i.category,
    product_id: i.product_id || null,
    batch_id: i.batch_id || null,
    expiry_date: i.expiry_date || null,
    quantity: i.quantity ?? null,
    shipment_doc_no: i.shipment_doc_no || null,
    event_description: i.event_description,
    event_at: new Date().toISOString(),
    quarantined: i.quarantined,
    quarantined_qty: i.quarantined ? (i.quarantined_qty ?? null) : null,
    notified_person: i.notified_person || null,
    notified_at: i.notified_person ? new Date().toISOString() : null,
    status: 'acik'
  }).select('id').single();
  if (error) return { error: error.message };

  revalidatePath('/sales/complaints');
  return { ok: true, id: data.id as string };
}

const resolveSchema = z.object({
  complaint_id: uuid,
  status: z.enum(['acik', 'incelemede', 'cozuldu', 'reddedildi']),
  investigation_result: z.string().max(2000).optional().default(''),
  resolution_doc_no: z.string().max(80).optional().default(''),
  quarantined: z.boolean().default(false),
  quarantined_qty: z.coerce.number().int().min(0).nullable().optional(),
  outlet_confirmed: z.boolean().default(false)
});

export async function updateComplaint(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const parsed = resolveSchema.safeParse({
    complaint_id: s('complaint_id'),
    status: (s('status') || 'acik') as any,
    investigation_result: s('investigation_result'),
    resolution_doc_no: s('resolution_doc_no'),
    quarantined: formData.get('quarantined') === 'on',
    quarantined_qty: s('quarantined_qty') === '' ? null : Number(s('quarantined_qty')),
    outlet_confirmed: formData.get('outlet_confirmed') === 'on'
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase } = await salesCtx();
  const { data: current } = await supabase.from('outlet_complaints')
    .select('category').eq('id', i.complaint_id).maybeSingle();
  if (!current) return { error: 'Şikâyet bulunamadı.' };

  if (current.category === 'urun_guvenligi' && i.status === 'cozuldu' && !i.quarantined) {
    return { error: 'Ürün güvenliği şikâyeti, ürün satıştan ayrılmadan çözüldü olarak kapatılamaz.' };
  }
  if (i.quarantined && !i.quarantined_qty) {
    return { error: 'Karantinaya alınan adet girilmelidir.' };
  }

  const { error } = await supabase.from('outlet_complaints').update({
    status: i.status,
    investigation_result: i.investigation_result || null,
    resolution_doc_no: i.resolution_doc_no || null,
    quarantined: i.quarantined,
    quarantined_qty: i.quarantined ? (i.quarantined_qty ?? null) : null,
    outlet_confirmed: i.outlet_confirmed,
    resolved_at: i.status === 'cozuldu' ? new Date().toISOString() : null
  }).eq('id', i.complaint_id);
  if (error) return { error: error.message };

  revalidatePath('/sales/complaints');
  return { ok: true };
}

// ============================================================
// F10 — TEKRAR SİPARİŞ PLANI
// ============================================================

/**
 * Noktanın tedarik ayarlarına göre öneri hesaplar.
 * Formül veritabanındaki fn_reorder_suggestion'da duruyor; burada
 * tekrar yazılsaydı iki ayrı doğru olur ve biri sessizce eskirdi.
 */
/**
 * Şikâyet kaydını siler (admin / departman müdürü).
 * Yanlış noktaya veya iki kez girilen şikâyet ürün güvenliği
 * uyarılarını ve karantina sayısını yanlış gösteriyordu.
 */
export async function deleteComplaint(id: string, reason?: string) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz kayıt.' };
  const ctx = await salesCtx();
  const isManager = ['super_admin', 'admin'].includes(ctx.profile.role)
    || ctx.managedDepartmentIds.length > 0;
  if (!isManager) return { error: 'Şikâyet silme yetkisi yalnızca admin ve müdürde.' };

  const { supabase, profile, companyId } = ctx;
  const { data: c } = await supabase.from('outlet_complaints')
    .select('id, event_description, outlets:outlet_id(name)').eq('id', id).maybeSingle();
  if (!c) return { error: 'Şikâyet bulunamadı.' };

  const { error } = await supabase.from('outlet_complaints').delete().eq('id', id);
  if (error) return { error: deleteMessage(error.message) };

  await logDeletion(supabase, companyId, profile.id, 'complaint', id,
    `${(c as any).outlets?.name ?? 'Nokta'} · ${(c.event_description ?? '').slice(0, 60)}`, reason);
  revalidatePath('/sales/complaints');
  return { ok: true as const };
}

export async function reorderSuggestion(
  outletId: string, dailySales: number, currentStock: number, nextCheckDays: number
) {
  if (!uuid.safeParse(outletId).success) return { error: 'Geçersiz nokta.' };
  const { supabase } = await salesCtx();
  const { data, error } = await supabase.rpc('fn_reorder_suggestion', {
    oid: outletId,
    daily_sales: dailySales,
    current_stock: currentStock,
    next_check_days: nextCheckDays
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    lead_days: row?.lead_days ?? 2,
    safety_stock: row?.safety_stock ?? 0,
    suggested_bottles: row?.suggested_bottles ?? 0,
    suggested_cases: row?.suggested_cases ?? 0
  };
}

export async function createReorderPlan(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const schema = z.object({
    outlet_id: uuid,
    checkpoint: z.enum(['48_72_saat', '7_gun', '14_gun', 'rutin']),
    next_check_days: z.coerce.number().int().min(1).max(120),
    first_order_date: z.string().nullable().optional(),
    data_period: z.string().max(120).optional().default(''),
    collection_status: z.string().max(120).optional().default(''),
    collection_doc_no: z.string().max(80).optional().default(''),
    slow_product_reason: z.string().max(1000).optional().default(''),
    single_improvement: z.string().max(1000).optional().default('')
  });
  const parsed = schema.safeParse({
    outlet_id: s('outlet_id'),
    checkpoint: (s('checkpoint') || 'rutin') as any,
    next_check_days: s('next_check_days') || '7',
    first_order_date: s('first_order_date') || null,
    data_period: s('data_period'),
    collection_status: s('collection_status'),
    collection_doc_no: s('collection_doc_no'),
    slow_product_reason: s('slow_product_reason'),
    single_improvement: s('single_improvement')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // Noktanın tedarik ayarları — satırlara varsayılan olarak işlenir
  const { data: outlet } = await supabase.from('outlets')
    .select('lead_days, safety_stock_days').eq('id', i.outlet_id).maybeSingle();
  const leadDays = outlet?.lead_days ?? 2;
  const safetyDays = outlet?.safety_stock_days ?? 3;

  const { data: plan, error } = await supabase.from('reorder_plans').insert({
    company_id: companyId,
    outlet_id: i.outlet_id,
    created_by: profile.id,
    checkpoint: i.checkpoint,
    next_check_days: i.next_check_days,
    first_order_date: i.first_order_date || null,
    data_period: i.data_period || null,
    collection_status: i.collection_status || null,
    collection_doc_no: i.collection_doc_no || null,
    slow_product_reason: i.slow_product_reason || null,
    single_improvement: i.single_improvement || null
  }).select('id').single();
  if (error) return { error: error.message };

  // Satırlar: ürün başına mevcut stok + günlük satış girildiyse
  const productIds = formData.getAll('product_id').map(String).filter(Boolean);
  const rows = productIds.map(pid => {
    const num = (k: string) => Number(String(formData.get(`${k}_${pid}`) ?? '').trim() || 0);
    const daily = num('daily');
    const stock = num('stock');
    if (daily <= 0 && stock <= 0) return null;
    const override = String(formData.get(`safety_${pid}`) ?? '').trim();
    return {
      plan_id: plan.id,
      product_id: pid,
      current_stock: Math.max(stock, 0),
      daily_sales: Math.max(daily, 0),
      lead_days: leadDays,
      // güvenlik stoku gün cinsinden tutuluyor; şişe karşılığı
      // ürünün kendi satış hızından çıkar. Temsilci üzerine yazabilir.
      safety_stock: override !== '' ? Math.max(Number(override), 0) : Math.ceil(daily * safetyDays),
      next_check_days: i.next_check_days
    };
  }).filter(Boolean) as any[];

  if (!rows.length) {
    await supabase.from('reorder_plans').delete().eq('id', plan.id);
    return { error: 'En az bir ürün için mevcut stok veya günlük satış girilmelidir.' };
  }

  const { error: e2 } = await supabase.from('reorder_plan_items').insert(rows);
  if (e2) return { error: e2.message };

  revalidatePath('/sales/complaints');
  return { ok: true, id: plan.id as string };
}
