'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

/**
 * TİCARET — server action'ları (Faz 2)
 * F05 Ticari teklif · F06 Sipariş ve teslimat talimatı
 *
 * Kurallar veritabanında trigger olarak duruyor (fn_quote_guard,
 * fn_order_guard). Buradaki kontroller kullanıcıya anlaşılır hata
 * vermek için — tek başına güvenlik katmanı değil.
 */

const uuid = z.string().uuid();

async function salesCtx() {
  const ctx = await getCtx();
  if (ctx.isCustomer) throw new Error('Bu bölüme erişiminiz yok.');
  return ctx;
}

/** Postgres hatalarını kullanıcıya gösterilebilir Türkçeye çevirir. */
function friendly(msg: string): string {
  const m = msg.replace(/^.*?:\s*/, '');
  if (/mali kontrol ve satış kontrolü/i.test(msg)) return 'Teklif onaylanamaz: mali kontrol ve satış kontrolü tamamlanmalı.';
  if (/onaylı teklif referansı/i.test(msg)) return 'Sipariş onaylanamaz: onaylı teklif referansı zorunlu.';
  if (/stok ve sevk teyidi/i.test(msg)) return 'Sipariş onaylanamaz: stok ve sevk teyidi gerekli.';
  if (/bağlı teklif henüz onaylı değil/i.test(msg)) return 'Bağlı teklif henüz onaylı değil.';
  if (/yalnızca ilgili departman/i.test(msg)) return m;
  return m;
}

// ============================================================
// FİYAT ÇÖZÜMLEME
// ============================================================

/**
 * Bir noktanın ürün fiyatları.
 * Formülün tek doğrusu veritabanında: fn_price_for önce noktayla
 * anlaşılan fiyata, yoksa aktif liste fiyatına bakar. Arayüzde ikinci
 * bir hesap yazılsaydı iki ayrı doğru ortaya çıkardı.
 * Fiyatı olmayan ürün null döner — form kullanıcıyı uyarır.
 */
export async function fetchOutletPrices(outletId: string) {
  if (!uuid.safeParse(outletId).success) return { error: 'Geçersiz nokta.' };
  const { supabase, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: products } = await supabase.from('products')
    .select('id').eq('company_id', companyId).eq('is_active', true).order('sort_order');

  const ids = (products ?? []).map((p: any) => p.id as string);
  const results = await Promise.all(
    ids.map(pid => supabase.rpc('fn_price_for', { oid: outletId, pid }))
  );

  const prices: Record<string, number | null> = {};
  ids.forEach((pid, idx) => {
    const v = results[idx]?.data;
    prices[pid] = v === null || v === undefined ? null : Number(v);
  });
  return { ok: true as const, prices };
}

// ============================================================
// F05 — TİCARİ TEKLİF
// ============================================================

const quoteSchema = z.object({
  outlet_id: uuid,
  visit_id: uuid.nullable().optional(),
  valid_until: z.string().optional().default(''),
  vat_rate: z.coerce.number().min(0).max(100).default(1),
  payment_method: z.string().max(160).optional().default(''),
  approved_term_days: z.string().optional().default(''),
  delivery_fee_included: z.boolean().default(false),
  delivery_date: z.string().optional().default(''),
  campaign_note: z.string().max(1000).optional().default(''),
  written_approval_ref: z.string().max(200).optional().default('')
});

/**
 * Form satırlarını okur: item_<productId>_cases / _price / _discount
 *
 * Saha KOLİ ile düşünüyor (1 koli = 12 × 250 ml şişe), veritabanı ŞİŞE
 * tutuyor. Çevrim tek yerde — burada — yapılır. İki birim iki yerde
 * dönüştürülseydi er geç biri unuturdu.
 */
const BOTTLES_PER_CASE = 12;
function readQuoteItems(fd: FormData) {
  const rows: { product_id: string; bottles: number; unit_price: number; discount: number; position: number }[] = [];
  let pos = 0;
  for (const key of Array.from(fd.keys())) {
    const m = key.match(/^item_([0-9a-f-]{36})_cases$/);
    if (!m) continue;
    const pid = m[1];
    const cases = Number(String(fd.get(`item_${pid}_cases`) ?? '').trim());
    if (!Number.isFinite(cases) || cases <= 0) continue;      // boş satır teklife girmez
    const bottles = Math.round(cases) * BOTTLES_PER_CASE;
    const price = Number(String(fd.get(`item_${pid}_price`) ?? '').trim());
    const disc = Number(String(fd.get(`item_${pid}_discount`) ?? '0').trim());
    rows.push({
      product_id: pid,
      bottles: Math.round(bottles),
      unit_price: Number.isFinite(price) ? price : 0,
      discount: Number.isFinite(disc) && disc > 0 ? disc : 0,
      position: pos++
    });
  }
  return rows;
}

