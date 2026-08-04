'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, LogOut, QrCode } from 'lucide-react';
import { clockIn, clockOut } from '@/app/(app)/hr/actions';

interface Row { id: string; day: string; in: string; out: string | null; hours: number | null; method: string; }
interface TeamRow { id: string; name: string; in: string; out: string | null; method: string; }

export default function ClockClient({
  open, viaQr, rows, weekTotal, team, isManager, isAdmin
}: {
  open: { since: string } | null; viaQr: boolean; rows: Row[];
  weekTotal: number; team: TeamRow[]; isManager: boolean; isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<any>) => start(async () => {
    setError(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else router.refresh();
  });

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Mesai</h1>
          <p className="text-[14px] text-[#8E8E93]">
            Bu hafta toplam <b className="text-[#1c1c1e]">{weekTotal} saat</b>
          </p>
        </div>
        {isAdmin && (
          <Link href="/admin/qr" className="btn-outline text-[13px]"><QrCode size={15} /> QR Kod</Link>
        )}
      </header>

      {error && <p className="text-[13px] text-ios-red bg-rose-50 rounded-xl px-3 py-2">{error}</p>}

      {/* Big clock button */}
      <div className="card p-6 text-center">
        {open ? (
          <>
            <p className="text-[15px] text-[#8E8E93]">Mesai açık · giriş {open.since}</p>
            <button
              disabled={pending}
              onClick={() => run(() => clockOut())}
              className="mt-4 w-40 h-40 mx-auto rounded-full bg-ios-red text-white flex flex-col items-center justify-center gap-1 shadow-lg shadow-rose-200 active:scale-95 transition-transform"
            >
              <LogOut size={34} />
              <span className="text-[17px] font-bold">Çıkış Yap</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-[#8E8E93]">
              {viaQr ? 'QR kod okundu — mesainizi başlatın' : 'Mesainiz kapalı'}
            </p>
            <button
              disabled={pending}
              onClick={() => run(() => clockIn(viaQr ? 'qr' : 'manual'))}
              className="mt-4 w-40 h-40 mx-auto rounded-full bg-ios-green text-white flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
            >
              <LogIn size={34} />
              <span className="text-[17px] font-bold">Giriş Yap</span>
            </button>
            {!viaQr && (
              <p className="text-[12px] text-[#AEAEB2] mt-3">
                İşyerindeki QR kodu okutarak girerseniz kayıt &quot;QR&quot; olarak işaretlenir.
              </p>
            )}
          </>
        )}
      </div>

      {/* My entries */}
      <section>
        <h2 className="section-title">Son Kayıtlarım</h2>
        <div className="card divide-y divide-black/[0.06] overflow-hidden">
          {rows.length === 0 && (
            <p className="p-8 text-center text-[15px] text-[#8E8E93]">Henüz mesai kaydınız yok.</p>
          )}
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 min-w-0">
                <p className="text-[14px] font-medium">{r.day}</p>
                <p className="text-[12px] text-[#8E8E93]">
                  {r.in} → {r.out ?? 'devam ediyor'} {r.method === 'qr' ? '· 📱 QR' : ''}
                </p>
              </span>
              <span className="text-[14px] font-semibold">
                {r.hours !== null ? `${r.hours} sa` : <span className="text-ios-green">●</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Team today (managers) */}
      {isManager && (
        <section>
          <h2 className="section-title">Bugün Ekip</h2>
          <div className="card divide-y divide-black/[0.06] overflow-hidden">
            {team.length === 0 && (
              <p className="p-6 text-center text-[14px] text-[#8E8E93]">Bugün ekipten mesai kaydı yok.</p>
            )}
            {team.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-[14px] font-medium truncate">{t.name}</span>
                <span className="text-[13px] text-[#8E8E93]">
                  {t.in} → {t.out ?? <span className="text-ios-green font-medium">çalışıyor</span>}
                  {t.method === 'qr' ? ' · 📱' : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
