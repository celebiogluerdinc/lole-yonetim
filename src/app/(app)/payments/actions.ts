'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

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

/** "12.500,50" / "12500.50" / "1,500.75" → doğru sayı (son ayırıcı ondalıktır). */
function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/[^\d.,]/g, '');
  if (!t) return null;
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  const sepIdx = Math.max(lastDot, lastComma);
  let normalized: string;
  if (sepIdx === -1) {
    normalized = t;
  } else {
    const decimals = t.slice(sepIdx + 1);
    if (decimals.length >= 1 && decimals.length <= 2) {
      // son ayırıcı ondalık: "12.500,50" → 12500.50 · "12500.50" → 12500.50
      normalized = t.slice(0, sepIdx).replace(/[.,]/g, '') + '.' + decimals;
    } else {
      // ayırıcılar binlik: "12.500" → 12500
      normalized = t.replace(/[.,]/g, '');
    }
  }
  const n = Number(normalized);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const PaySchema = z.object({
  work_title: z.string().min(2).max(200),
  work_detail: z.string().max(2000).optional().default(''),
  firm_name: z.string().min(2).max(200),
  tax_no: z.string().max(20).optional().default(''),
  iban: z.string().max(40).optional().default(''),
  amount: z.string().max(30).optional().default(''),
  department_id: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().default(''),
  save_template: z.boolean()
});

function validateFields(i: z.infer<typeof PaySchema>) {
  const iban = i.iban.replace(/\s+/g, '').toUpperCase();
  if (iban && !/^TR\d{24}$/.test(iban)) {
    return { error: 'IBAN hatalı görünüyor — TR ile başlayan 26 haneli numarayı kontrol edin.' };
  }
  const tax = i.tax_no.replace(/\s+/g, '');
  if (tax && !/^\d{10,11}$/.test(tax)) {
    return { error: 'Vergi/TC no 10 veya 11 haneli rakam olmalı.' };
  }
  const amount = i.amount ? parseAmount(i.amount) : null;
  if (i.amount.trim() && amount === null) {
    return { error: 'Tutar okunamadı — örn. 12.500,50 biçiminde yazın.' };
  }
  return { iban: iban || null, tax: tax || null, amount };
}

/** Create a payment request (optionally saving it as a template). */
export async function createPaymentRequest(formData: FormData) {
  const parsed = PaySchema.safeParse({
    work_title: String(formData.get('work_title') ?? '').trim(),
    work_detail: String(formData.get('work_detail') ?? '').trim(),
    firm_name: String(formData.get('firm_name') ?? '').trim(),
    tax_no: String(formData.get('tax_no') ?? '').trim(),
    iban: String(formData.get('iban') ?? '').trim(),
    amount: String(formData.get('amount') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '') || null,
    note: String(formData.get('note') ?? '').trim(),
    save_template: formData.get('save_template') === 'on'
  });
  if (!parsed.success) return { error: 'Yapılan iş ve firma adı zorunludur.' };
  const i = parsed.data;

  const v = validateFields(i);
  if ('error' in v) return { error: v.error };

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // güvenlik: departman bu şirkete ait olmalı
  if (i.department_id) {
    const { data: dept } = await supabase.from('departments')
      .select('id').eq('id', i.department_id).eq('company_id', companyId).maybeSingle();
    if (!dept) return { error: 'Geçersiz departman seçimi.' };
  }

  const { data: req, error } = await supabase.from('payment_requests').insert({
    company_id: companyId,
    department_id: i.department_id,
    requester_id: profile.id,
    work_title: i.work_title,
    work_detail: i.work_detail || null,
    firm_name: i.firm_name,
    tax_no: v.tax,
    iban: v.iban,
    amount: v.amount,
    note: i.note || null
  }).select().single();
  if (error) return { error: error.message };

  // isteğe bağlı: şablon olarak da kaydet
  let templateSaved = false;
  if (i.save_template) {
    const { data: exists } = await supabase.from('payment_templates')
      .select('id').eq('company_id', companyId).eq('name', i.work_title).limit(1);
    if (!exists?.length) {
      const { error: tErr } = await supabase.from('payment_templates').insert({
        company_id: companyId, department_id: i.department_id,
        name: i.work_title, work_title: i.work_title, work_detail: i.work_detail || null,
        firm_name: i.firm_name, tax_no: v.tax, iban: v.iban, amount: v.amount,
        note: i.note || null, created_by: profile.id
      });
      templateSaved = !tErr;
    }
  }

  const amountTxt = v.amount ? ` · ${v.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL` : '';
  await notifyDeciders(supabase, companyId, profile.id,
    '💸 Yeni ödeme talebi',
    `${profile.full_name}: ${i.firm_name} — ${i.work_title}${amountTxt}`,
    '/payments');

  revalidatePath('/payments');
  return { ok: true, templateSaved };
}

