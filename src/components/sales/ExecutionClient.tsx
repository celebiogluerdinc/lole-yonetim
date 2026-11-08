'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, ClipboardCheck, GraduationCap } from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import OpeningForm from '@/components/sales/OpeningForm';
import TrainingForm from '@/components/sales/TrainingForm';

interface OutletLite { id: string; name: string; city: string | null; district: string | null }
interface CheckItem { id: string; label: string; is_critical: boolean }
interface PersonLite { id: string; full_name: string }

interface OpeningRow {
  id: string; checked_at: string; result: 'satisa_hazir' | 'eksik_var' | 'ertelendi';
  outlets: { id: string; name: string } | null;
  profiles: { full_name: string } | null;
}
interface TrainingRow {
  id: string; trained_at: string; missing_topics: string | null; retrain_date: string | null;
  outlets: { id: string; name: string } | null;
  training_participants: { passed: boolean }[];
}

const RESULT_LABEL: Record<OpeningRow['result'], string> = {
  satisa_hazir: 'Satışa hazır',
  eksik_var: 'Eksik var',
  ertelendi: 'Ertelendi'
};
const RESULT_COLOR: Record<OpeningRow['result'], string> = {
  satisa_hazir: 'bg-emerald-500/20 text-emerald-300',
  eksik_var: 'bg-amber-500/20 text-amber-300',
  ertelendi: 'bg-white/10 text-[#8E8E93]'
};

export default function ExecutionClient({
  tab, openings, trainings, outlets, checkItems, people
}: {
  tab: 'acilis' | 'egitim';
  openings: OpeningRow[];
  trainings: TrainingRow[];
  outlets: OutletLite[];
  checkItems: CheckItem[];
  people: PersonLite[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <main className="py-5 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Saha İcra</h1>
          <p className="text-[14px] text-[#8E8E93]">Açılış kontrolü ve personel eğitimi</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn-primary shrink-0">
          <Plus size={16} /> {tab === 'acilis' ? 'Açılış' : 'Eğitim'}
        </button>
      </header>

      <div className="flex gap-1.5">
        <Link href="/sales/execution?t=acilis"
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold flex items-center gap-1.5 ${
            tab === 'acilis' ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'}`}>
          <ClipboardCheck size={14} /> Açılış
        </Link>
        <Link href="/sales/execution?t=egitim"
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold flex items-center gap-1.5 ${
            tab === 'egitim' ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'}`}>
          <GraduationCap size={14} /> Eğitim
        </Link>
      </div>

      {open && (
        <section className="card p-5 space-y-4">
          <p className="section-title">
            {tab === 'acilis' ? 'Satış noktası açılış kontrolü' : 'Garson ve satış personeli eğitimi'}
          </p>
          {tab === 'acilis'
            ? <OpeningForm outlets={outlets} items={checkItems} people={people}
                onDone={() => setOpen(false)} />
            : <TrainingForm outlets={outlets} onDone={() => setOpen(false)} />}
        </section>
      )}

      {tab === 'acilis' ? (
        <section className="card divide-y divide-white/[0.08] overflow-hidden">
          {openings.length === 0 && (
            <p className="p-10 text-center text-[15px] text-[#8E8E93]">Henüz açılış kaydı yok.</p>
          )}
          {openings.map(o => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate">{o.outlets?.name ?? 'Nokta'}</p>
                <p className="text-[13px] text-[#8E8E93]">
                  {fmtDate(o.checked_at)}
                  {o.profiles?.full_name ? ` · ${o.profiles.full_name}` : ''}
                </p>
              </div>
              <span className={`badge shrink-0 ${RESULT_COLOR[o.result]}`}>
                {RESULT_LABEL[o.result]}
              </span>
            </div>
          ))}
        </section>
      ) : (
        <section className="card divide-y divide-white/[0.08] overflow-hidden">
          {trainings.length === 0 && (
            <p className="p-10 text-center text-[15px] text-[#8E8E93]">Henüz eğitim kaydı yok.</p>
          )}
          {trainings.map(t => {
            const parts = t.training_participants ?? [];
            const passed = parts.filter(p => p.passed).length;
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">{t.outlets?.name ?? 'Nokta'}</p>
                  <p className="text-[13px] text-[#8E8E93]">
                    {fmtDate(t.trained_at)}
                    {t.retrain_date ? ` · tekrar: ${fmtDate(t.retrain_date, false)}` : ''}
                  </p>
                </div>
                <span className={`badge shrink-0 tabular-nums ${
                  parts.length > 0 && passed === parts.length
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'}`}>
                  {passed}/{parts.length} geçti
                </span>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
