'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

/** Start (or reopen) a 1-on-1 conversation with a coworker. */
export async function startDm(otherId: string) {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  if (otherId === profile.id) return { error: 'Kendinizle sohbet başlatamazsınız.' };

  // existing DM between us?
  const { data: mine } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner(type, company_id)')
    .eq('user_id', profile.id)
    .eq('conversations.type', 'dm')
    .eq('conversations.company_id', companyId);
  const ids = (mine ?? []).map((m: any) => m.conversation_id);
  if (ids.length) {
    const { data: other } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', ids);
    if (other?.length) redirect(`/messages/${other[0].conversation_id}`);
  }

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ company_id: companyId, type: 'dm', created_by: profile.id })
    .select().single();
  if (error) return { error: error.message };

  const { error: e2 } = await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: profile.id },
    { conversation_id: conv.id, user_id: otherId }
  ]);
  if (e2) return { error: e2.message };

  redirect(`/messages/${conv.id}`);
}

/** Create a named group conversation. */
export async function createGroup(formData: FormData) {
  const name = z.string().min(2).max(80).safeParse(String(formData.get('name') ?? '').trim());
  const members = formData.getAll('members').map(String);
  if (!name.success) return { error: 'Grup adı gerekli.' };
  if (members.length === 0) return { error: 'En az bir kişi seçin.' };

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ company_id: companyId, type: 'group', name: name.data, created_by: profile.id })
    .select().single();
  if (error) return { error: error.message };

  const rows = [profile.id, ...members]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(user_id => ({ conversation_id: conv.id, user_id }));
  const { error: e2 } = await supabase.from('conversation_members').insert(rows);
  if (e2) return { error: e2.message };

  redirect(`/messages/${conv.id}`);
}

/** Send a message into a conversation the user belongs to. */
export async function sendMessage(conversationId: string, body: string) {
  const text = z.string().min(1).max(4000).safeParse(body.trim());
  if (!text.success) return { error: 'Boş mesaj gönderilemez.' };

  const { supabase, profile } = await getCtx();

  // RLS guarantees we can only see conversations we belong to
  const { data: conv } = await supabase
    .from('conversations').select('id, company_id').eq('id', conversationId).maybeSingle();
  if (!conv) return { error: 'Sohbet bulunamadı.' };

  const { error } = await supabase.from('messages').insert({
    company_id: conv.company_id,
    conversation_id: conversationId,
    sender_id: profile.id,
    body: text.data
  });
  if (error) return { error: error.message };

  // in-app notification for other members
  const { data: others } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', profile.id);
  if (others?.length) {
    const ids = others.map((m: any) => m.user_id);
    await supabase.from('notifications').insert(ids.map((user_id: string) => ({
      company_id: conv.company_id,
      user_id,
      type: 'message',
      payload: { conversation_id: conversationId, from: profile.full_name, preview: text.data.slice(0, 80) }
    })));
    pushToUsers(ids, {
      title: profile.full_name,
      body: text.data.slice(0, 120),
      url: `/messages/${conversationId}`
    }).catch(() => {});
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath('/messages');
  return { ok: true };
}

/** Mark a conversation read for the current user. */
export async function markRead(conversationId: string) {
  const { supabase, profile } = await getCtx();
  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', profile.id);
  revalidatePath('/messages'); // okunmadı rozeti hemen güncellensin
  return { ok: true };
}
