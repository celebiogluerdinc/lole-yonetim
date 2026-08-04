'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

async function notify(supabase: any, companyId: string, userIds: string[], title: string, body: string, url: string) {
  if (!userIds.length) return;
  await supabase.from('notifications').insert(userIds.map(user_id => ({
    company_id: companyId, user_id, type: 'custom', payload: { title, body, url }
  })));
  pushToUsers(userIds, { title, body, url }).catch(() => {});
}

// ==================== VARDİYA ====================
export async function addShift(formData: FormData) {
  const schema = z.object({
    user_id: z.string().uuid(),
    department_id: z.string().uuid(),
    date: z.string().min(8),
    start: z.string().min(4),
    end: z.string().min(4),
    note: z.string().max(200).optional().default('')
  });
  const parsed = schema.safeParse({
    user_id: String(formData.get('user_id') ?? ''),
    department_id: String(formData.get('department_id') ?? ''),
    date: String(formData.get('date') ?? ''),
    start: String(formData.get('start') ?? ''),
    end: String(formData.get('end') ?? ''),
    note: String(formData.get('note') ?? '')
  });
  if (!parsed.success) return { error: 'Kişi, tarih ve saatler zorunludur.' };
  const i = parsed.data;

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  const allowed = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.includes(i.department_id);
  if (!allowed) return { error: 'Bu departmanda vardiya planlamaya yetkiniz yok.' };

  const starts = new Date(`${i.date}T${i.start}`);
  let ends = new Date(`${i.date}T${i.end}`);
  if (ends <= starts) ends = new Date(ends.getTime() + 24 * 3600 * 1000); // gece vardiyası

  const { error } = await supabase.from('shifts').insert({
    company_id: companyId,
    department_id: i.department_id,
    user_id: i.user_id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    note: i.note || null,
    created_by: profile.id
  });
  if (error) return { error: error.message };

  const label = starts.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  await notify(supabase, companyId, [i.user_id], '🗓 Yeni vardiya atandı', `${label} başlangıçlı vardiyanız planlandı.`, '/shifts');

  revalidatePath('/shifts');
  return { ok: true };
}

export async function deleteShift(id: string) {
  const { supabase } = await getCtx();
  await supabase.from('shifts').delete().eq('id', id); // RLS korur
  revalidatePath('/shifts');
  return { ok: true };
}

// ==================== İZİN ====================
export async function requestLeave(formData: FormData) {
  const schema = z.object({
    type: z.enum(['annual', 'sick', 'unpaid', 'other']),
    start_date: z.string().min(8),
    end_date: z.string().min(8),
    reason: z.string().max(500).optional().default('')
  });
  const parsed = schema.safeParse({
    type: String(formData.get('type') ?? 'annual'),
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? ''),
    reason: String(formData.get('reason') ?? '')
  });
  if (!parsed.success) return { error: 'Tür ve tarihler zorunludur.' };
  const i = parsed.data;
  if (i.end_date < i.start_date) return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { error } = await supabase.from('leave_requests').insert({
    company_id: companyId, user_id: profile.id,
    type: i.type, start_date: i.start_date, end_date: i.end_date,
    reason: i.reason || null
  });
  if (error) return { error: error.message };

  // yöneticilere haber ver: kişinin departman müdürleri + adminler
  const { data: myDepts } = await supabase
    .from('department_members').select('department_id').eq('user_id', profile.id);
  const deptIds = (myDepts ?? []).map((d: any) => d.department_id);
  const targets = new Set<string>();
  if (deptIds.length) {
    const { data: mgrs } = await supabase
      .from('department_members').select('user_id')
      .in('department_id', deptIds).eq('is_manager', true);
    for (const m of mgrs ?? []) targets.add(m.user_id);
  }
  const { data: admins } = await supabase
    .from('profiles').select('id').eq('company_id', companyId).eq('role', 'admin');
  for (const a of admins ?? []) targets.add(a.id);
  targets.delete(profile.id);
  await notify(supabase, companyId, Array.from(targets),
    '🏖 Yeni izin talebi', `${profile.full_name}: ${i.start_date} – ${i.end_date}`, '/leave');

  revalidatePath('/leave');
  return { ok: true };
}

export async function decideLeave(id: string, approve: boolean, note?: string) {
  const { supabase, profile, companyId } = await getCtx();
  const { data: req } = await supabase.from('leave_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: 'Talep bulunamadı.' };
  if (req.status !== 'pending') return { error: 'Bu talep zaten sonuçlanmış.' };

  const { error } = await supabase.from('leave_requests').update({
    status: approve ? 'approved' : 'rejected',
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
    decision_note: note?.trim() || null
  }).eq('id', id);
  if (error) return { error: error.message };

  await notify(supabase, req.company_id, [req.user_id],
    approve ? '✅ İzin talebiniz onaylandı' : '❌ İzin talebiniz reddedildi',
    `${req.start_date} – ${req.end_date}${note ? ` · ${note}` : ''}`, '/leave');

  revalidatePath('/leave');
  return { ok: true };
}

export async function cancelLeave(id: string) {
  const { supabase, profile } = await getCtx();
  await supabase.from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', id).eq('user_id', profile.id).eq('status', 'pending');
  revalidatePath('/leave');
  return { ok: true };
}

// ==================== PUANTAJ ====================
export async function clockIn(method: 'qr' | 'manual') {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: open } = await supabase
    .from('time_entries').select('id')
    .eq('user_id', profile.id).is('clock_out', null).limit(1).maybeSingle();
  if (open) return { error: 'Zaten açık bir mesainiz var. Önce çıkış yapın.' };

  const { error } = await supabase.from('time_entries').insert({
    company_id: companyId, user_id: profile.id, in_method: method
  });
  if (error) return { error: error.message };
  revalidatePath('/clock');
  return { ok: true };
}

export async function clockOut() {
  const { supabase, profile } = await getCtx();
  const { data: open } = await supabase
    .from('time_entries').select('id')
    .eq('user_id', profile.id).is('clock_out', null)
    .order('clock_in', { ascending: false }).limit(1).maybeSingle();
  if (!open) return { error: 'Açık mesai bulunamadı. Önce giriş yapın.' };

  const { error } = await supabase.from('time_entries')
    .update({ clock_out: new Date().toISOString() }).eq('id', open.id);
  if (error) return { error: error.message };
  revalidatePath('/clock');
  return { ok: true };
}
