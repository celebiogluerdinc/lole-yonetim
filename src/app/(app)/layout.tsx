import { getCtx } from '@/lib/auth';
import { logout } from '@/app/login/actions';
import { ROLE_LABEL } from '@/lib/utils';
import NavLink, { type IconName } from '@/components/NavLink';
import MobileMenu from '@/components/MobileMenu';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  // same rule the /manage pages enforce — "manager" role alone isn't enough,
  // the user must actually manage a department (or be an admin)
  const isManagerRole = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const isAdminRole = ['super_admin', 'admin'].includes(profile.role);

  const [
    companyRes, { count: unreadCount }, appNameRes,
    { count: msgUnreadCount }, annRes, annReadRes, { count: reviewCount }, myAssignedRes
  ] = await Promise.all([
    companyId
      ? supabase.from('companies').select('name').eq('id', companyId).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .is('read_at', null),
    supabase.from('app_settings').select('value').eq('key', 'app_name').maybeSingle(),
    // okunmamış mesaj sayısı (sohbet açılınca otomatik temizlenir)
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('type', 'message').is('read_at', null),
    // okunmamış duyuru: şirket duyuruları − okuduklarım
    companyId
      ? supabase.from('announcements').select('id').eq('company_id', companyId).limit(200)
      : Promise.resolve({ data: [] } as any),
    supabase.from('announcement_reads').select('announcement_id').eq('user_id', profile.id),
    // yöneticiler: onay bekleyen görev sayısı
    isManagerRole && companyId
      ? supabase.from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('status', 'pending_review')
      : Promise.resolve({ count: 0 } as any),
    // bana atanan açık görevler (bugün + geciken → Ana Sayfa rozeti)
    supabase.from('task_assignees').select('tasks(status, due_at)').eq('user_id', profile.id)
  ]);
  const appName = appNameRes?.data?.value ?? 'Lole Yönetim';
  let companyName = appName;
  if (companyRes?.data) companyName = companyRes.data.name;
  else if (profile.role === 'super_admin') companyName = 'Tüm Şirketler';
  const unread = unreadCount ?? 0;
  const msgUnread = msgUnreadCount ?? 0;

  const readSet = new Set((annReadRes?.data ?? []).map((r: any) => r.announcement_id));
  const annUnread = (annRes?.data ?? []).filter((a: any) => !readSet.has(a.id)).length;

  const now = Date.now();
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const myToday = (myAssignedRes?.data ?? [])
    .map((r: any) => r.tasks).filter(Boolean)
    .filter((t: any) => !['completed', 'cancelled'].includes(t.status) && t.due_at &&
      (new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(t.due_at)) === todayIst
        || new Date(t.due_at).getTime() < now)).length;

  const nav = ([
    { href: '/home', label: 'Ana Sayfa', icon: 'home', show: true, badge: myToday },
    { href: '/search', label: 'Arama', icon: 'search', show: true, badge: 0 },
    { href: '/messages', label: 'Mesajlar', icon: 'chat', show: true, badge: msgUnread },
    { href: '/assistant', label: 'Lole Asistan', icon: 'sparkles', show: !!process.env.ANTHROPIC_API_KEY, badge: 0 },
    { href: '/notifications', label: 'Bildirimler', icon: 'bell', show: true, badge: unread },
    { href: '/calendar', label: 'Takvim', icon: 'calendar', show: true, badge: 0 },
    { href: '/announcements', label: 'Duyurular', icon: 'megaphone', show: true, badge: annUnread },
    { href: '/performance', label: 'Performans', icon: 'chart', show: true, badge: 0 },
    { href: '/purchasing', label: 'Satın Alma', icon: 'cart', show: true, badge: 0 },
    { href: '/payments', label: 'Ödeme Talepleri', icon: 'wallet', show: true, badge: 0 },
    { href: '/shifts', label: 'Vardiyalar', icon: 'shift', show: true, badge: 0 },
    { href: '/leave', label: 'İzinler', icon: 'leave', show: true, badge: 0 },
    { href: '/clock', label: 'Mesai', icon: 'clock', show: true, badge: 0 },
    { href: '/files', label: 'Dosyalar', icon: 'folder', show: true, badge: 0 },
    { href: '/manage/tasks', label: 'Görevler', icon: 'tasks', show: isManagerRole, badge: reviewCount ?? 0 },
    { href: '/manage/templates', label: 'Şablonlar', icon: 'template', show: isManagerRole, badge: 0 },
    { href: '/admin/users', label: 'Kullanıcılar', icon: 'users', show: isAdminRole, badge: 0 },
    { href: '/admin/departments', label: 'Departmanlar', icon: 'building', show: isAdminRole, badge: 0 },
    { href: '/admin/settings', label: 'Yönetim Paneli', icon: 'settings', show: isAdminRole, badge: 0 },
    { href: '/super/companies', label: 'Şirketler', icon: 'landmark', show: true, badge: 0 },
    { href: '/profile', label: 'Profilim', icon: 'profile', show: true, badge: 0 }
  ] as const).filter(n => n.show) as unknown as { href: string; label: string; icon: IconName; show: boolean; badge: number }[];

  return (
    <ConfirmProvider>
    <div className="min-h-dvh flex">
      {/* Sidebar — desktop (macOS Reminders style) */}
      <aside className="hidden md:flex w-60 flex-col border-r border-white/[0.08] bg-[#141416] p-4 sticky top-0 h-dvh overflow-y-auto overscroll-contain
        [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
        <Link href="/super/companies" title="Şirketler sayfasını aç"
          className="flex items-center gap-2.5 px-2 mb-6 rounded-xl py-1 -mx-1 hover:bg-white/[0.05] transition-colors">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-bold shadow-sm">
            {appName[0]?.toUpperCase() ?? 'L'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{companyName}</p>
            <p className="text-xs text-[#8E8E93]">{appName}</p>
          </div>
        </Link>
        {/* menü uzunsa kenar çubuğunun tamamı kayar — fare tekerleği her yerde çalışır */}
        <nav className="space-y-1 pb-3">
          {nav.map(n => (
            <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} badge={n.badge} />
          ))}
        </nav>
        <div className="border-t border-white/[0.08] pt-3 mt-auto">
          <Link href="/profile" className="flex items-center gap-2.5 px-3 pb-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
              {(profile.full_name || profile.email)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile.full_name || profile.email}</p>
              <p className="text-xs text-[#8E8E93]">{ROLE_LABEL[profile.role]}</p>
            </div>
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#8E8E93] hover:bg-white/[0.07] transition-colors">
              <LogOut size={16} /> Çıkış yap
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-20 md:pb-0">
        {children}
      </div>

      {/* Bottom bar — mobile: 4 quick tabs + full menu sheet */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#1C1C1E]/85 backdrop-blur-xl border-t border-white/[0.10] flex justify-around py-1.5 z-40 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {nav.slice(0, 4).map(n => (
          <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} badge={n.badge} mobile
            short={({ 'Ana Sayfa': 'Anasayfa', 'Lole Asistan': 'Asistan', 'Bildirimler': 'Bildirim', 'Ödeme Talepleri': 'Ödeme', 'Satın Alma': 'Satın Al' } as Record<string, string>)[n.label] ?? n.label} />
        ))}
        <MobileMenu
          items={nav.map(({ href, label, icon, badge }) => ({ href, label, icon, badge }))}
          userName={profile.full_name || profile.email}
          roleLabel={ROLE_LABEL[profile.role]}
        />
      </nav>
    </div>
    </ConfirmProvider>
  );
}
