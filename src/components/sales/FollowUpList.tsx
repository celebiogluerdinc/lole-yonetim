'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle, CalendarClock } from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { closeFollowUp } from '@/app/(app)/sales/actions';

interface Row {
  id: string;
  action: string;
  due_date: string;
  status: 'acik' | 'kapandi' | 'iptal';
  source_type: string;
  closure_evidence: string | null;
  verified_at: string | null;
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
export default function FollowUpList({ rows, today }: { rows: Row[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [evidence, setEvidence] = useState('');

  const groups = useMemo(() => {
    const open = rows.filter(r => r.status === 'acik');
    return {
      overdue: open.filter(r => r.due_date < today),
      today: open.filter(r => r.due_date === today),
      upcoming: open.filter(r => r.due_date > today),
      closed: rows.filter(r => r.status === 'kapandi').slice(0, 30)
    };
  }, [rows, today]);

  function close(id: string) {
    setErr(null);
    start(async () => {
      const r = await closeFollowUp(id, evidence);
      if (r?.error) { setErr(r.error); return; }
      setOpenFor(null); setEvidence('');
      router.refresh();
    });
  }

  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Takipler</h1>
        <p className="text-[14px] text-[#8E8E93]">
          {openCount} açık
          {groups.overdue.length > 0 && <span className="text-rose-300"> · {groups.overdue.length} gecikmiş</span>}
        </p>
      </header>

      {err && <p className="alert-error">{err}</p>}

      {openCount === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-[15px] text-[#8E8E93]">Açık takibiniz yok.</p>
        </div>
      )}

      <Group title="Gecikmiş" tone="bad" rows={groups.overdue}
        {...{ openFor, setOpenFor, evidence, setEvidence, close, pending, today }} />
      <Group title="Bugün" tone="warn" rows={groups.today}
        {...{ openFor, setOpenFor, evidence, setEvidence, close, pending, today }} />
      <Group title="Yaklaşan" rows={groups.upcoming}
        {...{ openFor, setOpenFor, evidence, setEvidence, close, pending, today }} />

      {groups.closed.length > 0 && (
        <section className="card overflow-hidden">
          <p className="section-title px-5 pt-5 pb-3">Kapananlar</p>
          <div className="divide-y divide-white/[0.08]">
            {groups.closed.map(r => (
              <div key={r.id} className="px-5 py-3">
                <p className="text-sm line-through text-[#8E8E93] truncate">{r.action}</p>
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
  title, tone, rows, openFor, setOpenFor, evidence, setEvidence, close, pending
}: {
  title: string; tone?: 'bad' | 'warn'; rows: Row[];
  openFor: string | null; setOpenFor: (v: string | null) => void;
  evidence: string; setEvidence: (v: string) => void;
  close: (id: string) => void; pending: boolean; today: string;
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
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={evidence} onChange={e => setEvidence(e.target.value)}
                  className="input !py-2 !text-[13px]"
                  placeholder="Kapanış kanıtı (zorunlu) — ne yapıldı?" />
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => close(r.id)} disabled={pending} className="btn-primary !py-2 !text-[13px]">
                    Kapat
                  </button>
                  <button onClick={() => setOpenFor(null)} className="btn-ghost !py-2 !text-[13px]">
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setOpenFor(r.id); setEvidence(''); }}
                className="btn-ghost !py-1.5 !text-[13px]">
                <Check size={14} /> Tamamlandı olarak kapat
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
