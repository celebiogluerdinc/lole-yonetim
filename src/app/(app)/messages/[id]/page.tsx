import { notFound } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import ChatThread from '@/components/ChatThread';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await getCtx();

  const { data: conv } = await supabase
    .from('conversations').select('*').eq('id', params.id).maybeSingle();
  if (!conv) notFound();

  const [{ data: members }, { data: msgs }] = await Promise.all([
    supabase
      .from('conversation_members')
      .select('user_id, profiles:user_id(full_name)')
      .eq('conversation_id', conv.id),
    supabase
      .from('messages')
      .select('id, sender_id, body, created_at, deleted_at')
      .eq('conversation_id', conv.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(300)
  ]);

  const names: Record<string, string> = {};
  for (const m of members ?? []) names[m.user_id] = (m as any).profiles?.full_name ?? 'Kullanıcı';

  const others = (members ?? []).filter((m: any) => m.user_id !== profile.id);
  const title = conv.type === 'group'
    ? (conv.name ?? 'Grup')
    : (names[others[0]?.user_id] ?? 'Sohbet');
  const subtitle = conv.type === 'group'
    ? `${(members ?? []).length} üye`
    : '';

  return (
    <ChatThread
      conversationId={conv.id}
      meId={profile.id}
      title={title}
      subtitle={subtitle}
      isGroup={conv.type === 'group'}
      names={names}
      messages={(msgs ?? []) as any}
    />
  );
}
