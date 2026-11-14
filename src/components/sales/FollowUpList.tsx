'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle, CalendarClock, MapPin } from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { deleteFollowUp } from '@/app/(app)/sales/actions';
import FollowUpClose from '@/components/sales/FollowUpClose';
import { FOLLOWUP_RESULT_LABEL } from '@/lib/sales-types';
import DeleteButton from '@/components/sales/DeleteButton';
import { addOutletsToDay } from '@/app/(app)/sales/routes/actions';

interface Row {
  id: string;
  action: string;
  due_date: string;
  status: 'acik' | 'kapandi' | 'iptal';
  source_type: string;
  closure_evidence: string | null;
  verified_at: string | null;
  result: 'kazanildi' | 'kaybedildi' | 'devam' | null;
  outlet_id: string | null;
  outlets: { id: string; name: string } | null;
  profiles: { full_name: string } | null;
}

const SOURCE_LABEL: Record<string, string> = {
  visit: 'Ziyaret',
  tasting: 'Tadım',
  assessment: 'Değerlendirme',
  quote: 'Teklif',
  order: 'Sipariş',
  opening: 'Açılış',
  training: 'Eğitim',
  stock: 'Stok',
  reorder: 'Tekrar sipariş',
  complaint: 'Şikâyet',
  manual: 'Elle'
};

/**
 * Tüm formların "Sonraki adım ve kontrol" blokları tek listede.
 *
 * Kapatmak için kapanış kanıtı zorunlu — kanıtsız kapanış, kapanmamış
 * takiple aynı şeydir ve kapanış oranını yapay olarak yükseltir.
 */