export async function createQuote(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const parsed = quoteSchema.safeParse({
    outlet_id: s('outlet_id'),
    visit_id: s('visit_id') || null,
    valid_until: s('valid_until'),
    vat_rate: s('vat_rate') || '1',
    payment_method: s('payment_method'),
    approved_term_days: s('approved_term_days'),
    delivery_fee_included: formData.get('delivery_fee_included') === 'on',
    delivery_date: s('delivery_date'),
    campaign_note: s('campaign_note'),
    written_approval_ref: s('written_approval_ref')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const items = readQuoteItems(formData);
  if (!items.length) return { error: 'En az bir ürün için koli adedi girilmelidir.' };
  if (items.some(r => r.unit_price <= 0)) {
    return { error: 'Fiyatı girilmemiş ürün var. Nokta için fiyat anlaşması veya liste fiyatı tanımlı olmalı.' };
  }

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // Kullanılan fiyat listesinin sürümü anlık görüntü olarak saklanır:
  // liste sonradan değişse de bu teklif kendi fiyatıyla kalır.
  const { data: list } = await supabase.from('price_lists')
    .select('id, version').eq('company_id', companyId).eq('is_active', true)
    .order('valid_from', { ascending: false }).limit(1).maybeSingle();

  const { data: quote, error } = await supabase.from('quotes').insert({
    company_id: companyId,
    outlet_id: i.outlet_id,
    visit_id: i.visit_id || null,
    created_by: profile.id,
    valid_until: i.valid_until || null,
    price_list_id: list?.id ?? null,
    price_list_version: list?.version ?? null,
    vat_rate: i.vat_rate,
    payment_method: i.payment_method || null,
    approved_term_days: i.approved_term_days ? Number(i.approved_term_days) : null,
    delivery_fee_included: i.delivery_fee_included,
    delivery_date: i.delivery_date || null,
    campaign_note: i.campaign_note || null,
    written_approval_ref: i.written_approval_ref || null,
    status: 'taslak'
  }).select('id').single();
  if (error) return { error: friendly(error.message) };

  const { error: e2 } = await supabase.from('quote_items')
    .insert(items.map(r => ({ ...r, quote_id: quote.id })));
  if (e2) return { error: `Teklif kalemleri kaydedilemedi: ${friendly(e2.message)}` };

  revalidatePath('/sales/orders');
  revalidatePath(`/sales/outlets/${i.outlet_id}`);
  return { ok: true as const, id: quote.id as string };
}

/** Taslak teklifin kalemlerini ve koşullarını günceller. */
export async function updateQuote(formData: FormData) {
  const id = String(formData.get('quote_id') ?? '');
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz teklif.' };
  const s = (k: string) => String(formData.get(k) ?? '').trim();

  const { supabase } = await salesCtx();
  const { data: q } = await supabase.from('quotes').select('id, status, outlet_id').eq('id', id).maybeSingle();
  if (!q) return { error: 'Teklif bulunamadı.' };
  if (!['taslak', 'kontrolde'].includes(q.status)) {
    return { error: 'Yalnızca taslak veya kontroldeki teklif düzenlenebilir.' };
  }

  const items = readQuoteItems(formData);
  if (!items.length) return { error: 'En az bir ürün için koli adedi girilmelidir.' };

  const { error } = await supabase.from('quotes').update({
    valid_until: s('valid_until') || null,
    vat_rate: Number(s('vat_rate') || '1'),
    payment_method: s('payment_method') || null,
    approved_term_days: s('approved_term_days') ? Number(s('approved_term_days')) : null,
    delivery_fee_included: formData.get('delivery_fee_included') === 'on',
    delivery_date: s('delivery_date') || null,
    campaign_note: s('campaign_note') || null,
    written_approval_ref: s('written_approval_ref') || null
  }).eq('id', id);
  if (error) return { error: friendly(error.message) };

  await supabase.from('quote_items').delete().eq('quote_id', id);
  const { error: e2 } = await supabase.from('quote_items')
    .insert(items.map(r => ({ ...r, quote_id: id })));
  if (e2) return { error: `Kalemler güncellenemedi: ${friendly(e2.message)}` };

  revalidatePath(`/sales/orders/quotes/${id}`);
  revalidatePath('/sales/orders');
  return { ok: true as const };
}

/**
 * F05'in iki aşamalı kontrolü. Adım kodları `approval_steps` tablosundan:
 * mali_kontrol · satis_kontrolu. Yetkiyi veritabanı fn_can_approve ile
 * doğruluyor; burada önden bakıp anlaşılır mesaj veriyoruz.
 */
export async function checkQuote(quoteId: string, step: 'mali_kontrol' | 'satis_kontrolu') {
  if (!uuid.safeParse(quoteId).success) return { error: 'Geçersiz teklif.' };
  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: allowed } = await supabase.rpc('fn_can_approve', {
    cid: companyId, code: step, uid: profile.id
  });
  if (allowed === false) {
    return { error: 'Bu kontrolü yapma yetkiniz yok (ilgili departman üyesi olmalısınız).' };
  }

  const now = new Date().toISOString();
  const patch = step === 'mali_kontrol'
    ? { finance_checked_by: profile.id, finance_checked_at: now }
    : { sales_checked_by: profile.id, sales_checked_at: now };

  const { error } = await supabase.from('quotes').update(patch).eq('id', quoteId);
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/sales/orders/quotes/${quoteId}`);
  return { ok: true as const };
}

/** Yapılmış bir kontrolü geri alır (yanlış kişi onayladıysa). */
export async function undoQuoteCheck(quoteId: string, step: 'mali_kontrol' | 'satis_kontrolu') {
  if (!uuid.safeParse(quoteId).success) return { error: 'Geçersiz teklif.' };
  const { supabase } = await salesCtx();
  const { data: q } = await supabase.from('quotes').select('status').eq('id', quoteId).maybeSingle();
  if (!q) return { error: 'Teklif bulunamadı.' };
  if (!['taslak', 'kontrolde'].includes(q.status)) {
    return { error: 'Onaylanmış teklifte kontrol geri alınamaz.' };
  }
  const patch = step === 'mali_kontrol'
    ? { finance_checked_by: null, finance_checked_at: null }
    : { sales_checked_by: null, sales_checked_at: null };
  const { error } = await supabase.from('quotes').update(patch).eq('id', quoteId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/sales/orders/quotes/${quoteId}`);
  return { ok: true as const };
}

