import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import NotifAutoRead from '@/components/NotifAutoRead';
import PushSetup from '@/components/PushSetup';
import {
  ClipboardList, Clock, AlertCircle, CheckCircle2, ShieldQuestion,
  OctagonAlert, Undo2, Megaphone, MessageCircle, MessagesSquare, Bell
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const META: Record<string, { Icon: any; color: string; title: (p: any) => string; sub?: (p: any) => string }> = {
  task_assigned:      { Icon: ClipboardList, color: '#007AFF', title: p => 'Size yeni görev atandı', sub: p => p.title },
  due_soon:           { Icon: Clock, color: '#FF9500', title: p => 'Görevin süresi yaklaşıyor', sub: p => p.title },
  overdue:            { Icon: AlertCircle, color: '#FF3B30', title: p => 'Görev gecikti', sub: p => p.title },
  task_completed:     { Icon: CheckCircle2, color: '#34C759', title: p => `${p.by ?? 'Personel'} görevi tamamladı`, sub: p => p.title },
  task_pending_review:{ Icon: ShieldQuestion, color: '#FF9500', title: p => `Onayınızı bekliyor${p.by ? ` — ${p.by}` : ''}`, sub: p => p.title },
  task_blocked:       { Icon: OctagonAlert, color: '#FF3B30', title: p => `Engel bildirildi${p.by ? ` — ${p.by}` : ''}`, sub: p => p.title },
  task_rejected:      { Icon: Undo2, color: '#FF3B30', title: p => 'Göreviniz reddedildi', sub: p => p.note ?? p.title },
  announcement:       { Icon: Megaphone, color: '#FF9500', title: p => 'Yeni duyuru', sub: p => p.title },
  comment:            { Icon: MessagesSquare, color: '#5856D6', title: p => 'Yeni yorum', sub: p => p.title },
  message:            { Icon: MessageCircle, color: '#34C759', title: p => `${p.from ?? 'Yeni mesaj'}`, sub: p => p.preview },
  custom:             { Icon: Bell, color: '#007AFF', title: p => p.title ?? 'Bildirim', sub: p => p.body }
};

function linkFor(n: any): string | null {
  const p = n.payload ?? {};
  if (p.task_id) return `/tasks/${p.task_id}`;
  if (p.conversation_id) return `/messages/${p.conversation_id}`;
  // satın alma / sipariş / ödeme / olay kaydı bildirimleri kendi adresini taşır.
  // Güvenlik: yalnızca uygulama içi ("/" ile başlayan) adresler kabul edilir.
  if (typeof p.url === 'string' && p.url.startsWith('/') && !p.url.startsWith('//')) return p.url;
  if (n.type === 'announcement') return '/announcements';
  return null;
}

export default async function NotificationsPage() {
  const { supabase, profile } = await getCtx();

  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const hasUnread = (notifs ?? []).some(n => !n.read_at);

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Bildirimler</h1>
      </header>

      <NotifAutoRead hasUnread={hasUnread} />
      <PushSetup />

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {(notifs ?? []).length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">🔕</p>
            <p className="text-[15px] text-[#8E8E93]">Henüz bildiriminiz yok.</p>
          </div>
        )}
        {(notifs ?? []).map(n => {
          const meta = META[n.type] ?? META.custom;
          const href = linkFor(n);
          const inner = (
            <>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: meta.color }}>
                <meta.Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <p className={`text-[15px] truncate ${n.read_at ? '' : 'font-semibold'}`}>
                    {meta.title(n.payload ?? {})}
                  </p>
                  <p className="text-[12px] text-[#8E8E93] shrink-0">{fmtDate(n.created_at)}</p>
                </span>
                {meta.sub?.(n.payload ?? {}) && (
                  <p className="text-[13px] text-[#8E8E93] truncate">{meta.sub(n.payload ?? {})}</p>
                )}
              </span>
              {!n.read_at && <span className="w-2.5 h-2.5 rounded-full bg-ios-blue shrink-0 mt-1" />}
            </>
          );
          const cls = 'flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors';
          return href
            ? <Link key={n.id} href={href} className={cls}>{inner}</Link>
            : <div key={n.id} className={cls}>{inner}</div>;
        })}
      </div>
    </main>
  );
}
