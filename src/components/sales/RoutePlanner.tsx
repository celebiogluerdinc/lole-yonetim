'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Check, Clock, X, CalendarDays, Trash2, Lock, Unlock, MapPin,
  AlertTriangle, Sparkles, Layers, Store, Compass
} from 'lucide-react';
import {
  createRoutePlan, addRouteStop, setRouteStopStatus, deleteRouteStop,
  closeRouteDay, reopenRouteDay, seedDayRoute, groupStopsByDistrict,
  addOutletsToDay, convertStopToOutlet
} from '@/app/(app)/sales/routes/actions';
import { ILLER, ilcelerOf } from '@/lib/tr-iller';

interface Plan {
  id: string; plan_date: string; city: string | null; district: string | null;
  vehicle: string | null; team: string | null; target_visits: number;
  blocker_note: string | null; closed_at: string | null;
}
interface Stop {
  id: string; planned_time: string | null; outlet_id: string | null;
  outlet_label: string | null; purpose: string | null; contact_person: string | null;
  status: 'planlandi' | 'gerceklesti' | 'ertelendi' | 'iptal';
  result_note: string | null; position: number;
  /** Serbest (potansiyel) durağın kendi konumu — kayıtlı noktada null */
  city: string | null; district: string | null;
  outlets: { id: string; name: string; city: string | null; district: string | null } | null;
}
interface OutletLite {
  id: string; name: string; city: string | null; district: string | null;
  segment: 'A' | 'B' | 'C' | null; last_visit_at: string | null;
}
interface TargetRow { scope: string; scope_value: string | null; target_value: number }

