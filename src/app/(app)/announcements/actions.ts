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

export async function markAnnouncementsRead(ids: string[]) {
  if (!ids.length) return { ok: true };
  const { supabase, profile } = await getCtx();
  await supabase.from('announcement_reads').upsert(
    ids.map(announcement_id => ({ announcement_id, user_id: profile.id })),
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }
  );
  return { ok: true };
}
