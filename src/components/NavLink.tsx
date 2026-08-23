'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Calendar, Megaphone, PlusSquare, LayoutTemplate,
  Users, Building2, Landmark, MessageCircle, Bell, BarChart3, Sparkles,
  CalendarClock, Plane, Clock, ClipboardList, Settings, UserCircle2,
  ShoppingCart, Wallet, Search, FolderOpen, ShieldAlert, Presentation,
  type LucideIcon
} from 'lucide-react';

const META: Record<string, { Icon: LucideIcon; color: string }> = {
  home: { Icon: Home, color: '#007AFF' },
  chat: { Icon: MessageCircle, color: '#34C759' },
  sparkles: { Icon: Sparkles, color: '#5E5CE6' },
  bell: { Icon: Bell, color: '#FF3B30' },
  calendar: { Icon: Calendar, color: '#FF3B30' },
  megaphone: { Icon: Megaphone, color: '#FF9500' },
  chart: { Icon: BarChart3, color: '#5856D6' },
  tasks: { Icon: ClipboardList, color: '#007AFF' },
  shift: { Icon: CalendarClock, color: '#FF9500' },
  leave: { Icon: Plane, color: '#30B0C7' },
  clock: { Icon: Clock, color: '#34C759' },
  plus: { Icon: PlusSquare, color: '#30B0C7' },
  template: { Icon: LayoutTemplate, color: '#5856D6' },
  users: { Icon: Users, color: '#AF52DE' },
  building: { Icon: Building2, color: '#8E8E93' },
  settings: { Icon: Settings, color: '#8E8E93' },
  landmark: { Icon: Landmark, color: '#FF9500' },
  profile: { Icon: UserCircle2, color: '#0A84FF' },
  cart: { Icon: ShoppingCart, color: '#FF9F0A' },
  wallet: { Icon: Wallet, color: '#30D158' },
  search: { Icon: Search, color: '#64D2FF' },
  folder: { Icon: FolderOpen, color: '#30B0C7' },
  incident: { Icon: ShieldAlert, color: '#FF375F' },
  meeting: { Icon: Presentation, color: '#BF5AF2' }
};

export type IconName = keyof typeof META;

/** Bare icon lookup — used by the mobile menu sheet. */
export function NavIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const { Icon } = META[name] ?? META.home;
  return <Icon size={size} strokeWidth={2} />;
}

function Badge({ n, mobile }: { n: number; mobile?: boolean }) {
  if (!n) return null;
  return (
    <span className={`${mobile ? 'absolute -top-0.5 -right-1.5' : 'ml-auto'} min-w-[18px] h-[18px] px-1 rounded-full bg-ios-red text-white text-[11px] font-semibold flex items-center justify-center leading-none`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

export default function NavLink({
  href, label, icon, mobile = false, badge = 0, short
}: { href: string; label: string; icon: IconName; mobile?: boolean; badge?: number; short?: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
  const { Icon, color } = META[icon] ?? META.home;

  if (mobile) {
    return (
      <Link href={href}
        className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
          active ? 'text-ios-blue' : 'text-[#8E8E93]'}`}>
        <span className="relative">
          <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
          <Badge n={badge} mobile />
        </span>
        {short ?? label}
      </Link>
    );
  }

  return (
    <Link href={href}
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] transition-colors ${
        active ? 'bg-[#2C2C2E] text-white shadow-sm font-semibold' : 'text-[#D1D1D6] hover:bg-white/[0.07]'}`}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: color }}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      {label}
      <Badge n={badge} />
    </Link>
  );
}
