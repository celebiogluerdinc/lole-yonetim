'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { OUTCOME_LABEL, OUTCOME_COLOR, type VisitOutcome } from '@/lib/sales-types';
import { deleteVisit } from '@/app/(app)/sales/actions';
import DeleteButton from '@/components/sales/DeleteButton';
import ListExport from '@/components/sales/ListExport';

export interface VisitRow {
  id: string; visit_date: string; outcome: VisitOutcome;
  overall_score: number | null; status: string;
  outlets: { name: string; city: string | null; district: string | null } | null;
  profiles: { full_name: string | null } | null;
}

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');
const fmtD = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

const FILTERS = [
  { key: 'tum', label: 'Tümü' },
  { key: 'taslak', label: 'Taslak' },
  { key: 'siparis', label: 'Siparişle kapanan' },
  { key: 'teklif', label: 'Teklif istenen' },
  { key: 'olumsuz', label: 'Olumsuz' }
] as const;
type Filter = typeof FILTERS[number]['key'];

/**
 * ZİYARET LİSTESİ
 *
 * Sunucu listesi düz bir tabloydu: arama, süzme, çıktı ve silme yoktu;
 * yanlış noktaya girilen ziyaret ekranda kalıyordu. Liste zaten istemciye
 * geldiği için arama ve süzme ağ turu harcamıyor.
 */
export default function VisitsClient({ visits }: { visits: VisitRow[] }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tum');

  const matches = (v: VisitRow, f: Filter) => {
    switch (f) {
      case 'taslak': return v.status === 'taslak';
      case 'siparis': return v.outcome === 'siparis';
      case 'teklif': return v.outcome === 'teklif_istendi';
      case 'olumsuz': return v.outcome === 'olumsuz';
      default: return true;
    }
  };

  const rows = useMemo(() => visits.filter(v => {
    if (!matches(v, filter)) return false;
    if (!q) return true;
    const hay = tr([v.outlets?.name, v.outlets?.district, v.outlets?.city,
      v.profiles?.full_name].filter(Boolean).join(' '));
    return hay.includes(tr(q));
  }), [visits, q, filter]);

  const drafts = visits.filter(v => v.status === 'taslak').length;

  const cols = useMemo(() => [
    { key: 'tarih', label: 'Tarih', get: (v: VisitRow) => v.visit_date },
    { key: 'nokta', label: 'Nokta', get: (v: VisitRow) => v.outlets?.name ?? '' },
    { key: 'ilce', label: 'İlçe', get: (v: VisitRow) => v.outlets?.district ?? '' },
    { key: 'sehir', label: 'Şehir', get: (v: VisitRow) => v.outlets?.city ?? '' },
    { key: 'temsilci', label: 'Temsilci', get: (v: VisitRow) => v.profiles?.full_name ?? '' },
    { key: 'sonuc', label: 'Sonuç', get: (v: VisitRow) => OUTCOME_LABEL[v.outcome] ?? v.outcome },
    { key: 'puan', label: 'Puan', get: (v: VisitRow) => v.overall_score },
    { key: 'durum', label: 'Durum', get: (v: VisitRow) => v.status }
  ], []);

  return (
    <main className="py-5 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Ziyaretler</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {visits.length} kayıt{drafts > 0 ? ` · ${drafts} taslak` : ''}
          </p>
        </div>
        <Link href="/sales/visits/new" className="btn-primary shrink-0">
          <Plus size={16} /> Yeni Ziyaret
        </Link>
      </header>

      {drafts > 0 && (
        <button onClick={() => setFilter('taslak')}
          className="w-full text-left text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {drafts} ziyaret taslakta. Gün kapanmadan tamamlayın — sonradan hatırlanarak
          doldurulan form güvenilir değildir.
        </button>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
        <input value={q} onChange={e => setQ(e.target.value)} className="input !pl-10"
          placeholder="Nokta, ilçe veya temsilci ara…" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
              filter === f.key ? 'bg-ios-blue text-white'
                : 'bg-[#1C1C1E] text-[#D1D1D6] border border-white/10'
            }`}>
            {f.label}
            <span className={`text-[11px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${
              filter === f.key ? 'bg-white/25' : 'bg-white/10'}`}>
              {visits.filter(v => matches(v, f.key)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="px-1">
        <ListExport rows={rows} cols={cols} name="ziyaretler" />
      </div>

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {rows.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-[15px] text-[#8E8E93]">Bu filtrede ziyaret yok.</p>
          </div>
        )}
        {rows.map(v => (
          <div key={v.id} className="flex items-center gap-2 pr-2 hover:bg-white/[0.04] transition-colors">
            <Link href={`/sales/visits/${v.id}`}
              className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate">{v.outlets?.name ?? 'Nokta'}</p>
                <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">
                  {fmtD(v.visit_date)}
                  {v.outlets?.district ? ` · ${v.outlets.district}` : ''}
                  {v.profiles?.full_name ? ` · ${v.profiles.full_name}` : ''}
                </p>
              </div>
              {v.overall_score !== null && (
                <span className="text-[13px] text-[#8E8E93] tabular-nums shrink-0">{v.overall_score}/5</span>
              )}
              <span className={`badge shrink-0 ${OUTCOME_COLOR[v.outcome]}`}>
                {OUTCOME_LABEL[v.outcome]}
              </span>
              {v.status === 'taslak' && (
                <span className="badge bg-white/10 text-[#8E8E93] shrink-0">taslak</span>
              )}
              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
            </Link>
            <DeleteButton
              message={`${v.outlets?.name ?? 'Nokta'} · ${fmtD(v.visit_date)} ziyaret kaydı silinecek. Puanlar ve tadım kayıtları da gider.`}
              action={r => deleteVisit(v.id, r)}
              askReason={v.status !== 'taslak'} />
          </div>
        ))}
      </div>
    </main>
  );
}