const QUOTE_STATUSES = ['taslak', 'kontrolde', 'onayli', 'sunuldu', 'kabul', 'red', 'suresi_doldu', 'iptal'] as const;

export async function setQuoteStatus(quoteId: string, status: string, rejectReason?: string) {
  if (!uuid.safeParse(quoteId).success) return { error: 'Geçersiz teklif.' };
  if (!(QUOTE_STATUSES as readonly string[]).includes(status)) return { error: 'Geçersiz durum.' };
  if (status === 'red') {
    const r = z.string().min(3, 'Ret sebebi en az 3 karakter olmalı.').max(500).safeParse((rejectReason ?? '').trim());
    if (!r.success) return { error: r.error.issues[0].message };
  }

  const { supabase } = await salesCtx();
  const { error } = await supabase.from('quotes').update({
    status,
    reject_reason: status === 'red' ? (rejectReason ?? '').trim() : null
  }).eq('id', quoteId);
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/sales/orders/quotes/${quoteId}`);
  revalidatePath('/sales/orders');
  return { ok: true as const };
}

// ============================================================
// F06 — SİPARİŞ VE TESLİMAT TALİMATI
// ============================================================

/**
 * oi_<productId>_paid_cases / _free_cases / _price
 *
 * Saha KOLİ ile düşünür, veritabanı ŞİŞE tutar — teklif formuyla aynı
 * dönüşüm burada da uygulanıyor (1 koli = 12 × 250 ml şişe). İki ekranın
 * iki ayrı birimi olması, sahada en sık yapılan hatanın kaynağıydı.
 */
function readOrderItems(fd: FormData) {
  const rows: {
    product_id: string; paid_bottles: number; free_bottles: number;
    unit_price: number; batch_id: string | null; position: number;
  }[] = [];
  let pos = 0;
  for (const key of Array.from(fd.keys())) {
    const m = key.match(/^oi_([0-9a-f-]{36})_paid_cases$/);
    if (!m) continue;
    const pid = m[1];
    const paidCases = Math.round(Number(String(fd.get(`oi_${pid}_paid_cases`) ?? '0').trim()) || 0);
    const freeCases = Math.round(Number(String(fd.get(`oi_${pid}_free_cases`) ?? '0').trim()) || 0);
    const paid = Math.max(paidCases, 0) * BOTTLES_PER_CASE;
    const free = Math.max(freeCases, 0) * BOTTLES_PER_CASE;
    // F06: koli ve şişe aynı miktarın gösterimi — toplanmaz. Gerçek olan şişe.
    if (paid + free <= 0) continue;
    const price = Number(String(fd.get(`oi_${pid}_price`) ?? '0').trim()) || 0;
    rows.push({
      product_id: pid,
      paid_bottles: Math.max(paid, 0),
      free_bottles: Math.max(free, 0),
      unit_price: Math.max(price, 0),
      batch_id: String(fd.get(`oi_${pid}_batch`) ?? '') || null,
      position: pos++
    });
  }
  return rows;
}

/**
 * Onaylı teklifi siparişe çevirir.
 * F06: "Onaylı teklif referansı olmadan fiyat taahhüdü verilmez."
 * Fatura bilgisi noktadan KOPYALANIR — nokta sonradan güncellense bile
 * belge kendi bilgisiyle kalır.
 */
export async function createOrderFromQuote(formData: FormData) {
  const quoteId = String(formData.get('quote_id') ?? '');
  if (!uuid.safeParse(quoteId).success) return { error: 'Geçersiz teklif.' };
  const s = (k: string) => String(formData.get(k) ?? '').trim();

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: quote } = await supabase.from('quotes')
    .select('id, status, outlet_id, visit_id, payment_method').eq('id', quoteId).maybeSingle();
  if (!quote) return { error: 'Teklif bulunamadı.' };
  if (!['onayli', 'sunuldu', 'kabul'].includes(quote.status)) {
    return { error: 'Sipariş yalnızca onaylı tekliften oluşturulabilir.' };
  }

  const items = readOrderItems(formData);
  if (!items.length) return { error: 'En az bir ürün için koli adedi girilmelidir.' };

  const { data: outlet } = await supabase.from('outlets')
    .select('legal_name, name, tax_office, tax_number, address, phone')
    .eq('id', quote.outlet_id).maybeSingle();

  const { data: order, error } = await supabase.from('sales_orders').insert({
    company_id: companyId,
    outlet_id: quote.outlet_id,
    quote_id: quote.id,
    visit_id: quote.visit_id ?? null,
    created_by: profile.id,
    customer_approval_date: s('customer_approval_date') || null,
    invoice_title: outlet?.legal_name || outlet?.name || null,
    tax_office: outlet?.tax_office ?? null,
    tax_number: outlet?.tax_number ?? null,
    payment_method: s('payment_method') || quote.payment_method || null,
    collection_ref: s('collection_ref') || null,
    delivery_address: s('delivery_address') || outlet?.address || null,
    receiver_name: s('receiver_name') || null,
    receiver_phone: s('receiver_phone') || outlet?.phone || null,
    delivery_time_window: s('delivery_time_window') || null,
    delivery_date: s('delivery_date') || null,
    training_appointment_at: s('training_appointment_at') || null,
    first_followup_date: s('first_followup_date') || null,
    first_followup_owner: s('first_followup_owner') || profile.id,
    status: 'taslak'
  }).select('id').single();
  if (error) return { error: friendly(error.message) };

  const { error: e2 } = await supabase.from('sales_order_items')
    .insert(items.map(r => ({ ...r, order_id: order.id })));
  if (e2) return { error: `Sipariş kalemleri kaydedilemedi: ${friendly(e2.message)}` };

  // teklif kabul edildi olarak işaretlenir
  await supabase.from('quotes').update({ status: 'kabul' }).eq('id', quote.id);

  revalidatePath('/sales/orders');
  revalidatePath(`/sales/orders/quotes/${quote.id}`);
  revalidatePath(`/sales/outlets/${quote.outlet_id}`);
  return { ok: true as const, id: order.id as string };
}

export async function confirmOrderStock(orderId: string) {
  if (!uuid.safeParse(orderId).success) return { error: 'Geçersiz sipariş.' };
  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: allowed } = await supabase.rpc('fn_can_approve', {
    cid: companyId, code: 'stok_sevk_teyidi', uid: profile.id
  });
  if (allowed === false) return { error: 'Stok ve sevk teyidi verme yetkiniz yok.' };

  const { error } = await supabase.from('sales_orders').update({
    stock_confirmed_by: profile.id, stock_confirmed_at: new Date().toISOString()
  }).eq('id', orderId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const };
}

export async function acceptOrder(orderId: string) {
  if (!uuid.safeParse(orderId).success) return { error: 'Geçersiz sipariş.' };
  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: allowed } = await supabase.rpc('fn_can_approve', {
    cid: companyId, code: 'siparis_kabulu', uid: profile.id
  });
  if (allowed === false) return { error: 'Sipariş kabulü verme yetkiniz yok.' };

  const { error } = await supabase.from('sales_orders').update({
    order_accepted_by: profile.id, order_accepted_at: new Date().toISOString()
  }).eq('id', orderId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const };
}

const ORDER_STATUSES = ['taslak', 'onay_bekliyor', 'onayli', 'sevk_edildi', 'teslim', 'iptal'] as const;

export async function setOrderStatus(orderId: string, status: string, cancelReason?: string) {
  if (!uuid.safeParse(orderId).success) return { error: 'Geçersiz sipariş.' };
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) return { error: 'Geçersiz durum.' };
  if (status === 'iptal') {
    const r = z.string().min(3, 'İptal sebebi en az 3 karakter olmalı.').max(500).safeParse((cancelReason ?? '').trim());
    if (!r.success) return { error: r.error.issues[0].message };
  }

  const { supabase } = await salesCtx();
  const { error } = await supabase.from('sales_orders').update({
    status, cancel_reason: status === 'iptal' ? (cancelReason ?? '').trim() : null
  }).eq('id', orderId);
  if (error) return { error: friendly(error.message) };

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath('/sales/orders');
  return { ok: true as const };
}

/**
 * Siparişi bir ziyarete bağlar.
 * Ziyaret "sipariş" sonucuyla kapanacaksa bu bağ zorunlu —
 * veritabanı da kaydı bu bağ olmadan kapatmıyor.
 */
export async function linkOrderToVisit(orderId: string, visitId: string) {
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(visitId).success) {
    return { error: 'Geçersiz kayıt.' };
  }
  const { supabase } = await salesCtx();
  const { data: order } = await supabase.from('sales_orders')
    .select('id, outlet_id').eq('id', orderId).maybeSingle();
  const { data: visit } = await supabase.from('visits')
    .select('id, outlet_id').eq('id', visitId).maybeSingle();
  if (!order || !visit) return { error: 'Sipariş veya ziyaret bulunamadı.' };
  if (order.outlet_id !== visit.outlet_id) {
    return { error: 'Sipariş ile ziyaret aynı noktaya ait olmalı.' };
  }

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('visits').update({ sales_order_id: orderId, outcome: 'siparis' }).eq('id', visitId),
    supabase.from('sales_orders').update({ visit_id: visitId }).eq('id', orderId)
  ]);
  if (e1 || e2) return { error: friendly((e1 ?? e2)!.message) };

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath(`/sales/visits/${visitId}`);
  return { ok: true as const };
}

// ============================================================
// TAKİP (ortak "Sonraki adım ve kontrol" bloğu)
// ============================================================

export async function addCommerceFollowUp(formData: FormData) {
  const schema = z.object({
    source_type: z.enum(['quote', 'order']),
    source_id: uuid,
    outlet_id: uuid,
    action: z.string().min(3, 'Yapılacak işlem en az 3 karakter olmalı.').max(500),
    owner_user_id: uuid.nullable().optional(),
    due_date: z.string().min(10, 'Son tarih zorunludur.')
  });
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const parsed = schema.safeParse({
    source_type: s('source_type') as any,
    source_id: s('source_id'),
    outlet_id: s('outlet_id'),
    action: s('action'),
    owner_user_id: s('owner_user_id') || null,
    due_date: s('due_date')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Form eksik.' };
  const i = parsed.data;

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { error } = await supabase.from('follow_ups').insert({
    company_id: companyId,
    source_type: i.source_type,
    source_id: i.source_id,
    outlet_id: i.outlet_id,
    action: i.action,
    owner_user_id: i.owner_user_id || profile.id,
    due_date: i.due_date,
    created_by: profile.id
  });
  if (error) return { error: friendly(error.message) };

  revalidatePath(i.source_type === 'quote'
    ? `/sales/orders/quotes/${i.source_id}`
    : `/sales/orders/${i.source_id}`);
  return { ok: true as const };
}