/** Approve / reject a payment request (admins & department managers). */
export async function decidePaymentRequest(id: string, approve: boolean, note?: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  if (!(['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0)) {
    return { error: 'Ödeme taleplerini yalnızca yönetici ve müdürler sonuçlandırabilir.' };
  }

  const { data: req } = await supabase.from('payment_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: 'Talep bulunamadı.' };
  if (req.status !== 'pending') return { error: 'Bu talep zaten sonuçlanmış.' };
  if (req.requester_id === profile.id && profile.role !== 'super_admin') {
    return { error: 'Kendi ödeme talebinizi kendiniz onaylayamazsınız.' };
  }
  if (!(await managerInScope(supabase, profile, managedDepartmentIds, req))) {
    return { error: 'Bu talep yönettiğiniz departmanların kapsamında değil.' };
  }

  const { data: updated, error } = await supabase.from('payment_requests').update({
    status: approve ? 'approved' : 'rejected',
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
    decision_note: note?.trim().slice(0, 500) || null
  }).eq('id', id).eq('status', 'pending').select('id'); // yarış koruması
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Bu talep az önce başka biri tarafından sonuçlandırıldı.' };

  await supabase.from('notifications').insert({
    company_id: req.company_id, user_id: req.requester_id, type: 'custom',
    payload: {
      title: approve ? '✅ Ödeme talebiniz onaylandı' : '❌ Ödeme talebiniz reddedildi',
      body: `${req.firm_name} — ${req.work_title}${note ? ` · ${note}` : ''}`,
      url: '/payments'
    }
  });
  pushToUsers([req.requester_id], {
    title: approve ? '✅ Ödeme talebiniz onaylandı' : '❌ Ödeme talebiniz reddedildi',
    body: `${req.firm_name} — ${req.work_title}`, url: '/payments'
  }).catch(() => {});

  revalidatePath('/payments');
  return { ok: true };
}

/** Mark an APPROVED payment as done (money transferred). Deciders only. */
export async function completePaymentRequest(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  if (!(['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0)) {
    return { error: 'Bu işlemi yalnızca yönetici ve müdürler yapabilir.' };
  }
  const { data: req } = await supabase.from('payment_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: 'Talep bulunamadı.' };
  if (req.status !== 'approved') return { error: 'Yalnızca onaylanmış talepler bitirilebilir.' };
  if (!(await managerInScope(supabase, profile, managedDepartmentIds, req))) {
    return { error: 'Bu talep yönettiğiniz departmanların kapsamında değil.' };
  }

  const { data: updated, error } = await supabase.from('payment_requests')
    .update({ status: 'completed' }).eq('id', id).eq('status', 'approved').select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Bu talep az önce başka biri tarafından güncellendi.' };

  await supabase.from('notifications').insert({
    company_id: req.company_id, user_id: req.requester_id, type: 'custom',
    payload: { title: '🏁 Ödeme tamamlandı', body: `${req.firm_name} — ${req.work_title}`, url: '/payments' }
  });
  pushToUsers([req.requester_id], {
    title: '🏁 Ödeme tamamlandı', body: `${req.firm_name} — ${req.work_title}`, url: '/payments'
  }).catch(() => {});

  revalidatePath('/payments');
  return { ok: true };
}

/** Requester cancels their own pending payment request. */
export async function cancelPaymentRequest(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile } = await getCtx();
  const { data, error } = await supabase.from('payment_requests')
    .update({ status: 'cancelled' })
    .eq('id', id).eq('requester_id', profile.id).eq('status', 'pending')
    .select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Yalnızca kendi bekleyen talebinizi iptal edebilirsiniz.' };
  revalidatePath('/payments');
  return { ok: true };
}

/** Delete a payment template (creator or admin). */
export async function deletePaymentTemplate(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz şablon.' };
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: tpl } = await supabase.from('payment_templates')
    .select('id, company_id, created_by').eq('id', id).maybeSingle();
  if (!tpl || tpl.company_id !== companyId) return { error: 'Şablon bulunamadı.' };
  if (!(['super_admin', 'admin'].includes(profile.role) || tpl.created_by === profile.id)) {
    return { error: 'Bu şablonu silme yetkiniz yok.' };
  }
  const { error } = await supabase.from('payment_templates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/payments');
  return { ok: true };
}