export default function FollowUpList({
  rows, today, reasons = [], loadError
}: {
  rows: Row[]; today: string;
  reasons?: { id: string; label: string }[];
  /** Sorgu hatası: sessiz boş liste yerine görünür uyarı */
  loadError?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);

  const groups = useMemo(() => {
    const open = rows.filter(r => r.status === 'acik');
    return {
      overdue: open.filter(r => r.due_date < today),
      today: open.filter(r => r.due_date === today),
      upcoming: open.filter(r => r.due_date > today),
      closed: rows.filter(r => r.status === 'kapandi').slice(0, 30)
    };
  }, [rows, today]);

  const [msg, setMsg] = useState<string | null>(null);

  /**
   * Takibi bugünün rotasına atar.
   *
   * Eskiden temsilci geciken bir takibi görüp onu ziyaret etmek için Rota
   * sekmesine gidip durak eklemek, nokta aramak zorundaydı. Gecikmiş iş
   * tam da o yüzden gecikmeye devam ediyordu. Artık tek dokunuş.
   */
  function toRoute(outletId: string) {
    setErr(null); setMsg(null);
    start(async () => {
      const r = await addOutletsToDay([outletId]);
      if (r?.error) { setErr(r.error); return; }
      setMsg('Nokta bugünün rotasına eklendi.');
      router.refresh();
    });
  }

  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length;

  return (
    <main className="py-5 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Takipler</h1>
        <p className="text-[14px] text-[#8E8E93]">
          {openCount} açık
          {groups.overdue.length > 0 && <span className="text-rose-300"> · {groups.overdue.length} gecikmiş</span>}
        </p>
      </header>

      {loadError && (
        <p className="alert-error">Takipler yüklenemedi: {loadError}</p>
      )}
      {err && <p className="alert-error">{err}</p>}
      {msg && (
        <p className="text-[13px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
          {msg}
        </p>
      )}

      {openCount === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-[15px] text-[#8E8E93]">Açık takibiniz yok.</p>
        </div>
      )}

      <Group title="Gecikmiş" tone="bad" rows={groups.overdue}
        {...{ openFor, setOpenFor, reasons, pending, today, toRoute }} />
      <Group title="Bugün" tone="warn" rows={groups.today}
        {...{ openFor, setOpenFor, reasons, pending, today, toRoute }} />
      <Group title="Yaklaşan" rows={groups.upcoming}
        {...{ openFor, setOpenFor, reasons, pending, today, toRoute }} />

      {groups.closed.length > 0 && (
        <section className="card overflow-hidden">
          <p className="section-title px-5 pt-5 pb-3">Kapananlar</p>
          <div className="divide-y divide-white/[0.08]">
            {groups.closed.map(r => (
              <div key={r.id} className="px-5 py-3">
                <p className="text-sm text-[#8E8E93] truncate flex items-center gap-2">
                  <span className="line-through truncate">{r.action}</span>
                  {r.result && (
                    <span className={`badge shrink-0 no-underline ${
                      r.result === 'kazanildi' ? 'bg-emerald-500/20 text-emerald-300'
                        : r.result === 'kaybedildi' ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-ios-blue/20 text-ios-blue'}`}>
                      {FOLLOWUP_RESULT_LABEL[r.result]}
                    </span>
                  )}
                </p>
                {r.closure_evidence && (
                  <p className="text-[12px] text-emerald-300 mt-0.5">Kanıt: {r.closure_evidence}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Group({
  title, tone, rows, openFor, setOpenFor, reasons, pending, toRoute
}: {
  title: string; tone?: 'bad' | 'warn'; rows: Row[];
  openFor: string | null; setOpenFor: (v: string | null) => void;
  reasons: { id: string; label: string }[];
  pending: boolean; today: string;
  toRoute: (outletId: string) => void;
}) {
  if (!rows.length) return null;
  const color = tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : '';

  return (
    <section className="card overflow-hidden">
      <p className={`section-title px-5 pt-5 pb-3 flex items-center gap-2 ${color}`}>
        {tone === 'bad' ? <AlertTriangle size={15} /> : <CalendarClock size={15} />}
        {title} <span className="text-[#8E8E93] font-normal">({rows.length})</span>
      </p>
      <div className="divide-y divide-white/[0.08]">
        {rows.map(r => (
          <div key={r.id} className="px-5 py-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] truncate">{r.action}</p>
                <p className="text-[13px] text-[#8E8E93]">
                  {r.outlets?.id
                    ? <Link href={`/sales/outlets/${r.outlets.id}`} className="hover:underline">{r.outlets.name}</Link>
                    : '—'}
                  {' · '}{SOURCE_LABEL[r.source_type] ?? r.source_type}
                  {r.profiles?.full_name ? ` · ${r.profiles.full_name}` : ''}
                </p>
              </div>
              <span className={`badge shrink-0 ${color ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-[#AEAEB2]'}`}>
                {fmtDate(r.due_date, false)}
              </span>
            </div>

            {openFor === r.id ? (
              <FollowUpClose id={r.id} reasons={reasons}
                onCancel={() => setOpenFor(null)} onDone={() => setOpenFor(null)} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOpenFor(r.id)}
                  className="min-h-[44px] rounded-lg bg-emerald-500/15 text-emerald-300 px-3.5 text-[13.5px] font-semibold flex items-center gap-1.5">
                  <Check size={15} /> Kapat
                </button>
                {r.outlet_id && (
                  <>
                    <button onClick={() => toRoute(r.outlet_id!)} disabled={pending}
                      className="btn-ghost !text-[13.5px]">
                      <MapPin size={14} /> Bugünün rotasına ekle
                    </button>
                    <Link href={`/sales/visits/new?outlet=${r.outlet_id}`}
                      className="btn-ghost !text-[13.5px]">
                      Ziyareti aç
                    </Link>
                  </>
                )}
                {/* Yanlış açılan takip gün boyu kırmızı rozet gösteriyordu */}
                <DeleteButton
                  message={`"${r.action}" takibi silinecek. Kapanış kanıtı gerekmeyen, yanlışlıkla açılmış takipler için.`}
                  action={() => deleteFollowUp(r.id)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
