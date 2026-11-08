'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, MapPin, Phone, AlertTriangle, X } from 'lucide-react';
import { createOutlet } from '@/app/(app)/sales/actions';
import OutletForm, { type OutletTypeRow } from '@/components/sales/OutletForm';
import {
  OUTLET_STATUS_LABEL, OUTLET_STATUS_COLOR, SEGMENT_COLOR,
  type OutletStatus, type Segment
} from '@/lib/sales-types';

interface Row {
  id: string; name: string; code: string | null;
  city: string | null; district: string | null;
  status: OutletStatus; segment: Segment | null; score_pct: number | null;
  last_visit_at: string | null; phone: string | null;
  type_id: string | null; tax_number: string | null;
}

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Son ziyaretten bu yana geçen gün — kapsama boşluğunu görünür kılar. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function isNeglected(o: Row): boolean {
  const d = daysSince(o.last_visit_at);
  return (o.segment === 'A' || o.segment === 'B') && (d === null || d > 14);
}

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'aday', label: 'Aday' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'ihmal', label: 'İhmal edilen' },
  { key: 'eksik', label: 'Bilgisi eksik' }
] as const;

/** Sıralama: sahada günü planlayan kişi "en uzun süredir gidilmeyen"i arar. */
const SORTS = [
  { key: 'bekleyen', label: 'En uzun süredir gidilmeyen' },
  { key: 'ilce', label: 'İlçeye göre' },
  { key: 'ad', label: 'Ada göre' }
] as const;

export default function OutletsClient({ outlets, types }: { outlets: Row[]; types: OutletTypeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<string>('bekleyen');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  // Hata, Kaydet butonunun yanında gösterilir: form uzun, en üstteki
  // uyarı sahada görülmüyor ve "tepki vermedi" sanılıyor.
  const errRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: outlets.length, aday: 0, aktif: 0, ihmal: 0, eksik: 0 };
    for (const o of outlets) {
      if (o.status === 'aday') c.aday++;
      if (o.status === 'aktif') c.aktif++;
      if (isNeglected(o)) c.ihmal++;
      if (o.status === 'aktif' && !o.tax_number) c.eksik++;
    }
    return c;
  }, [outlets]);

  const filtered = useMemo(() => {
    const rows = outlets.filter(o => {
      if (filter === 'aday' && o.status !== 'aday') return false;
      if (filter === 'aktif' && o.status !== 'aktif') return false;
      if (filter === 'ihmal' && !isNeglected(o)) return false;
      if (filter === 'eksik' && !(o.status === 'aktif' && !o.tax_number)) return false;
      if (q) {
        const hay = tr([o.name, o.city, o.district, o.code].filter(Boolean).join(' '));
        if (!hay.includes(tr(q))) return false;
      }
      return true;
    });

    const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, 'tr-TR');
    if (sort === 'ad') return rows.sort(byName);
    if (sort === 'ilce') {
      return rows.sort((a, b) => {
        const ka = [a.district, a.city].filter(Boolean).join(', ') || 'zzz';
        const kb = [b.district, b.city].filter(Boolean).join(', ') || 'zzz';
        return ka.localeCompare(kb, 'tr-TR') || byName(a, b);
      });
    }
    // bekleyen: hiç gidilmeyen en başta, sonra en eski ziyaret
    return rows.sort((a, b) => {
      const da = a.last_visit_at ? new Date(a.last_visit_at).getTime() : -1;
      const db = b.last_visit_at ? new Date(b.last_visit_at).getTime() : -1;
      return da - db || byName(a, b);
    });
  }, [outlets, q, filter, sort]);

  /** İlçeye göre sıralamada başlıklı gruplar: rota kurmayı kolaylaştırıyor. */
  const groups = useMemo(() => {
    if (sort !== 'ilce') return [{ key: '', rows: filtered }];
    const out: { key: string; rows: Row[] }[] = [];
    for (const o of filtered) {
      const key = [o.district, o.city].filter(Boolean).join(', ') || 'Konum girilmedi';
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(o);
      else out.push({ key, rows: [o] });
    }
    return out;
  }, [filtered, sort]);

  const onName = useCallback((v: string) => setName(v), []);

  function onCreate(fd: FormData) {
    setErr(null);
    start(async () => {
      let r: { ok?: boolean; id?: string; error?: string } | undefined;
      try {
        r = await createOutlet(fd);
      } catch (e: any) {
        setErr(`Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`);
        queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      if (r?.error) {
        setErr(r.error);
        queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      setOpen(false); setName('');
      // Nokta açıldıktan sonra akış kesilmesin: doğrudan kartına gidiyoruz,
      // sıradaki adım (değerlendirme → ziyaret → teklif) orada bekliyor.
      if (r?.id) router.push(`/sales/outlets/${r.id}`);
      else router.refresh();
    });
  }

  const blocker = !name.trim() ? 'Nokta adı girin' : null;

  return (
    <main className="py-5 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Noktalar</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {counts.all} nokta · {counts.aktif} aktif · {counts.aday} aday
            {counts.ihmal > 0 ? ` · ${counts.ihmal} bekliyor` : ''}
          </p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn-primary shrink-0">
          {open ? <X size={16} /> : <Plus size={16} />} {open ? 'Kapat' : 'Yeni Nokta'}
        </button>
      </header>

      {open && (
        <form action={onCreate} className="card p-5 space-y-6">
          <OutletForm types={types} mode="create" onNameChange={onName} />

          <div ref={errRef} className="space-y-2">
            {err && <p className="alert-error">{err}</p>}
            <div className="flex gap-2 items-center flex-wrap">
              <button type="submit" disabled={!!blocker || pending} className="btn-primary disabled:opacity-40">
                {pending ? 'Kaydediliyor…' : 'Kaydet ve karta git'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
              {blocker && !pending && (
                <span className="text-[12px] text-amber-300">{blocker}</span>
              )}
            </div>
          </div>
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

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
          <input value={q} onChange={e => setQ(e.target.value)} className="input !pl-10"
            placeholder="Nokta, şehir veya ilçe ara…" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="input !w-auto shrink-0 !text-[13px]" aria-label="Sıralama">
          {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-[15px] text-[#8E8E93]">Bu filtrelerle eşleşen nokta yok.</p>
        </div>
      )}

      {groups.map(g => (
        <div key={g.key || 'tek'} className="space-y-2">
          {g.key && (
            <p className="section-title px-1 flex items-center gap-1.5">
              <MapPin size={13} /> {g.key}
              <span className="text-[#48484A] font-normal">({g.rows.length})</span>
            </p>
          )}
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {g.rows.map(o => {
              const d = daysSince(o.last_visit_at);
              const neglected = isNeglected(o);
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
                          <AlertTriangle size={11} /> {d === null ? 'hiç gidilmedi' : `${d} gün`}
                        </span>
                      )}
                      {o.status === 'aktif' && !o.tax_number && (
                        <span className="badge bg-amber-500/20 text-amber-300">vergi no yok</span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#8E8E93] truncate mt-0.5 flex items-center gap-2">
                      {sort !== 'ilce' && (o.city || o.district) && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />{[o.district, o.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {o.phone && <span className="flex items-center gap-1"><Phone size={12} />{o.phone}</span>}
                      {!neglected && d !== null && <span>{d} gün önce</span>}
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
        </div>
      ))}
    </main>
  );
}