const STATUS_LABEL: Record<Stop['status'], string> = {
  planlandi: 'Planlandı',
  gerceklesti: 'Gerçekleşti',
  ertelendi: 'Ertelendi',
  iptal: 'İptal'
};
const STATUS_COLOR: Record<Stop['status'], string> = {
  planlandi: 'bg-white/[0.07] text-[#D1D1D6]',
  gerceklesti: 'bg-emerald-500/20 text-emerald-300',
  ertelendi: 'bg-amber-500/20 text-amber-300',
  iptal: 'bg-rose-500/20 text-rose-300'
};

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function RoutePlanner({
  date, today, plan, stops, outlets, targets, defaultCity, defaultDistrict
}: {
  date: string; today: string; plan: Plan | null;
  stops: Stop[]; outlets: OutletLite[]; targets: TargetRow[];
  /** Son rotadan devralınan konum — şehir/ilçe elle yazılmasın */
  defaultCity?: string | null;
  defaultDistrict?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<OutletLite | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  /**
   * Portföydeki en sık şehir/ilçe — son rota yoksa buradan tahmin ediliyor.
   * Amaç tek: temsilci her gün aynı şehri elle yazmasın.
   */
  const guess = useMemo(() => {
    const count = (get: (o: OutletLite) => string | null) => {
      const m = new Map<string, number>();
      for (const o of outlets) {
        const v = (get(o) ?? '').trim();
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    };
    return { city: count(o => o.city), district: count(o => o.district) };
  }, [outlets]);

  const initialCity = defaultCity || plan?.city || guess.city || '';
  const initialDistrict = defaultDistrict || plan?.district || '';

  // Plan kurulum formunun şehri/ilçesi
  const [city, setCity] = useState(initialCity);
  const [district, setDistrict] = useState(
    initialDistrict && ilcelerOf(initialCity).includes(initialDistrict) ? initialDistrict : ''
  );

  // Durak ekleme: varsayılan "potansiyel yer" — rotanın asıl amacı yeni nokta
  const [stopMode, setStopMode] = useState<'yeni' | 'kayitli'>('yeni');
  const [stopCity, setStopCity] = useState(plan?.city || initialCity || '');
  const [stopDistrict, setStopDistrict] = useState(plan?.district || '');

  const closed = !!plan?.closed_at;

  // Hedef şehre göre değişiyor (F01: İstanbul 5, diğer 10) — plan kurulmadan
  // önce de göstermek için aynı kuralı burada tekrarlıyoruz.
  const previewTarget = useMemo(() => {
    if (city) {
      const hit = targets.find(t => t.scope === 'sehir' && tr(t.scope_value ?? '') === tr(city));
      if (hit) return Math.round(Number(hit.target_value));
    }
    const def = targets.find(t => t.scope === 'varsayilan');
    return def ? Math.round(Number(def.target_value)) : 10;
  }, [city, targets]);

  const counts = useMemo(() => {
    const c = { planlandi: 0, gerceklesti: 0, ertelendi: 0, iptal: 0 };
    for (const s of stops) c[s.status]++;
    return c;
  }, [stops]);

  // Öneri: uzun süredir ziyaret edilmemiş A/B noktalar rotanın ilk adayları
  const suggestions = useMemo(() => {
    const inPlan = new Set(stops.map(s => s.outlet_id).filter(Boolean));
    return outlets
      .filter(o => !inPlan.has(o.id) && (o.segment === 'A' || o.segment === 'B'))
      .map(o => ({ o, d: daysSince(o.last_visit_at) }))
      .filter(x => x.d === null || x.d > 14)
      .sort((a, b) => (b.d ?? 9999) - (a.d ?? 9999))
      .slice(0, 5);
  }, [outlets, stops]);

  // İlçe dağılımı: en kalabalık ilçe önde. Serbest durak kendi ilçesiyle sayılıyor.
  const districtStrip = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stops) {
      const k = s.outlets?.district || s.district || 'İlçe yok';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [stops]);

  const prospectCount = stops.filter(s => !s.outlet_id).length;

  const filteredOutlets = useMemo(() => {
    const t = tr(q);
    return outlets
      .filter(o => !t || tr([o.name, o.city, o.district].filter(Boolean).join(' ')).includes(t))
      .slice(0, 20);
  }, [outlets, q]);

  function run(fn: () => Promise<{ error?: string; ok?: boolean } | undefined>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r?.error) { setErr(r.error); return; }
      after?.();
      router.refresh();
    });
  }

  // ---------- plan yoksa: kurulum ----------
  if (!plan) {
    return (
      <main className="py-5 space-y-5">
        <Header date={date} today={today} />
        {err && <p className="alert-error">{err}</p>}

        <form
          action={(fd) => run(() => createRoutePlan(fd))}
          className="card p-5 space-y-4"
        >
          <p className="section-title">Günün rotasını kur</p>
          <input type="hidden" name="plan_date" value={date} />

          {/* Şehir ve ilçe listeden seçiliyor ve hazır geliyor: son rotanızın
              bölgesi, yoksa portföyünüzde en sık geçen şehir. Serbest metinde
              "İstanbul / istanbul / İST" varyantları oluşuyor ve hedef
              hesabı ile raporlar bölünüyordu. */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Şehir</label>
              <select name="city" className="input" value={city}
                onChange={e => { setCity(e.target.value); setDistrict(''); }}>
                <option value="">Seçiniz…</option>
                {ILLER.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Rota / ilçe</label>
              <select name="district" className="input" value={district} disabled={!city}
                onChange={e => setDistrict(e.target.value)}>
                <option value="">{city ? 'Tümü / seçiniz…' : 'Önce şehir seçin'}</option>
                {ilcelerOf(city).map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          {(defaultCity || guess.city) && city === initialCity && (
            <p className="text-[12px] text-[#8E8E93] -mt-1">
              {defaultCity
                ? 'Şehir son rotanızdan geldi — değiştirebilirsiniz.'
                : 'Şehir portföyünüzden tahmin edildi — değiştirebilirsiniz.'}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Araç</label><input name="vehicle" className="input" /></div>
            <div><label className="label">Ekip</label><input name="team" className="input" /></div>
          </div>

          <div className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm">
            <span className="text-[#8E8E93]">Günlük görüşme hedefi: </span>
            <strong className="text-[15px]">{previewTarget}</strong>
            <span className="text-[#8E8E93]"> — şehre göre belirlenir, Ayarlar'dan değiştirilir.</span>
          </div>

          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Kuruluyor…' : 'Rotayı kur'}
          </button>
        </form>

        {/* Boş sayfadan başlamak zaman kaybı: sistem günü önerebiliyor. */}
        <section className="card p-5 space-y-3">
          <p className="section-title flex items-center gap-2">
            <Sparkles size={15} /> Günü sistem önersin
          </p>
          <p className="text-[13px] text-[#8E8E93]">
            Geciken takiplerin noktaları, sonra uzun süre uğranmamış A ve B segment
            noktalar — hedef sayısı kadar durak kurulur. Sonra siz düzenlersiniz.
          </p>
          <button onClick={() => run(() => seedDayRoute(date))} disabled={pending}
            className="btn-outline">
            <Sparkles size={15} /> {pending ? 'Hazırlanıyor…' : 'Bu günü bana öner'}
          </button>
        </section>
      </main>
    );
  }

  // ---------- plan var ----------
  const done = counts.gerceklesti;
  const total = stops.length;
  const pct = plan.target_visits > 0 ? Math.min(100, Math.round((done / plan.target_visits) * 100)) : 0;

  return (
    <main className="py-5 space-y-5">
      <Header date={date} today={today} />
      {err && <p className="alert-error">{err}</p>}

      <section className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium">
              {[plan.city, plan.district].filter(Boolean).join(' · ') || 'Rota'}
            </p>
            <p className="text-[13px] text-[#8E8E93]">
              {[plan.vehicle, plan.team].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          {closed
            ? <span className="badge bg-white/10 text-[#8E8E93] flex items-center gap-1 shrink-0">
                <Lock size={11} /> Gün kapandı
              </span>
            : <span className="badge bg-emerald-500/20 text-emerald-300 shrink-0">Açık</span>}
        </div>

        <div>
          <div className="flex items-center justify-between text-[13px] mb-1.5">
            <span className="text-[#8E8E93]">Hedef {plan.target_visits} görüşme</span>
            <span className="tabular-nums font-medium">{done} / {plan.target_visits}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.10] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              pct >= 90 ? 'bg-ios-green' : pct >= 75 ? 'bg-ios-orange' : 'bg-ios-blue'}`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[12px]">
          <span className="badge bg-white/[0.07] text-[#D1D1D6]">Planlanan {total}</span>
          <span className="badge bg-emerald-500/20 text-emerald-300">Gerçekleşen {counts.gerceklesti}</span>
          {counts.ertelendi > 0 && <span className="badge bg-amber-500/20 text-amber-300">Ertelenen {counts.ertelendi}</span>}
          {counts.iptal > 0 && <span className="badge bg-rose-500/20 text-rose-300">İptal {counts.iptal}</span>}
          {counts.planlandi > 0 && <span className="badge bg-white/10 text-[#8E8E93]">Bekleyen {counts.planlandi}</span>}
          {/* Avcılık görünür olsun: günün kaç durağı yeni nokta arayışı */}
          {prospectCount > 0 && (
            <span className="badge bg-amber-500/15 text-amber-300 flex items-center gap-1">
              <Compass size={10} /> Potansiyel {prospectCount}
            </span>
          )}
        </div>
      </section>

      {/* duraklar */}
      <section className="card divide-y divide-white/[0.08] overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="section-title !mb-0">Duraklar</p>
          {!closed && (
            <div className="flex gap-1.5">
              {stops.length > 1 && (
                <button onClick={() => run(() => groupStopsByDistrict(plan.id))}
                  disabled={pending} className="btn-ghost text-sm">
                  <Layers size={15} /> İlçeye göre sırala
                </button>
              )}
              <button onClick={() => setAdding(v => !v)} className="btn-ghost text-sm">
                <Plus size={15} /> Durak ekle
              </button>
            </div>
          )}
        </div>

        {/* Hangi ilçede kaç durak var — şehirde gidip gelmeyi görünür kılıyor. */}
        {districtStrip.length > 1 && (
          <div className="px-5 pb-3 flex flex-wrap gap-1.5">
            {districtStrip.map(([d, n]) => (
              <span key={d} className="badge bg-white/[0.07] text-[#D1D1D6] flex items-center gap-1">
                <MapPin size={10} />{d} · {n}
              </span>
            ))}
          </div>
        )}

        {stops.length === 0 && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-[14px] text-[#8E8E93]">
              Henüz durak eklenmedi. Kayıtlı nokta seçmek zorunlu değil —
              gidilecek yerin adını yazarak da durak ekleyebilirsiniz.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setAdding(true); setStopMode('yeni'); }}
                className="btn-outline !py-2 !text-[13px]">
                <Compass size={14} /> Potansiyel yer ekle
              </button>
              <button onClick={() => run(() => seedDayRoute(date))} disabled={pending}
                className="btn-ghost !py-2 !text-[13px]">
                <Sparkles size={14} /> Kayıtlı noktalardan günü öner
              </button>
            </div>
          </div>
        )}

        {stops.map(s => {
          const name = s.outlets?.name ?? s.outlet_label ?? 'Nokta';
          const prospect = !s.outlet_id;
          const where = s.outlets?.district ?? s.district;
          return (
            <div key={s.id} className="px-5 py-3 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-[13px] text-[#8E8E93] tabular-nums w-12 shrink-0 pt-0.5">
                  {s.planned_time ? s.planned_time.slice(0, 5) : '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate flex items-center gap-1.5">
                    {prospect
                      ? <Compass size={13} className="text-amber-300 shrink-0" />
                      : <Store size={13} className="text-[#8E8E93] shrink-0" />}
                    <span className="truncate">{name}</span>
                  </p>
                  <p className="text-[13px] text-[#8E8E93] truncate">
                    {[where, s.purpose, s.contact_person].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {prospect && (
                    <p className="text-[12px] text-amber-300/90 mt-0.5">
                      Kartotekte yok — potansiyel müşteri
                    </p>
                  )}
                  {s.result_note && (
                    <p className="text-[12px] text-amber-300 mt-0.5">{s.result_note}</p>
                  )}
                </div>
                <span className={`badge shrink-0 ${STATUS_COLOR[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>

              {!closed && s.status === 'planlandi' && (
                <div className="flex flex-wrap gap-1.5 pl-[3.75rem]">
                  {s.outlet_id ? (
                    <Link href={`/sales/visits/new?outlet=${s.outlet_id}`}
                      className="rounded-lg bg-ios-blue text-white px-3 py-2 text-[13px] font-semibold">
                      Ziyareti aç
                    </Link>
                  ) : (
                    /* Ziyaret kaydı nokta istiyor: görüşüldüyse durak tek
                       tıkla aday noktaya dönüşüyor, sonra ziyaret açılıyor. */
                    <button onClick={() => run(() => convertStopToOutlet(s.id))} disabled={pending}
                      className="rounded-lg bg-ios-blue text-white px-3 py-2 text-[13px] font-semibold flex items-center gap-1">
                      <Plus size={14} /> Nokta olarak kaydet
                    </button>
                  )}
                  <button onClick={() => run(() => setRouteStopStatus(s.id, 'gerceklesti'))}
                    className="rounded-lg bg-emerald-500/15 text-emerald-300 px-3 py-2 text-[13px] font-semibold flex items-center gap-1">
                    <Check size={14} /> Gerçekleşti
                  </button>
                  <button onClick={() => { setNoteFor(s.id === noteFor ? null : s.id); setNote(''); }}
                    className="rounded-lg bg-amber-500/15 text-amber-300 px-3 py-2 text-[13px] font-semibold flex items-center gap-1">
                    <Clock size={14} /> Ertele
                  </button>
                  <button onClick={() => run(() => deleteRouteStop(s.id))}
                    className="rounded-lg bg-white/[0.07] text-[#8E8E93] px-3 py-2 text-[13px]">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {noteFor === s.id && (
                <div className="pl-[3.75rem] flex flex-col sm:flex-row gap-2">
                  <input value={note} onChange={e => setNote(e.target.value)}
                    className="input !py-2 !text-[13px]" placeholder="Erteleme / iptal nedeni (zorunlu)" />
                  <div className="flex gap-2">
                    <button onClick={() => run(() => setRouteStopStatus(s.id, 'ertelendi', note), () => setNoteFor(null))}
                      className="btn-outline !py-2 !text-[13px] shrink-0">Ertele</button>
                    <button onClick={() => run(() => setRouteStopStatus(s.id, 'iptal', note), () => setNoteFor(null))}
                      className="btn-ghost !py-2 !text-[13px] shrink-0">İptal</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {adding && !closed && (
          <form
            action={(fd) => run(() => addRouteStop(fd), () => { setAdding(false); setPicked(null); setQ(''); })}
            className="px-5 py-4 space-y-3 bg-white/[0.02]"
          >
            <input type="hidden" name="route_plan_id" value={plan.id} />
            <input type="hidden" name="outlet_id" value={stopMode === 'kayitli' ? (picked?.id ?? '') : ''} />

            {/* Varsayılan "yeni / potansiyel yer": rotanın amacı yeni nokta
                bulmak. Kayıtlı nokta seçmek zorunlu değil, ikinci sekme. */}
            <div className="segment">
              <button type="button" onClick={() => setStopMode('yeni')}
                className={`segment-item ${stopMode === 'yeni' ? 'segment-item-active' : ''} flex items-center justify-center gap-1.5`}>
                <Compass size={14} /> Yeni / potansiyel yer
              </button>
              <button type="button" onClick={() => setStopMode('kayitli')}
                className={`segment-item ${stopMode === 'kayitli' ? 'segment-item-active' : ''} flex items-center justify-center gap-1.5`}>
                <Store size={14} /> Kayıtlı nokta
              </button>
            </div>

            {stopMode === 'yeni' ? (
              <div className="space-y-3">
                <div>
                  <label className="label">Yerin adı *</label>
                  <input name="outlet_label" className="input" autoFocus
                    placeholder="Örn: Sanayi sitesi karşısındaki kebapçı" />
                  <p className="text-[12px] text-[#8E8E93] mt-1">
                    Kartotekte kayıtlı olması gerekmiyor. Görüşme yapılırsa durağı
                    tek tıkla aday noktaya çevirebilirsiniz.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Şehir</label>
                    <select name="city" className="input" value={stopCity}
                      onChange={e => { setStopCity(e.target.value); setStopDistrict(''); }}>
                      <option value="">Seçiniz…</option>
                      {ILLER.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">İlçe</label>
                    <select name="district" className="input" value={stopDistrict} disabled={!stopCity}
                      onChange={e => setStopDistrict(e.target.value)}>
                      <option value="">{stopCity ? 'Seçiniz…' : 'Önce şehir seçin'}</option>
                      {ilcelerOf(stopCity).map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-[12px] text-[#8E8E93]">
                  İlçe yazılırsa durak “ilçeye göre sırala” ve ilçe dağılımına girer —
                  şehirde boşa gidip gelmeyi önler.
                </p>
              </div>
            ) : (
              <div>
                <label className="label">Kayıtlı nokta</label>
                {picked ? (
                  <div className="flex items-center gap-2">
                    <span className="badge bg-ios-blue/20 text-ios-blue">{picked.name}</span>
                    <button type="button" onClick={() => setPicked(null)} className="text-[#8E8E93]">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input value={q} onChange={e => setQ(e.target.value)} className="input"
                      placeholder="Nokta ara…" />
                    {q && (
                      <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
                        {filteredOutlets.map(o => (
                          <button key={o.id} type="button" onClick={() => { setPicked(o); setQ(''); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.05]">
                            {o.name}
                            <span className="text-[#8E8E93]"> · {[o.district, o.city].filter(Boolean).join(', ') || '—'}</span>
                          </button>
                        ))}
                        {filteredOutlets.length === 0 && (
                          <p className="px-3 py-3 text-[13px] text-[#8E8E93]">
                            Eşleşme yok — “Yeni / potansiyel yer” sekmesinden adını yazarak ekleyin.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Saat</label>
                <input type="time" name="planned_time" className="input" />
              </div>
              <div>
                <label className="label">Kişi</label>
                <input name="contact_person" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Amaç</label>
              <input name="purpose" className="input"
                placeholder={stopMode === 'yeni' ? 'İlk temas, tanıtım, tadım…' : 'Tadım, teklif, tahsilat…'} />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-primary">Ekle</button>
              <button type="button" onClick={() => setAdding(false)} className="btn-ghost">Vazgeç</button>
            </div>
          </form>
        )}
      </section>

      {/* öneri: ihmal edilen A/B noktalar */}
      {!closed && suggestions.length > 0 && (
        <section className="card p-5 space-y-2">
          <p className="section-title flex items-center gap-2 text-amber-300">
            <AlertTriangle size={15} /> Rotaya eklemeyi düşünün
          </p>
          <p className="text-[13px] text-[#8E8E93]">
            A ve B segmentinde, 14 günden uzun süredir ziyaret edilmemiş noktalar.
          </p>
          {suggestions.length > 1 && (
            <button
              onClick={() => run(() => addOutletsToDay(suggestions.map(s => s.o.id), date))}
              disabled={pending} className="btn-ghost !py-1.5 !text-[13px]">
              <Plus size={14} /> {suggestions.length} noktayı birden ekle
            </button>
          )}
          {suggestions.map(({ o, d }) => (
            <form key={o.id} action={(fd) => run(() => addRouteStop(fd))}
              className="flex items-center gap-2 text-sm">
              <input type="hidden" name="route_plan_id" value={plan.id} />
              <input type="hidden" name="outlet_id" value={o.id} />
              <span className="flex-1 min-w-0 truncate">{o.name}</span>
              {o.district && (
                <span className="text-[12px] text-[#8E8E93] flex items-center gap-1 shrink-0">
                  <MapPin size={11} />{o.district}
                </span>
              )}
              <span className="badge bg-rose-500/20 text-rose-300 shrink-0">
                {d === null ? 'hiç' : `${d} gün`}
              </span>
              <button type="submit" className="btn-ghost !py-1.5 !text-[13px] shrink-0">Ekle</button>
            </form>
          ))}
        </section>
      )}

      {/* gün kapanışı */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Gün kapanışı</p>
        {closed ? (
          <>
            {plan.blocker_note && (
              <p className="text-sm text-[#D1D1D6] whitespace-pre-wrap">{plan.blocker_note}</p>
            )}
            <button onClick={() => run(() => reopenRouteDay(plan.id))} className="btn-ghost text-sm">
              <Unlock size={15} /> Günü tekrar aç
            </button>
          </>
        ) : (
          <form action={(fd) => run(() => closeRouteDay(fd))} className="space-y-3">
            <input type="hidden" name="route_plan_id" value={plan.id} />
            <div>
              <label className="label">Rota engeli / ertelenen görüşme / yeni randevu</label>
              <textarea name="blocker_note" rows={2} className="input" />
            </div>
            {counts.planlandi > 0 && (
              <p className="text-[13px] text-amber-300">
                {counts.planlandi} durak hâlâ bekliyor — kapatmadan önce işaretleyin.
              </p>
            )}
            <button type="submit" disabled={pending} className="btn-outline">
              <Lock size={15} /> Günü kapat
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function Header({ date, today }: { date: string; today: string }) {
  const prev = new Date(date + 'T12:00:00'); prev.setDate(prev.getDate() - 1);
  const next = new Date(date + 'T12:00:00'); next.setDate(next.getDate() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const label = new Date(date + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'long'
  });

  return (
    <header className="px-1 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Rota</h1>
        <p className="text-[14px] text-[#8E8E93] flex items-center gap-1.5">
          <CalendarDays size={14} />{label}{date === today ? ' · bugün' : ''}
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Link href={`/sales/routes?date=${iso(prev)}`} className="btn-ghost !px-3">‹</Link>
        {date !== today && <Link href="/sales/routes" className="btn-ghost !px-3">Bugün</Link>}
        <Link href={`/sales/routes?date=${iso(next)}`} className="btn-ghost !px-3">›</Link>
      </div>
    </header>
  );
}
