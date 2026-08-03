import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { logout } from '@/app/login/actions';
import { ROLE_LABEL } from '@/lib/utils';
import {
  Home, Calendar, Megaphone, PlusSquare, LayoutTemplate,
  Users, Building2, Landmark, LogOut
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, companyId } = await getCtx();

  let companyName = 'Lole Yönetim';
  if (companyId) {
    const { data: c } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
    if (c) companyName = c.name;
  } else if (profile.role === 'super_admin') {
    companyName = 'Tüm Şirketler';
  }

  const isManagerRole = ['super_admin', 'admin', 'manager'].includes(profile.role);
  const isAdminRole = ['super_admin', 'admin'].includes(profile.role);

  const nav = [
    { href: '/home', label: 'Ana Sayfa', icon: Home, show: true },
    { href: '/calendar', label: 'Takvim', icon: Calendar, show: true },
    { href: '/announcements', label: 'Duyurular', icon: Megaphone, show: true },
    { href: '/manage/tasks/new', label: 'Görev Oluştur', icon: PlusSquare, show: isManagerRole },
    { href: '/manage/templates', label: 'Şablonlar', icon: LayoutTemplate, show: isManagerRole },
    { href: '/admin/users', label: 'Kullanıcılar', icon: Users, show: isAdminRole },
    { href: '/admin/departments', label: 'Departmanlar', icon: Building2, show: isAdminRole },
    { href: '/super/companies', label: 'Şirketler', icon: Landmark, show: profile.role === 'super_admin' }
  ].filter(n => n.show);

  return (
    <div className="min-h-dvh flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white p-4 sticky top-0 h-dvh">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">L</div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{companyName}</p>
            <p className="text-xs text-slate-400">Lole Yönetim</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              <n.icon size={18} strokeWidth={2} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 pt-3 mt-3">
          <div className="px-3 pb-2">
            <p className="text-sm font-medium truncate">{profile.full_name || profile.email}</p>
            <p className="text-xs text-slate-400">{ROLE_LABEL[profile.role]}</p>
          </div>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
              <LogOut size={16} /> Çıkış yap
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-20 md:pb-0">
        {children}
      </div>

      {/* Bottom bar — mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 flex justify-around py-2 z-40">
        {nav.slice(0, 5).map(n => (
          <Link key={n.href} href={n.href}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-slate-500">
            <n.icon size={20} strokeWidth={2} />
            {n.label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
