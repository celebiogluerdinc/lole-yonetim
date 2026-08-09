'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

const ItemSchema = z.object({
  product: z.string().min(1).max(200),
  quantity: z.string().max(50).optional().default(''),
  unit: z.string().max(30).optional().default(''),
  brand: z.string().max(100).optional().default(''),
  spec: z.string().max(300).optional().default('')
});

/** company admins + all department managers → notification + push */
async function notifyDeciders(supabase: any, companyId: string, exceptId: string, title: string, body: string, url: string) {
  const [adminsRes, mgrsRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('company_id', companyId).eq('role', 'admin'),
    supabase.from('department_members')
      .select('user_id, departments!inner(company_id)')
      .eq('is_manager', true)
      .eq('departments.company_id', companyId)
  ]);
  const targets = new Set<string>([
    ...((adminsRes.data ?? []) as any[]).map(a => a.id),
    ...((mgrsRes.data ?? []) as any[]).map(m => m.user_id)
  ]);
  targets.delete(exceptId);
  if (!targets.size) return;
  const ids = Array.from(targets);
  await supabase.from('notifications').insert(ids.map(user_id => ({
    company_id: companyId, user_id, type: 'custom', payload: { title, body, url }
  })));
  pushToUsers(ids, { title, body, url }).catch(() => {});
}

function isDecider(profile: any, managedDepartmentIds: string[]): boolean {
  return ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
}

/** Müdürler (admin değil) yalnızca KENDİ departman kapsamındaki talepleri sonuçlandırabilir. */
async function managerInScope(
  supabase: any, profile: any, managedDepartmentIds: string[],
  req: { department_id: string | null; requester_id: string }
): Promise<boolean> {
  if (['super_admin', 'admin'].includes(profile.role)) return true;
  if (req.department_id && managedDepartmentIds.includes(req.department_id)) return true;
  const { data: shared } = await supabase.from('department_members')
    .select('department_id')
    .eq('user_id', req.requester_id)
    .in('department_id', managedDepartmentIds)
    .limit(1);
  return !!shared?.length;
}

/** Create a purchase request (optionally also saving it as a template). */
export async function createPurchaseRequest(formData: FormData) {
  let items: any;
  try { items = JSON.parse(String(formData.get('items') ?? '[]')); }
  catch { return { error: 'Ürün listesi okunamadı.' }; }

  const schema = z.object({
    title: z.string().min(2).max(200),
    department_id: z.string().uuid().optional().nullable(),
    note: z.string().max(1000).optional().default(''),
    items: z.array(ItemSchema).min(1).max(50),
    save_template: z.boolean()
  });
  const parsed = schema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '') || null,
    note: String(formData.get('note') ?? '').trim(),
    items,
    save_template: formData.get('save_template') === 'on'
  });
  if (!parsed.success) return { error: 'Başlık ve en az bir ürün (ürün adı dolu) zorunludur.' };
  const i = parsed.data;

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: req, error } = await supabase.from('purchase_requests').insert({
    company_id: companyId,
    department_id: i.department_id,
    requester_id: profile.id,
    title: i.title,
    note: i.note || null
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
        company_id: companyId, department_id: i.department_id,
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

  await notifyDeciders(supabase, companyId, profile.id,
    '🛒 Yeni satın alma talebi',
    `${profile.full_name}: ${i.title} (${i.items.length} kalem)`,
    '/purchasing');

  revalidatePath('/purchasing');
  return { ok: true, templateSaved };
}

/** Approve / reject a purchase request (admins & department managers). */
export async function decidePurchaseRequest(id: string, approve: boolean, note?: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  if (!isDecider(profile, managedDepartmentIds)) {
    return { error: 'Satın alma taleplerini yalnızca yönetici ve müdürler sonuçlandırabilir.' };
  }

  const { data: req } = await supabase.from('purchase_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: 'Talep bulunamadı.' };
  if (req.status !== 'pending') return { error: 'Bu talep zaten sonuçlanmış.' };
  if (req.requester_id === profile.id && profile.role !== 'super_admin') {
    return { error: 'Kendi talebinizi kendiniz onaylayamazsınız.' };
  }
  if (!(await managerInScope(supabase, profile, managedDepartmentIds, req))) {
    return { error: 'Bu talep yönettiğiniz departmanların kapsamında değil.' };
  }

  const { error } = await supabase.from('purchase_requests').update({
    status: approve ? 'approved' : 'rejected',
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
    decision_note: note?.trim().slice(0, 500) || null
  }).eq('id', id).eq('status', 'pending');
  if (error) return { error: error.message };

  await supabase.from('notifications').insert({
    company_id: req.company_id, user_id: req.requester_id, type: 'custom',
    payload: {
      title: approve ? '✅ Satın alma talebiniz onaylandı' : '❌ Satın alma talebiniz reddedildi',
      body: `${req.title}${note ? ` · ${note}` : ''}`,
      url: '/purchasing'
    }
  });
  pushToUsers([req.requester_id], {
    title: approve ? '✅ Satın alma talebiniz onaylandı' : '❌ Satın alma talebiniz reddedildi',
    body: req.title, url: '/purchasing'
  }).catch(() => {});

  revalidatePath('/purchasing');
  return { ok: true };
}

/** Mark an APPROVED purchase as done (goods bought/delivered). Deciders only. */
export async function completePurchaseRequest(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  if (!isDecider(profile, managedDepartmentIds)) {
    return { error: 'Bu işlemi yalnızca yönetici ve müdürler yapabilir.' };
  }
  const { data: req } = await supabase.from('purchase_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: 'Talep bulunamadı.' };
  if (req.status !== 'approved') return { error: 'Yalnızca onaylanmış talepler bitirilebilir.' };
  if (!(await managerInScope(supabase, profile, managedDepartmentIds, req))) {
    return { error: 'Bu talep yönettiğiniz departmanların kapsamında değil.' };
  }

  const { error } = await supabase.from('purchase_requests')
    .update({ status: 'completed' }).eq('id', id).eq('status', 'approved');
  if (error) return { error: error.message };

  await supabase.from('notifications').insert({
    company_id: req.company_id, user_id: req.requester_id, type: 'custom',
    payload: { title: '🏁 Satın alma tamamlandı', body: req.title, url: '/purchasing' }
  });
  pushToUsers([req.requester_id], {
    title: '🏁 Satın alma tamamlandı', body: req.title, url: '/purchasing'
  }).catch(() => {});

  revalidatePath('/purchasing');
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
