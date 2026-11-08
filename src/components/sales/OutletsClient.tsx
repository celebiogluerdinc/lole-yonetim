'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, MapPin, Phone, AlertTriangle } from 'lucide-react';
import { createOutlet } from '@/app/(app)/sales/actions';
import {
  OUTLET_STATUS_LABEL, OUTLET_STATUS_COLOR, SEGMENT_COLOR, CHANNEL_LABEL,
  type OutletStatus, type Segment, type OutletChannel
} from '@/lib/sales-types';

interface Row {
  id: string; name: string; code: string | null;
  city: string | null; district: string | null;
  status: OutletStatus; segment: Segment | null; score_pct: number | null;
  last_visit_at: string | null; phone: string | null;
  type_id: string | null; tax_number: string | null;
}
interface TypeRow {
  id: string; name: string; channel: OutletChannel; is_quick_pick: boolean; sort_order: number;
}

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Son ziyaretten bu yana geçen gün — kapsama boşluğunu görünür kılar. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'aday', label: 'Aday' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'ihmal', label: 'İhmal edilen' },
  { key: 'eksik', label: 'Bilgisi eksik' }
] as const;

export default function OutletsClient({ outlets, types }: { outlets: Row[]; types: TypeRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const quickTypes = useMemo(() => types.filter(t => t.is_quick_pick), [types]);
  const otherTypes = useMemo(() => types.filter(t => !t.is_quick_pick), [types]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: outlets.length, aday: 0, aktif: 0, ihmal: 0, eksik: 0 };
    for (const o of outlets) {
      if (o.status === 'aday') c.aday++;
      if (o.status === 'aktif') c.aktif++;
      const d = daysSince(o.last_visit_at);
      if ((o.segment === 'A' || o.segment === 'B') && (d === null || d > 14)) c.ihmal++;
      if (o.status === 'aktif' && !o.tax_number) c.eksik++;
    }
    return c;
  }, [outlets]);

  const filtered = useMemo(() => outlets.filter(o => {
    if (filter === 'aday' && o.status !== 'aday') return false;
    if (filter === 'aktif' && o.status !== 'aktif') return false;
    if (filter === 'ihmal') {
      const d = daysSince(o.last_visit_at);
      if (!((o.segment === 'A' || o.segment === 'B') && (d === null || d > 14))) return false;
    }
    if (filter === 'eksik' && !(o.status === 'aktif' && !o.tax_number)) return false;
    if (q) {
      const hay = tr([o.name, o.city, o.district, o.code].filter(Boolean).join(' '));
      if (!hay.includes(tr(q))) return false;
    }
    return true;
  }), [outlets, q, filter]);

  async function onCreate(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await createOutlet(fd);
      if (r?.error) { setErr(r.error); return; }
      setOpen(false);
      if (r?.id) router.push(`/sales/outlets/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Noktalar</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {counts.all} nokta · {counts.aktif} aktif · {counts.aday} aday
          </p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn-primary shrink-0">
          <Plus size={16} /> Yeni Nokta
        </button>
      </header>

      {err && <p className="alert-error">{err}</p>}

      {open && (
        <form action={onCreate} className="card p-5 space-y-4">
          <p className="section-title">Yeni nokta</p>

          <div>
            <label className="label">Nokta adı *</label>
            <input name="name" required className="input" placeholder="Shell Çayırova Market" />
          </div>

          {/* F02'nin beş kutucuğu: sahada uzun liste okunmaz */}
          <div>
            <label className="label">Tip</label>
            <div className="flex flex-wrap gap-2">
              {quickTypes.map(t => (
                <label key={t.id} className="cursor-pointer">
                  <input type="radio" name="type_id" value={t.id} className="peer sr-only" />
                  <span className="badge peer-checked:bg-ios-blue peer-checked:text-white
                    bg-white/[0.07] text-[#D1D1D6] px-3.5 py-2 text-[13px] font-semibold inline-block">
                    {t.name}
                  </span>
                </label>
              ))}
            </div>
            {otherTypes.length > 0 && (
              <details className="mt-2">
                <summary className="text-[13px] text-[#8E8E93] cursor-pointer">Diğer tipler</summary>
                <div className="flex flex-wrap gap-2 mt-2">
                  {otherTypes.map(t => (
                    <label key={t.id} className="cursor-pointer">
                      <input type="radio" name="type_id" value={t.id} className="peer sr-only" />
                      <span className="badge peer-checked:bg-ios-blue peer-checked:text-white
                        bg-white/[0.07] text-[#D1D1D6] px-3 py-1.5 inline-block">
                        {t.name} <span className="opacity-50">· {CHANNEL_LABEL[t.channel]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Şehir</label><input name="city" className="input" /></div>
            <div><label className="label">İlçe</label><input name="district" className="input" /></div>
          </div>
          <div><label className="label">Adres</label><input name="address" className="input" /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Telefon</label><input name="phone" className="input" /></div>
            <div>
              <label className="label">Uygun görüşme saati</label>
              <input name="preferred_contact_time" className="input" placeholder="Sabah 08:00–10:00" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Mevcut tedarikçi</label>
              <input name="current_supplier" className="input" />
            </div>
            <div>
              <label className="label">En çok satan içecek</label>
              <input name="top_selling_drink" className="input" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary">Kaydet</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
          </div>
          <p className="text-[12px] text-[#8E8E93]">
            Vergi no ve muhasebe/satın alma iletişimi nokta kartından eklenir.
          </p>
        </form>
      )}

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
              filter === f.key ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6] shadow-[0_0_0_0.5px_rgba(255,255,255,0.09)]'
            }`}>
            {f.label}
            <span className={`text-[11px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${
              filter === f.key ? 'bg-white/25' : 'bg-white/10'}`}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
        <input value={q} onChange={e => setQ(e.target.value)} className="input !pl-10"
          placeholder="Nokta, şehir veya ilçe ara…" />
      </div>

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-[15px] text-[#8E8E93]">Bu filtrelerle eşleşen nokta yok.</p>
          </div>
        )}
        {filtered.map(o => {
          const d = daysSince(o.last_visit_at);
          const neglected = (o.segment === 'A' || o.segment === 'B') && (d === null || d > 14);
          return (
            <Link key={o.id} href={`/sales/outlets/${o.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[15px] font-medium truncate">{o.name}</p>
                  {o.segment && (
                    <span className={`badge ${SEGMENT_COLOR[o.segment]}`}>{o.segment}</span>
                  )}
                  {neglected && (
                    <span className="badge bg-rose-500/20 text-rose-300 flex items-center gap-1">
                      <AlertTriangle size={11} /> {d === null ? 'hiç ziyaret edilmedi' : `${d} gün`}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#8E8E93] truncate mt-0.5 flex items-center gap-2">
                  {(o.city || o.district) && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />{[o.district, o.city].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {o.phone && <span className="flex items-center gap-1"><Phone size={12} />{o.phone}</span>}
                  {o.score_pct !== null && <span>%{Math.round(o.score_pct)}</span>}
                </p>
              </div>
              <span className={`badge shrink-0 ${OUTLET_STATUS_COLOR[o.status]}`}>
                {OUTLET_STATUS_LABEL[o.status]}
              </span>
              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
