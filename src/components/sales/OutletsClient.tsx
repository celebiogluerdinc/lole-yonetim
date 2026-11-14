'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, MapPin, Phone, AlertTriangle, X } from 'lucide-react';
import { createOutlet, deleteOutlet } from '@/app/(app)/sales/actions';
import OutletForm, { type OutletTypeRow } from '@/components/sales/OutletForm';
import DeleteButton from '@/components/sales/DeleteButton';
import ListExport from '@/components/sales/ListExport';
import {
  OUTLET_STATUS_LABEL, OUTLET_STATUS_COLOR, SEGMENT_COLOR,
  FUNNEL_LABEL, FUNNEL_COLOR,
  type OutletStatus, type Segment, type FunnelStage
} from '@/lib/sales-types';

interface Row {
  id: string; name: string; code: string | null;
  city: string | null; district: string | null;
  status: OutletStatus; segment: Segment | null; score_pct: number | null;
  last_visit_at: string | null; phone: string | null;
  type_id: string | null; tax_number: string | null;
  /** v_outlet_funnel: aşama okuma anında hesaplanır */
  stage: FunnelStage | null; order_count: number; days_since_order: number | null;
  open_balance: number | null; overdue_days: number | null;
}

const PROSPECT_STAGES: FunnelStage[] = ['havuz', 'temas', 'tadim', 'teklif'];
const isCustomer = (o: Row) => o.order_count > 0 || o.status === 'aktif';
const isProspect = (o: Row) => o.stage ? PROSPECT_STAGES.includes(o.stage) : o.status === 'aday';
const isOverdue = (o: Row) => Number(o.open_balance ?? 0) > 0 && Number(o.overdue_days ?? 0) > 0;

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
  { key: 'aktif', label: 'Müşteri' },
  { key: 'ilk', label: 'İlk sipariş' },
  { key: 'donuk', label: 'Donuk' },
  { key: 'ihmal', label: 'İhmal edilen' },
  { key: 'borc', label: 'Borcu gecikmiş' },
  { key: 'eksik', label: 'Bilgisi eksik' }
] as const;

/** Sıralama: sahada günü planlayan kişi "en uzun süredir gidilmeyen"i arar. */
const SORTS = [
  { key: 'bekleyen', label: 'En uzun süredir gidilmeyen' },
  { key: 'ilce', label: 'İlçeye göre' },
  { key: 'ad', label: 'Ada göre' }
] as const;

