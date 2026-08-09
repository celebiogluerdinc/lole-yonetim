'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

export async function postAnnouncement(formData: FormData) {
  const schema = z.object({
    title: z.string().min(2).max(200),
    body: z.string().min(2).max(5000),
    department_id: z.string().uuid().optional().nullable(),
    is_pinned: z.boolean()
  });
  const parsed = schema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    department_id: String(formData.get('department_id') ?? '') || null,
    is_pinned: formData.get('is_pinned') === 'on'
  });
  if (!parsed.success) return { error: 'Başlık ve içerik zorunludur.' };
  const input = parsed.data;

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  if (!isAdmin) {
    // managers must target one of their departments
    if (!input.department_id || !managedDepartmentIds.includes(input.department_id)) {
      return { error: 'Yalnızca yönettiğiniz departmana duyuru yayınlayabilirsiniz.' };
    }
  }

  const { data: ann, error } = await supabase.from('announcements').insert({
    company_id: companyId,
    department_id: input.department_id,
    author_id: profile.id,
    title: input.title,
    body: input.body,
    is_pinned: input.is_pinned
  }).select().single();
  if (error) return { error: error.message };

  // in-app notifications to the audience
  let audience: string[] = [];
  if (input.department_id) {
    const { data } = await supabase
      .from('department_members').select('user_id').eq('department_id', input.department_id);
    audience = (data ?? []).map((m: any) => m.user_id);
  } else {
    const { data } = await supabase
      .from('profiles').select('id').eq('company_id', companyId).eq('is_active', true);
    audience = (data ?? []).map((p: any) => p.id);
  }
  audience = audience.filter(id => id !== profile.id);
  if (audience.length) {
    await supabase.from('notifications').insert(audience.map(user_id => ({
      company_id: companyId, user_id, type: 'announcement',
      payload: { announcement_id: ann.id, title: input.title }
    })));
    pushToUsers(audience, {
      title: `📌 ${input.title}`,
      body: input.body.slice(0, 120),
      url: '/announcements'
    }).catch(() => {});
  }

  revalidatePath('/announcements');
  revalidatePath('/home');
  return { ok: true };
}

/** Delete an announcement — admin, or the manager who can post to its department. */
export async function deleteAnnouncement(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz duyuru.' };
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: ann } = await supabase.from('announcements')
    .select('id, company_id, department_id, author_id').eq('id', id).maybeSingle();
  if (!ann || ann.company_id !== companyId) return { error: 'Duyuru bulunamadı.' };

  const canDelete = ['super_admin', 'admin'].includes(profile.role) ||
    (ann.department_id ? managedDepartmentIds.includes(ann.department_id) : false);
  if (!canDelete) return { error: 'Bu duyuruyu silme yetkiniz yok.' };

  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/announcements');
  revalidatePath('/home');
  return { ok: true };
}

/** Pin / unpin an announcement (same permission rule as delete). */
export async function togglePinAnnouncement(id: string, pinned: boolean) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz duyuru.' };
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: ann } = await supabase.from('announcements')
    .select('id, company_id, department_id').eq('id', id).maybeSingle();
  if (!ann || ann.company_id !== companyId) return { error: 'Duyuru bulunamadı.' };

  const canEdit = ['super_admin', 'admin'].includes(profile.role) ||
    (ann.department_id ? managedDepartmentIds.includes(ann.department_id) : false);
  if (!canEdit) return { error: 'Bu duyuruyu düzenleme yetkiniz yok.' };

  const { error } = await supabase.from('announcements').update({ is_pinned: pinned }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/announcements');
  revalidatePath('/home');
  return { ok: true };
}

/** Add a comment under an announcement (visible to everyone who sees it). */
export async function addAnnouncementComment(formData: FormData) {
  const annId = String(formData.get('announcement_id') ?? '');
  const body = z.string().min(1).max(1000).safeParse(String(formData.get('body') ?? '').trim());
  if (!z.string().uuid().safeParse(annId).success) return { error: 'Geçersiz duyuru.' };
  if (!body.success) return { error: 'Yorum boş olamaz (en fazla 1000 karakter).' };

  const { supabase, profile, companyId } = await getCtx();
  const { data: ann } = await supabase.from('announcements')
    .select('id, company_id, author_id, title').eq('id', annId).maybeSingle();
  if (!ann) return { error: 'Duyuru bulunamadı.' };

  const { error } = await supabase.from('announcement_comments').insert({
    announcement_id: annId, company_id: ann.company_id,
    author_id: profile.id, body: body.data
  });
  if (error) return { error: error.message };

  // duyuru sahibine haber ver
  if (ann.author_id && ann.author_id !== profile.id) {
    await supabase.from('notifications').insert({
      company_id: ann.company_id, user_id: ann.author_id, type: 'custom',
      payload: {
        title: '💬 Duyurunuza yorum yapıldı',
        body: `${profile.full_name}: ${body.data.slice(0, 80)}`,
        url: '/announcements'
      }
    });
    pushToUsers([ann.author_id], {
      title: '💬 Duyurunuza yorum yapıldı',
      body: `${profile.full_name}: ${body.data.slice(0, 80)}`,
      url: '/announcements'
    }).catch(() => {});
  }

  revalidatePath('/announcements');
  return { ok: true };
}

/** Delete an announcement comment (author or admin). */
export async function deleteAnnouncementComment(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz yorum.' };
  const { supabase, profile } = await getCtx();
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  let q = supabase.from('announcement_comments').delete().eq('id', id);
  if (!isAdmin) q = q.eq('author_id', profile.id);
  const { data, error } = await q.select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Yalnızca kendi yorumunuzu silebilirsiniz.' };
  revalidatePath('/announcements');
  return { ok: true };
}

export async function markAnnouncementsRead(ids: string[]) {
  if (!ids.length) return { ok: true };
  const { supabase, profile } = await getCtx();
  await supabase.from('announcement_reads').upsert(
    ids.map(announcement_id => ({ announcement_id, user_id: profile.id })),
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }
  );
  return { ok: true };
}
