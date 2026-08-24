'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { notifyDeciders, notifyUser } from '@/lib/notify';

const ItemSchema = z.object({
  product: z.string().min(1).max(200),
  quantity: z.string().max(50).optional().default(''),
  unit: z.string().max(30).optional().default(''),
  brand: z.string().max(100).optional().default(''),
  spec: z.string().max(300).optional().default('')
});

/**
 * Karar verme yetkisi. Müşteri hesabı ASLA karar veremez.
 * SİPARİŞ HATTI: yalnızca süper yönetici, admin ve MÜDÜRLER
 * (sipariş sorumlusu = müdür rolü) siparişleri görür ve sonuçlandırır.
 */
function isDecider(profile: any, managedDepartmentIds: string[], isOrderLine = false): boolean {
  if (profile.is_customer) return false;
  if (['super_admin', 'admin'].includes(profile.role)) return true;
  if (isOrderLine) return profile.role === 'manager';
  return managedDepartmentIds.length > 0;
}

/** Müdürler (admin değil) yalnızca KENDİ departman kapsamındaki talepleri sonuçlandırabilir. */
async function managerInScope(
  supabase: any, profile: any, managedDepartmentIds: string[],
  req: { department_id: string | null; requester_id: string },
  isOrderLine = false
): Promise<boolean> {
  if (['super_admin', 'admin'].includes(profile.role)) return true;
  // sipariş hattında departman yoktur: yetki doğrudan müdür rolünden gelir
  if (isOrderLine) return !profile.is_customer && profile.role === 'manager';
  if (req.department_id && managedDepartmentIds.includes(req.department_id)) return true;
  const { data: shared } = await supabase.from('department_members')
    .select('department_id')
    .eq('user_id', req.requester_id)
    .in('department_id', managedDepartmentIds)
    .limit(1);
  return !!shared?.length;
}

/** Sipariş hattında Türkçe sipariş dili, iç şirketlerde satın alma dili. */
const say = (orderLine: boolean) => ({
  newTitle: orderLine ? '📦 Yeni sipariş' : '🛒 Yeni satın alma talebi',
  approved: orderLine ? '✅ Siparişiniz onaylandı' : '✅ Satın alma talebiniz onaylandı',
  rejected: orderLine ? '❌ Siparişiniz karşılanamadı' : '❌ Satın alma talebiniz reddedildi',
  done: orderLine ? '🚚 Siparişiniz teslim edildi' : '🏁 Satın alma tamamlandı'
});

/** Create a purchase request (optionally also saving it as a template). */
export async function createPurchaseRequest(formData: FormData) {
  let items: any;
  try { items = JSON.parse(String(formData.get('items') ?? '[]')); }
  catch { return { error: 'Ürün listesi okunamadı.' }; }

  const schema = z.object({
    title: z.string().min(2).max(200),
    department_id: z.string().uuid().optional().nullable(),
    note: z.string().max(1000).optional().default(''),
    needed_at: z.string().max(10).optional().default(''),
    delivery_address: z.string().max(300).optional().default(''),
    items: z.array(ItemSchema).min(1).max(50),
    save_template: z.boolean()
  });
  const parsed = schema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '') || null,
    note: String(formData.get('note') ?? '').trim(),
    needed_at: String(formData.get('needed_at') ?? '').trim(),
    delivery_address: String(formData.get('delivery_address') ?? '').trim(),
    items,
    save_template: formData.get('save_template') === 'on'
  });
  if (!parsed.success) return { error: 'Başlık ve en az bir ürün (ürün adı dolu) zorunludur.' };
  const i = parsed.data;

  const { supabase, profile, companyId, isOrderLine } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // sipariş hattında departman kavramı yoktur
  const deptId = isOrderLine ? null : i.department_id;

  // güvenlik: departman bu şirkete ait olmalı
  if (deptId) {
    const { data: dept } = await supabase.from('departments')
      .select('id').eq('id', deptId).eq('company_id', companyId).maybeSingle();
    if (!dept) return { error: 'Geçersiz departman seçimi.' };
  }

  if (i.needed_at) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.needed_at)) {
      return { error: 'İstenen teslim tarihi okunamadı.' };
    }
    const bugun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    if (i.needed_at < bugun) return { error: 'İstenen teslim tarihi geçmiş bir gün olamaz.' };
  }

  const { data: req, error } = await supabase.from('purchase_requests').insert({
    company_id: companyId,
    department_id: deptId,
    requester_id: profile.id,
    title: i.title,
    note: i.note || null,
    needed_at: i.needed_at || null,
    delivery_address: i.delivery_address || null
  }).select().single();
  if (error) return { error: error.message };

  const { error: iErr } = await supabase.from('purchase_items').insert(
    i.items.map((it, idx) => ({
      request_id: req.id,
      product: it.product.trim(),
      quantity: it.quantity?.trim() || null,
      unit: it.unit?.trim() || null,
      brand: it.brand?.trim() || null,
      spec: it.spec?.trim() || null,
      position: idx
    }))
  );
  if (iErr) return { error: `Ürünler kaydedilemedi: ${iErr.message}` };

  // isteğe bağlı: şablon olarak da kaydet
  let templateSaved = false;
  if (i.save_template) {
    const { data: exists } = await supabase.from('purchase_templates')
      .select('id').eq('company_id', companyId).eq('name', i.title).limit(1);
    if (!exists?.length) {
      const { data: tpl } = await supabase.from('purchase_templates').insert({
        company_id: companyId, department_id: deptId,
        name: i.title, note: i.note || null, created_by: profile.id
      }).select().single();
      if (tpl) {
        await supabase.from('purchase_template_items').insert(
          i.items.map((it, idx) => ({
            template_id: tpl.id,
            product: it.product.trim(),
            quantity: it.quantity?.trim() || null,
            unit: it.unit?.trim() || null,
            brand: it.brand?.trim() || null,
            spec: it.spec?.trim() || null,
            position: idx
          }))
        );
        templateSaved = true;
      }
    }
  }

  const t = say(isOrderLine);
  const who = isOrderLine
    ? ((profile as any).customer_name || profile.full_name)
    : profile.full_name;
  const notified = await notifyDeciders(supabase, {
    companyId, exceptId: profile.id,
    title: t.newTitle,
    body: `${who}: ${i.title} (${i.items.length} kalem)`,
    url: '/purchasing'
  });

  revalidatePath('/purchasing');
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true, templateSaved, notified };
}