export default function OutletsClient({
  outlets, types, loadError
}: { outlets: Row[]; types: OutletTypeRow[]; loadError?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<string>('bekleyen');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dupeId, setDupeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  // Hata, Kaydet butonunun yanında gösterilir: form uzun, en üstteki
  // uyarı sahada görülmüyor ve "tepki vermedi" sanılıyor.
  const errRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: outlets.length, aday: 0, aktif: 0, ilk: 0, donuk: 0, ihmal: 0, borc: 0, eksik: 0
    };
    for (const o of outlets) {
      if (isProspect(o)) c.aday++;
      if (isCustomer(o)) c.aktif++;
      if (o.stage === 'ilk_siparis') c.ilk++;
      if (o.stage === 'donuk') c.donuk++;
      if (isNeglected(o)) c.ihmal++;
      if (isOverdue(o)) c.borc++;
      if (isCustomer(o) && !o.tax_number) c.eksik++;
    }
    return c;
  }, [outlets]);

  const filtered = useMemo(() => {
    const rows = outlets.filter(o => {
      if (filter === 'aday' && !isProspect(o)) return false;
      if (filter === 'aktif' && !isCustomer(o)) return false;
      if (filter === 'ilk' && o.stage !== 'ilk_siparis') return false;
      if (filter === 'donuk' && o.stage !== 'donuk') return false;
      if (filter === 'ihmal' && !isNeglected(o)) return false;
      if (filter === 'borc' && !isOverdue(o)) return false;
      if (filter === 'eksik' && !(isCustomer(o) && !o.tax_number)) return false;
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

  const exportCols = useMemo(() => [
    { key: 'ad', label: 'Nokta', get: (o: Row) => o.name },
    { key: 'kod', label: 'Kod', get: (o: Row) => o.code ?? '' },
    { key: 'ilce', label: 'İlçe', get: (o: Row) => o.district ?? '' },
    { key: 'sehir', label: 'Şehir', get: (o: Row) => o.city ?? '' },
    { key: 'telefon', label: 'Telefon', get: (o: Row) => o.phone ?? '' },
    { key: 'durum', label: 'Aşama', get: (o: Row) => o.stage ? FUNNEL_LABEL[o.stage] : OUTLET_STATUS_LABEL[o.status] },
    { key: 'siparis', label: 'Sipariş sayısı', get: (o: Row) => o.order_count },
    { key: 'sonsiparis', label: 'Son siparişten beri (gün)', get: (o: Row) => o.days_since_order },
    { key: 'bakiye', label: 'Açık bakiye', get: (o: Row) => o.open_balance },
    { key: 'gecikme', label: 'Gecikme (gün)', get: (o: Row) => o.overdue_days },
    { key: 'segment', label: 'Segment', get: (o: Row) => o.segment ?? '' },
    { key: 'puan', label: 'Puan %', get: (o: Row) => o.score_pct },
    { key: 'vergi', label: 'Vergi no', get: (o: Row) => o.tax_number ?? '' },
    { key: 'songun', label: 'Son ziyaretten beri (gün)', get: (o: Row) => daysSince(o.last_visit_at) }
  ], []);

  function onCreate(fd: FormData) {
    setErr(null); setDupeId(null);
    start(async () => {
      let r: { ok?: boolean; id?: string; error?: string; existingId?: string } | undefined;
      try {
        r = await createOutlet(fd);
      } catch (e: any) {
        setErr(`Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`);
        queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      if (r?.error) {
        setErr(r.error);
        if (r.existingId) setDupeId(r.existingId);
        queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      setOpen(false); setName('');
      // Nokta açıldıktan sonra akış kesilmesin: doğrudan kartına gidiyoruz,
      // sıradaki adım (ziyaret → satış) orada bekliyor.
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
            {counts.all} nokta · {counts.aktif} müşteri · {counts.aday} aday
            {counts.donuk > 0 ? ` · ${counts.donuk} donuk` : ''}
          </p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn-primary shrink-0">
          {open ? <X size={16} /> : <Plus size={16} />} {open ? 'Kapat' : 'Yeni Nokta'}
        </button>
      </header>

      {loadError && <p className="alert-error">Noktalar yüklenemedi: {loadError}</p>}

      {open && (
        <form action={onCreate} className="card p-5 space-y-6">
          <OutletForm types={types} mode="create" onNameChange={onName} />

          <div ref={errRef} className="space-y-2">
            {err && (
              <div className="alert-error">
                <p>{err}</p>
                {dupeId && (
                  <Link href={`/sales/outlets/${dupeId}`} className="underline font-semibold">
                    Mevcut noktayı aç
                  </Link>
                )}
              </div>
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <button type="submit" disabled={!!blocker || pending} className="btn-primary disabled:opacity-40">
                {pending ? 'Kaydediliyor…' : 'Kaydet ve karta git'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
              {blocker && !pending && (
                <span className="text-[12px] text-amber-300">{blocker}</span>
              )}
            </div>
            {/* Zorunluluk tek alanda: sahada nokta açmak bir cümlelik iş
                olmalı, eksikleri nokta kartı hatırlatıyor. */}
            <p className="text-[12px] text-[#8E8E93]">
              Yalnızca <strong>nokta adı</strong> zorunlu. Eksik bilgi satışa engel değil;
              nokta kartı hatırlatır.
            </p>
          </div>
        </form>
      )}

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 min-h-[40px] rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
              filter === f.key ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6] border border-white/10'
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

      <div className="px-1">
        <ListExport rows={filtered} cols={exportCols} name="noktalar" />
      </div>

      {filtered.length === 0 && (
        <div className="card p-10 text-center space-y-3">
          {outlets.length === 0 ? (
            <>
              {/* İlk açılış: boş liste değil, ilk adım */}
              <p className="text-[17px] font-semibold">Henüz nokta yok</p>
              <p className="text-[14px] text-[#8E8E93]">
                İlk noktayı ekleyin; yalnızca adı yeterli. Ziyaret ve satış o karttan yürür.
              </p>
              {!open && (
                <button onClick={() => setOpen(true)} className="btn-primary mx-auto">
                  <Plus size={16} /> İlk noktayı ekle
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-[15px] text-[#8E8E93]">Bu filtrelerle eşleşen nokta yok.</p>
              <button onClick={() => { setFilter('all'); setQ(''); }} className="btn-ghost mx-auto">
                Filtreyi temizle
              </button>
            </>
          )}
        </div>
      )}

      {groups.map(g => (
        <div key={g.key || 'tek'} className="space-y-2">
          {g.key && (
            <p className="section-title px-1 flex items-center gap-1.5">
              <MapPin size={13} /> {g.key}
              <span className="text-[#AEAEB2] font-normal">({g.rows.length})</span>
            </p>
          )}
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {g.rows.map(o => {
              const d = daysSince(o.last_visit_at);
              const neglected = isNeglected(o);
              return (
                <div key={o.id} className="flex items-center gap-2 pr-2 hover:bg-white/[0.04] transition-colors">
                <Link href={`/sales/outlets/${o.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3">
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
                      {isOverdue(o) && (
                        <span className="badge bg-rose-500/20 text-rose-300">
                          borç {o.overdue_days} gün gecikmiş
                        </span>
                      )}
                      {isCustomer(o) && !o.tax_number && (
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
                      {!neglected && d !== null && <span>ziyaret {d} gün önce</span>}
                      {o.days_since_order !== null && <span>sipariş {o.days_since_order} gün önce</span>}
                      {o.score_pct !== null && <span>%{Math.round(o.score_pct)}</span>}
                    </p>
                  </div>
                  <span className={`badge shrink-0 ${o.stage ? FUNNEL_COLOR[o.stage] : OUTLET_STATUS_COLOR[o.status]}`}>
                    {o.stage ? FUNNEL_LABEL[o.stage] : OUTLET_STATUS_LABEL[o.status]}
                  </span>
                  <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
                </Link>
                <DeleteButton
                  message={`${o.name} silinecek. Ziyaret, teklif veya siparişi varsa silinmez — pasife alınır.`}
                  action={r => deleteOutlet(o.id, r)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </main>
  );
}
