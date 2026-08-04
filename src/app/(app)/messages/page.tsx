import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import NewChat from '@/components/NewChat';
import { TZ } from '@/lib/utils';
import { Users2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5856D6', '#30B0C7'];
const colorFor = (s: string) =>
  AVATAR_COLORS[s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('tr-TR', { timeZone: TZ });
  if (d.toLocaleDateString('tr-TR', { timeZone: TZ }) === today) {
    return d.toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short' });
}

export default async function MessagesPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const [{ data: memberships }, { data: people }] = await Promise.all([
    supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at, conversations!inner(id, type, name, company_id)')
      .eq('user_id', profile.id)
      .eq('conversations.company_id', companyId),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .neq('id', profile.id)
      .order('full_name')
  ]);

  const convIds = (memberships ?? []).map((m: any) => m.conversation_id);
  let rows: any[] = [];

  if (convIds.length) {
    const [{ data: allMembers }, { data: msgs }] = await Promise.all([
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id, profiles:user_id(full_name)')
        .in('conversation_id', convIds),
      supabase
        .from('messages')
        .select('conversation_id, sender_id, body, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(400)
    ]);

    rows = (memberships ?? []).map((m: any) => {
      const conv = m.conversations;
      const members = (allMembers ?? []).filter((x: any) => x.conversation_id === conv.id);
      const others = members.filter((x: any) => x.user_id !== profile.id);
      const title = conv.type === 'group'
        ? (conv.name ?? 'Grup')
        : ((others[0] as any)?.profiles?.full_name ?? 'Sohbet');
      const convMsgs = (msgs ?? []).filter((x: any) => x.conversation_id === conv.id);
      const last = convMsgs[0];
      const unread = convMsgs.filter((x: any) =>
        x.sender_id !== profile.id &&
        (!m.last_read_at || x.created_at > m.last_read_at)
      ).length;
      return { id: conv.id, type: conv.type, title, memberCount: members.length, last, unread };
    }).sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''));
  }

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Mesajlar</h1>
        <NewChat people={(people ?? []) as any} />
      </header>

      <div className="card divide-y divide-black/[0.06] overflow-hidden">
        {rows.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-[15px] text-[#8E8E93]">
              Henüz sohbet yok. Sağ üstten yeni bir sohbet başlatın.
            </p>
          </div>
        )}
        {rows.map(r => (
          <Link key={r.id} href={`/messages/${r.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors">
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
              style={{ backgroundColor: colorFor(r.title) }}
            >
              {r.type === 'group' ? <Users2 size={19} /> : r.title[0]?.toUpperCase()}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <p className="text-[16px] font-semibold truncate">{r.title}</p>
                {r.last && (
                  <p className="text-[13px] text-[#8E8E93] shrink-0">{timeLabel(r.last.created_at)}</p>
                )}
              </span>
              <span className="flex items-center justify-between gap-2">
                <p className="text-[14px] text-[#8E8E93] truncate">
                  {r.last
                    ? `${r.last.sender_id === profile.id ? 'Siz: ' : ''}${r.last.body}`
                    : r.type === 'group' ? `${r.memberCount} üye` : 'Sohbeti başlatın'}
                </p>
                {r.unread > 0 && (
                  <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-ios-blue text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
                    {r.unread > 99 ? '99+' : r.unread}
                  </span>
                )}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
