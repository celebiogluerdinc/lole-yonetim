'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

const isAdmin = (role: string) => ['super_admin', 'admin'].includes(role);
const uuid = z.string().uuid();

/** "2026-08-25T14:30" → İstanbul saatiyle sabitlenmiş ISO damgası. */
function istanbulInstant(local: string): string | null {
  if (!local) return null;
  const d = new Date(`${local}:00+03:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Toplantıyı düzenleme yetkisi: kurucusu ya da yönetici. */
async function loadEditable(supabase: any, profile: any, id: string) {
  const { data: m } = await supabase.from('meetings')
    .select('id, company_id, created_by, title, status').eq('id', id).maybeSingle();
  if (!m) return { error: 'Toplantı bulunamadı.' as const };
  if (!(isAdmin(profile.role) || m.created_by === profile.id)) {
    return { error: 'Bu toplantıyı yalnızca kurucusu veya yönetici düzenleyebilir.' as const };
  }
  return { meeting: m };
}

async function notifyInvitees(
  supabase: any, companyId: string, userIds: string[],
  title: string, body: string
) {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;
  await supabase.from('notifications').insert(ids.map(user_id => ({
    company_id: companyId, user_id, type: 'custom',
    payload: { title, body, url: '/meetings' }
  })));
  pushToUsers(ids, { title, body, url: '/meetings' }).catch(() => {});
}

const MeetingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(8000).optional().default(''),
  location: z.string().max(200).optional().default(''),
  meeting_at: z.string().max(30).optional().default(''),
  department_id: z.string().uuid().optional().nullable(),
  participants: z.array(z.string().uuid()).max(200).default([])
});

/** Yeni toplantı aç + davetlileri ekle. */
export async function createMeeting(formData: FormData) {
  const parsed = MeetingSchema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    location: String(formData.get('location') ?? '').trim(),
    meeting_at: String(formData.get('meeting_at') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '') || null,
    participants: formData.getAll('participants').map(String).filter(Boolean)
  });
  if (!parsed.success) return { error: 'Toplantı konusu en az 3 karakter olmalıdır.' };
  const i = parsed.data;

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  if (i.department_id) {
    const { data: dept } = await supabase.from('departments')
      .select('id').eq('id', i.department_id).eq('company_id', companyId).maybeSingle();
    if (!dept) return { error: 'Geçersiz departman seçimi.' };
  }

  const when = i.meeting_at ? istanbulInstant(i.meeting_at) : null;
  if (i.meeting_at && !when) return { error: 'Toplantı tarihi okunamadı.' };

  // güvenlik: davetliler bu şirketin kullanıcıları olmalı
  let invitees: string[] = [];
  if (i.participants.length) {
    const { data: valid } = await supabase.from('profiles')
      .select('id').eq('company_id', companyId).in('id', i.participants);
    invitees = (valid ?? []).map((p: any) => p.id);
    if (invitees.length !== i.participants.length) {
      return { error: 'Davetlilerden bazıları bu şirkete ait değil.' };
    }
  }

  const { data: meeting, error } = await supabase.from('meetings').insert({
    company_id: companyId,
    department_id: i.department_id,
    created_by: profile.id,
    title: i.title,
    description: i.description || null,
    location: i.location || null,
    meeting_at: when
  }).select('id').single();
  if (error) return { error: error.message };

  const rows = Array.from(new Set([profile.id, ...invitees])).map(user_id => ({
    meeting_id: meeting.id, user_id, is_organizer: user_id === profile.id
  }));
  const { error: pErr } = await supabase.from('meeting_participants').insert(rows);
  if (pErr) return { error: pErr.message };

  const whenTxt = when
    ? new Date(when).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      })
    : 'tarih belirtilmedi';
  await notifyInvitees(supabase, companyId, invitees.filter(id => id !== profile.id),
    '📅 Toplantıya davet edildiniz', `${i.title} · ${whenTxt}`);

  revalidatePath('/meetings');
  return { ok: true, id: meeting.id };
}

const UpdateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(8000).optional().default(''),
  outcome: z.string().max(8000).optional().default(''),
  location: z.string().max(200).optional().default(''),
  meeting_at: z.string().max(30).optional().default('')
});

/** Konu / açıklama / değerlendirme sonucu güncelle. */
export async function updateMeeting(id: string, formData: FormData) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz toplantı.' };
  const parsed = UpdateSchema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    outcome: String(formData.get('outcome') ?? '').trim(),
    location: String(formData.get('location') ?? '').trim(),
    meeting_at: String(formData.get('meeting_at') ?? '').trim()
  });
  if (!parsed.success) return { error: 'Toplantı konusu en az 3 karakter olmalıdır.' };
  const i = parsed.data;

  const { supabase, profile } = await getCtx();
  const guard = await loadEditable(supabase, profile, id);
  if ('error' in guard) return { error: guard.error };

  const when = i.meeting_at ? istanbulInstant(i.meeting_at) : null;
  if (i.meeting_at && !when) return { error: 'Toplantı tarihi okunamadı.' };

  const { data, error } = await supabase.from('meetings').update({
    title: i.title,
    description: i.description || null,
    outcome: i.outcome || null,
    location: i.location || null,
    meeting_at: when
  }).eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Toplantı güncellenemedi.' };

  revalidatePath('/meetings');
  return { ok: true };
}

/** Yalnızca değerlendirme sonucunu kaydet (toplantı odasındaki sekme). */
export async function saveMeetingOutcome(id: string, outcome: string) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz toplantı.' };
  const { supabase, profile } = await getCtx();
  const guard = await loadEditable(supabase, profile, id);
  if ('error' in guard) return { error: guard.error };

  const { data, error } = await supabase.from('meetings')
    .update({ outcome: outcome.trim().slice(0, 8000) || null }).eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Değerlendirme kaydedilemedi.' };

  revalidatePath('/meetings');
  return { ok: true };
}

/** Toplantı durumunu değiştir: tamamlandı / iptal / planlandı. */
export async function setMeetingStatus(id: string, status: 'scheduled' | 'done' | 'cancelled') {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz toplantı.' };
  if (!['scheduled', 'done', 'cancelled'].includes(status)) return { error: 'Geçersiz durum.' };
  const { supabase, profile } = await getCtx();
  const guard = await loadEditable(supabase, profile, id);
  if ('error' in guard) return { error: guard.error };

  const { data, error } = await supabase.from('meetings')
    .update({ status }).eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Durum güncellenemedi.' };

  revalidatePath('/meetings');
  return { ok: true };
}

/** Toplantı odasına kullanıcı davet et. */
export async function inviteToMeeting(id: string, userIds: string[]) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz toplantı.' };
  const ids = Array.from(new Set(userIds.filter(u => uuid.safeParse(u).success)));
  if (!ids.length) return { error: 'En az bir kullanıcı seçin.' };

  const { supabase, profile } = await getCtx();
  const guard = await loadEditable(supabase, profile, id);
  if ('error' in guard) return { error: guard.error };
  const meeting = guard.meeting;

  const { data: valid } = await supabase.from('profiles')
    .select('id').eq('company_id', meeting.company_id).in('id', ids);
  const okIds = (valid ?? []).map((p: any) => p.id);
  if (!okIds.length) return { error: 'Seçilen kullanıcılar bu şirkete ait değil.' };

  const { data: existing } = await supabase.from('meeting_participants')
    .select('user_id').eq('meeting_id', id);
  const already = new Set((existing ?? []).map((p: any) => p.user_id));
  const fresh = okIds.filter((u: string) => !already.has(u));
  if (!fresh.length) return { error: 'Seçilenler zaten toplantı odasında.' };

  const { error } = await supabase.from('meeting_participants')
    .insert(fresh.map((user_id: string) => ({ meeting_id: id, user_id })));
  if (error) return { error: error.message };

  await notifyInvitees(supabase, meeting.company_id, fresh.filter((u: string) => u !== profile.id),
    '📅 Toplantıya davet edildiniz', meeting.title);

  revalidatePath('/meetings');
  return { ok: true, added: fresh.length };
}

/** Davetliyi çıkar (kurucu çıkarılamaz). */
export async function removeFromMeeting(id: string, userId: string) {
  if (!uuid.safeParse(id).success || !uuid.safeParse(userId).success) {
    return { error: 'Geçersiz istek.' };
  }
  const { supabase, profile } = await getCtx();
  const guard = await loadEditable(supabase, profile, id);
  if ('error' in guard) return { error: guard.error };
  if (guard.meeting.created_by === userId) {
    return { error: 'Toplantıyı açan kişi odadan çıkarılamaz.' };
  }

  const { data, error } = await supabase.from('meeting_participants')
    .delete().eq('meeting_id', id).eq('user_id', userId).select('user_id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Bu kişi zaten odada değil.' };

  revalidatePath('/meetings');
  return { ok: true };
}

/** Toplantı odasına not / mesaj yaz (yalnızca davetliler ve yöneticiler). */
export async function addMeetingNote(id: string, body: string) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz toplantı.' };
  const text = body.trim();
  if (text.length < 1) return { error: 'Not boş olamaz.' };
  if (text.length > 4000) return { error: 'Not çok uzun.' };

  const { supabase, profile } = await getCtx();
  // RLS zaten kısıtlar; yine de erişimi doğrula (sessiz hata olmasın)
  const { data: m } = await supabase.from('meetings')
    .select('id, company_id').eq('id', id).maybeSingle();
  if (!m) return { error: 'Toplantı bulunamadı veya erişiminiz yok.' };

  const { error } = await supabase.from('meeting_notes').insert({
    meeting_id: id, company_id: m.company_id, author_id: profile.id, body: text
  });
  if (error) return { error: error.message };

  revalidatePath('/meetings');
  return { ok: true };
}

export async function deleteMeetingNote(noteId: string) {
  if (!uuid.safeParse(noteId).success) return { error: 'Geçersiz not.' };
  const { supabase, profile } = await getCtx();
  const { data: note } = await supabase.from('meeting_notes')
    .select('id, author_id').eq('id', noteId).maybeSingle();
  if (!note) return { error: 'Not bulunamadı.' };
  if (note.author_id !== profile.id && !isAdmin(profile.role)) {
    return { error: 'Yalnızca kendi notunuzu silebilirsiniz.' };
  }
  const { error } = await supabase.from('meeting_notes').delete().eq('id', noteId);
  if (error) return { error: error.message };
  revalidatePath('/meetings');
  return { ok: true };
}

/** Toplantıyı sil (kurucu ya da yönetici). */
export async function deleteMeeting(id: string) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz toplantı.' };
  const { supabase, profile } = await getCtx();
  const guard = await loadEditable(supabase, profile, id);
  if ('error' in guard) return { error: guard.error };

  const { data, error } = await supabase.from('meetings').delete().eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Toplantı silinemedi.' };
  revalidatePath('/meetings');
  return { ok: true };
}