/** Aynı siparişi tek tuşla yeniden ver (kalemler birebir kopyalanır). */
export async function reorderPurchaseRequest(requestId: string) {
  if (!z.string().uuid().safeParse(requestId).success) return { error: 'Geçersiz sipariş.' };
  const { supabase, profile, companyId, isOrderLine } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: src } = await supabase.from('purchase_requests')
    .select('*').eq('id', requestId).maybeSingle();
  if (!src || src.company_id !== companyId) return { error: 'Sipariş bulunamadı.' };

  const { data: items } = await supabase.from('purchase_items')
    .select('product, quantity, unit, brand, spec, position')
    .eq('request_id', requestId).order('position');
  if (!items?.length) return { error: 'Bu siparişte kopyalanacak ürün yok.' };

  const { data: req, error } = await supabase.from('purchase_requests').insert({
    company_id: companyId,
    department_id: isOrderLine ? null : src.department_id,
    requester_id: profile.id,
    title: src.title,
    note: src.note,
    delivery_address: src.delivery_address ?? null,
    needed_at: null // eski teslim tarihi taşınmaz — yeni sipariş tarihsiz açılır
  }).select().single();
  if (error) return { error: error.message };

  const { error: iErr } = await supabase.from('purchase_items').insert(
    items.map((it: any, idx: number) => ({
      request_id: req.id,
      product: it.product, quantity: it.quantity, unit: it.unit,
      brand: it.brand, spec: it.spec, position: it.position ?? idx
    }))
  );
  if (iErr) return { error: `Ürünler kopyalanamadı: ${iErr.message}` };

  const t = say(isOrderLine);
  const who = isOrderLine
    ? ((profile as any).customer_name || profile.full_name)
    : profile.full_name;
  const notified = await notifyDeciders(supabase, {
    companyId, exceptId: profile.id,
    title: t.newTitle, body: `${who}: ${src.title} (tekrar sipariş)`, url: '/purchasing'
  });

  revalidatePath('/purchasing');
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true, notified };
}

