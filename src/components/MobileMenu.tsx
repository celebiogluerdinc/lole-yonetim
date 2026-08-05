'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { logout } from '@/app/login/actions';
import { NavIcon, type IconName } from '@/components/NavLink';

interface Item { href: string; label: string; icon: IconName; badge: number; }

/** Mobile-only "Menü" sheet: every page + profile + logout, reachable from the bottom bar. */
export default function MobileMenu({
  items, userName, roleLabel
}: { items: Item[]; userName: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-0.5 px-3 py-1 text-[#8E8E93]"
        aria-label="Menü"
      >
        <Menu size={22} />
        <span className="text-[10px] font-medium">Menü</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-[#1C1C1E] border-t border-white/[0.10] p-5 pb-[max(1.2rem,env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[15px] font-semibold">{userName}</p>
                <p className="text-[12px] text-[#8E8E93]">{roleLabel}</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {items.map(n => {
                const active = pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-center ${
                      active ? 'bg-ios-blue/20 text-ios-blue' : 'bg-[#2C2C2E] text-[#D1D1D6]'
                    }`}
                  >
                    <NavIcon name={n.icon} size={20} />
                    <span className="text-[11px] font-medium leading-tight">{n.label}</span>
                    {n.badge > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ios-red text-white text-[10px] font-bold flex items-center justify-center">
                        {n.badge > 99 ? '99+' : n.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <form action={logout} className="mt-4">
              <button className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-500/15 text-rose-300 px-4 py-3 text-[14px] font-semibold">
                <LogOut size={16} /> Çıkış yap
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