/** Approve / reject a purchase request (admins & department managers). */
export async function decidePurchaseRequest(id: string, approve: boolean, note?: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds, isOrderLine } = await getCtx();
  if (!isDecider(profile, managedDepartmentIds, isOrderLine)) {
    return {
      error: isOrderLine
        ? 'Siparişleri yalnızca sipariş sorumluları ve yöneticiler sonuçlandırabilir.'
        : 'Satın alma taleplerini yalnızca yönetici ve müdürler sonuçlandırabilir.'
    };
  }

  const { data: req } = await supabase.from('purchase_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: isOrderLine ? 'Sipariş bulunamadı.' : 'Talep bulunamadı.' };
  if (req.status !== 'pending') return { error: 'Bu kayıt zaten sonuçlanmış.' };
  if (req.requester_id === profile.id && profile.role !== 'super_admin') {
    return { error: 'Kendi talebinizi kendiniz onaylayamazsınız.' };
  }
  if (!(await managerInScope(supabase, profile, managedDepartmentIds, req, isOrderLine))) {
    return { error: 'Bu kayıt yönettiğiniz departmanların kapsamında değil.' };
  }

  const { data: updated, error } = await supabase.from('purchase_requests').update({
    status: approve ? 'approved' : 'rejected',
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
    decision_note: note?.trim().slice(0, 500) || null
  }).eq('id', id).eq('status', 'pending').select('id'); // yarış koruması
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Bu talep az önce başka biri tarafından sonuçlandırıldı.' };

  const t = say(isOrderLine);
  const head = approve ? t.approved : t.rejected;
  await notifyUser(supabase, {
    companyId: req.company_id, userId: req.requester_id,
    title: head, body: `${req.title}${note ? ` · ${note}` : ''}`, url: '/purchasing'
  });

  revalidatePath('/purchasing');
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Mark an APPROVED purchase as done (goods bought/delivered). Deciders only. */
export async function completePurchaseRequest(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds, isOrderLine } = await getCtx();
  if (!isDecider(profile, managedDepartmentIds, isOrderLine)) {
    return { error: 'Bu işlemi yalnızca yetkili hesaplar yapabilir.' };
  }
  const { data: req } = await supabase.from('purchase_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: isOrderLine ? 'Sipariş bulunamadı.' : 'Talep bulunamadı.' };
  if (req.status !== 'approved') {
    return { error: isOrderLine ? 'Yalnızca onaylanmış siparişler teslim edilebilir.' : 'Yalnızca onaylanmış talepler bitirilebilir.' };
  }
  if (!(await managerInScope(supabase, profile, managedDepartmentIds, req, isOrderLine))) {
    return { error: 'Bu kayıt yönettiğiniz departmanların kapsamında değil.' };
  }

  const { data: updated, error } = await supabase.from('purchase_requests')
    .update({ status: 'completed' }).eq('id', id).eq('status', 'approved').select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Bu talep az önce başka biri tarafından güncellendi.' };

  const done = say(isOrderLine).done;
  await notifyUser(supabase, {
    companyId: req.company_id, userId: req.requester_id,
    title: done, body: req.title, url: '/purchasing'
  });

  revalidatePath('/purchasing');
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Requester cancels their own pending request. */
export async function cancelPurchaseRequest(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile } = await getCtx();
  const { data, error } = await supabase.from('purchase_requests')
    .update({ status: 'cancelled' })
    .eq('id', id).eq('requester_id', profile.id).eq('status', 'pending')
    .select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Yalnızca kendi bekleyen talebinizi iptal edebilirsiniz.' };
  revalidatePath('/purchasing');
  return { ok: true };
}

/** Save an existing request as a reusable purchase template. */
export async function savePurchaseRequestAsTemplate(requestId: string) {
  if (!z.string().uuid().safeParse(requestId).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: req } = await supabase.from('purchase_requests')
    .select('*').eq('id', requestId).maybeSingle();
  if (!req || req.company_id !== companyId) return { error: 'Talep bulunamadı.' };

  const { data: exists } = await supabase.from('purchase_templates')
    .select('id').eq('company_id', companyId).eq('name', req.title).limit(1);
  if (exists?.length) return { error: `"${req.title}" adında bir şablon zaten var.` };

  const { data: items } = await supabase.from('purchase_items')
    .select('product, quantity, unit, brand, spec, position')
    .eq('request_id', requestId).order('position');

  const { data: tpl, error } = await supabase.from('purchase_templates').insert({
    company_id: companyId, department_id: req.department_id,
    name: req.title, note: req.note, created_by: profile.id
  }).select().single();
  if (error) return { error: error.message };

  if (items?.length) {
    const { error: iErr } = await supabase.from('purchase_template_items').insert(
      items.map((it: any, idx: number) => ({ template_id: tpl.id, ...it, position: it.position ?? idx }))
    );
    if (iErr) return { error: `Şablon oluştu ama ürünler kopyalanamadı: ${iErr.message}` };
  }
  revalidatePath('/purchasing');
  return { ok: true, name: req.title };
}

/** Delete a purchase template (creator or admin). */
export async function deletePurchaseTemplate(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz şablon.' };
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: tpl } = await supabase.from('purchase_templates')
    .select('id, company_id, created_by').eq('id', id).maybeSingle();
  if (!tpl || tpl.company_id !== companyId) return { error: 'Şablon bulunamadı.' };
  if (!(['super_admin', 'admin'].includes(profile.role) || tpl.created_by === profile.id)) {
    return { error: 'Bu şablonu silme yetkiniz yok.' };
  }
  const { error } = await supabase.from('purchase_templates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/purchasing');
  return { ok: true };
}
