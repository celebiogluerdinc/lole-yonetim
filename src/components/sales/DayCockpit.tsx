'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Check, Clock, MapPin, AlertTriangle, Sparkles, Lock,
  ChevronRight, FileWarning, ArrowRight
} from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { OUTCOME_LABEL, OUTCOME_COLOR, SEGMENT_COLOR } from '@/lib/sales-types';
import { addOutletsToDay, seedDayRoute } from '@/app/(app)/sales/routes/actions';

/* ------------------------------------------------------------------ *
 * BUGÜN — saha temsilcisinin gün yönetim ekranı
 *
 * Eski panel bir "özet" ekranıydı: sayılar doğruydu ama temsilciye
 * SIRADAKİ İŞİ söylemiyordu. Sahada telefona bakan kişinin sorusu
 * "kaç ziyaret yaptım" değil, "şimdi ne yapmalıyım". Bu ekran tek bir
 * birincil eylem gösteriyor ve o eylem saate göre değişiyor:
 *
 *   sabah   → rotayı kur (sistem öneriyor, temsilci düzenliyor)
 *   gün içi → sıradaki durak, tek dokunuşla ziyaret formu
 *   akşam   → taslakları tamamla, sonra günü kapat
 *
 * Hedef çubuğu kalan mesai süresini de gösteriyor; "6/10" tek başına
 * yetişilip yetişilmeyeceğini söylemiyor, "6/10 · 3 sa 20 dk kaldı"
 * söylüyor.
 * ------------------------------------------------------------------ */

const WORK_END_MIN = 18 * 60;   // mesai bitişi (yerel saha saati)
const EVENING_MIN = 16 * 60 + 30; // bu saatten sonra kapanış işleri öne geçer

interface Plan {
  id: string; plan_date: string; city: string | null; district: string | null;
  target_visits: number; closed_at: string | null;
}
interface Stop {
  id: string; planned_time: string | null; outlet_id: string | null;
  outlet_label: string | null; purpose: string | null;
  status: 'planlandi' | 'gerceklesti' | 'ertelendi' | 'iptal';
  result_note: string | null; position: number;
  outlets: { id: string; name: string; district: string | null; segment: string | null } | null;
}
interface VisitRow {
  id: string; outcome: string; overall_score: number | null; status: string;
  outlets: { name: string } | null;
}
interface FollowUp {
  id: string; action: string; due_date: string; outlet_id: string | null;
  outlets: { id: string; name: string } | null;
}
interface Neglected {
  id: string; name: string; district: string | null;
  segment: string | null; last_visit_at: string | null;
}

export default function DayCockpit({
  today, serverNowMin, plan, stops, visits, followUps, neglected, draftCount, outletCount
}: {
  today: string;
  serverNowMin: number;
  plan: Plan | null;
  stops: Stop[];
  visits: VisitRow[];
  followUps: FollowUp[];
  neglected: Neglected[];
  draftCount: number;
  outletCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Saat sunucudan geliyor ki ilk render'da hidrasyon uyuşmazlığı olmasın;
  // sonra dakikada bir istemcide güncelleniyor.
  const [nowMin, setNowMin] = useState(serverNowMin);
  useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Europe/Istanbul', hour12: false,
        hour: '2-digit', minute: '2-digit'
      });
      const [h, m] = t.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) setNowMin(h * 60 + m);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  function run(fn: () => Promise<any>, okMsg?: (r: any) => string) {
    setErr(null); setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) { setErr(r.error); return; }
        if (okMsg) setMsg(okMsg(r));
        router.refresh();
      } catch {
        setErr('İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');
      }
    });
  }

  /* ---------------- türetilmiş durum ---------------- */

  const minToStr = (v: number) =>
    `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  const stopMin = (s: Stop) => {
    if (!s.planned_time) return null;
    const [h, m] = s.planned_time.split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };

  const pendingStops = stops.filter(s => s.status === 'planlandi');
  const doneStops = stops.filter(s => s.status === 'gerceklesti').length;
  const realVisits = visits.filter(v => v.status !== 'taslak').length;
  const orders = visits.filter(v => v.outcome === 'siparis').length;

  const overdueFups = followUps.filter(f => f.due_date < today);
  const todayFups = followUps.filter(f => f.due_date === today);

  // Saati geçmiş ama hâlâ "planlandı" duran duraklar — kırmızı.
  const lateStops = pendingStops.filter(s => {
    const m = stopMin(s);
    return m !== null && m < nowMin;
  });

  // Sıradaki durak: saati gelmiş/geçmiş en eski, yoksa sırasıyla ilk bekleyen.
  const nextStop = useMemo(() => {
    const timed = pendingStops.filter(s => stopMin(s) !== null)
      .sort((a, b) => (stopMin(a)! - stopMin(b)!));
    if (timed.length) return timed[0];
    return [...pendingStops].sort((a, b) => a.position - b.position)[0] ?? null;
  }, [stops, nowMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = plan?.target_visits ?? 0;
  const achieved = Math.max(doneStops, realVisits);
  const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
  const minsLeft = Math.max(0, WORK_END_MIN - nowMin);
  const leftLabel = minsLeft === 0
    ? 'mesai bitti'
    : minsLeft >= 60
      ? `${Math.floor(minsLeft / 60)} sa ${minsLeft % 60} dk kaldı`
      : `${minsLeft} dk kaldı`;
  const remaining = Math.max(0, target - achieved);
  // Kalan ziyaret başına ne kadar süre var — "yetişir mi" sorusunun cevabı.
  const perVisit = remaining > 0 && minsLeft > 0 ? Math.floor(minsLeft / remaining) : null;

  const evening = nowMin >= EVENING_MIN;

  /* ---------------- birincil eylem ---------------- */

  type Primary = {
    title: string; sub: string; href?: string;
    action?: () => void; cta: string; tone?: 'warn' | 'done';
  };

  const primary: Primary = (() => {
    if (!plan) {
      return {
        title: 'Günün rotasını kur',
        sub: 'Boş sayfadan başlamayın — geciken takipler ve uzun süre uğranmamış noktalardan günü sistem önerebilir.',
        action: () => run(() => seedDayRoute(today), (r) => `${r.added} durak eklendi. Rotadan düzenleyebilirsiniz.`),
        cta: 'Bugünü bana öner'
      };
    }
    if (plan.closed_at) {
      return {
        title: 'Gün kapandı',
        sub: `${achieved} görüşme · ${orders} sipariş. Yarının rotasını şimdi kurarsanız sabah yolda vakit kaybetmezsiniz.`,
        href: `/sales/routes?date=${nextDay(today)}`,
        cta: 'Yarını planla',
        tone: 'done'
      };
    }
    if (evening && draftCount > 0) {
      return {
        title: `${draftCount} ziyaret taslakta`,
        sub: 'Gün kapanmadan tamamlayın — sonradan hatırlanarak doldurulan form güvenilir değildir.',
        href: '/sales/visits',
        cta: 'Taslakları tamamla',
        tone: 'warn'
      };
    }
    if (nextStop) {
      const name = nextStop.outlets?.name ?? nextStop.outlet_label ?? 'Nokta';
      const m = stopMin(nextStop);
      const late = m !== null && m < nowMin;
      return {
        title: name,
        sub: [
          m !== null ? (late ? `${minToStr(m)} · gecikti` : `${minToStr(m)} planlı`) : 'saat verilmedi',
          nextStop.purpose,
          nextStop.outlets?.district
        ].filter(Boolean).join(' · '),
        href: nextStop.outlet_id
          ? `/sales/visits/new?outlet=${nextStop.outlet_id}`
          : '/sales/visits/new',
        cta: 'Ziyareti aç',
        tone: late ? 'warn' : undefined
      };
    }
    if (stops.length === 0) {
      return {
        title: 'Rota boş',
        sub: 'Rotaya durak ekleyin ya da sistemin önerdiği noktalarla başlayın.',
        action: () => run(() => seedDayRoute(today), (r) => `${r.added} durak eklendi.`),
        cta: 'Bugünü bana öner'
      };
    }
    if (draftCount > 0) {
      return {
        title: `${draftCount} ziyaret taslakta`,
        sub: 'Tüm duraklar işaretlendi. Taslakları tamamlayın, sonra günü kapatın.',
        href: '/sales/visits',
        cta: 'Taslakları tamamla',
        tone: 'warn'
      };
    }
    return {
      title: 'Günü kapat',
      sub: `${achieved} görüşme · ${orders} sipariş. Rota engelini ve yeni randevuları yazın.`,
      href: '/sales/routes',
      cta: 'Gün kapanışına git',
      tone: 'done'
    };
  })();

  /* ---------------- durakları ilçeye göre grupla ---------------- */

  // Coğrafi gruplama: aynı ilçedeki duraklar bir arada görünürse temsilci
  // şehirde gidip gelmek yerine bölge bölge çalışıyor — en büyük zaman
  // kazancı burada.
  const byDistrict = useMemo(() => {
    const map = new Map<string, Stop[]>();
    for (const s of [...stops].sort((a, b) => {
      const am = stopMin(a), bm = stopMin(b);
      if (am !== null && bm !== null) return am - bm;
      if (am !== null) return -1;
      if (bm !== null) return 1;
      return a.position - b.position;
    })) {
      const k = s.outlets?.district || 'İlçe belirtilmedi';
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return Array.from(map.entries());
  }, [stops]);

  return (
    <main className="py-5 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Bugün</h1>
          <p className="text-[14px] text-[#8E8E93] truncate">
            {fmtDate(today)}
            {plan?.district ? ` · ${plan.district}` : plan?.city ? ` · ${plan.city}` : ''}
            {` · ${minToStr(nowMin)}`}
          </p>
        </div>
        <Link href="/sales/visits/new" className="btn-ghost shrink-0">
          <Plus size={16} /> Ziyaret
        </Link>
      </header>

      {err && <p className="alert-error">{err}</p>}
      {msg && (
        <p className="text-[13px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
          {msg}
        </p>
      )}

      {/* ---------- ŞİMDİ NE YAPMALIYIM ---------- */}
      <section className={`card p-5 space-y-3 border ${
        primary.tone === 'warn' ? 'border-amber-500/40 bg-amber-500/[0.06]'
          : primary.tone === 'done' ? 'border-emerald-500/30'
          : 'border-ios-blue/40'}`}>
        <p className="text-[12px] uppercase tracking-wide text-[#8E8E93] font-semibold">
          Şimdi ne yapmalıyım
        </p>
        <div>
          <p className="text-[20px] font-bold leading-tight">{primary.title}</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">{primary.sub}</p>
        </div>
        {primary.href ? (
          <Link href={primary.href} className="btn-primary w-full !py-3 !text-[15px] justify-center">
            {primary.cta} <ArrowRight size={16} />
          </Link>
        ) : (
          <button onClick={primary.action} disabled={pending}
            className="btn-primary w-full !py-3 !text-[15px] justify-center">
            <Sparkles size={16} /> {pending ? 'Hazırlanıyor…' : primary.cta}
          </button>
        )}
        {!plan && (
          <Link href="/sales/routes" className="btn-ghost w-full justify-center !text-[13px]">
            Rotayı elle kurmak istiyorum
          </Link>
        )}
      </section>

      {/* ---------- HEDEF + KALAN SÜRE ---------- */}
      {plan && (
        <section className="card p-5 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] text-[#8E8E93]">Günlük hedef</p>
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {achieved}<span className="text-[#8E8E93] text-base">/{target}</span>
                <span className="text-[13px] font-normal text-[#8E8E93]"> görüşme</span>
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[13px] font-medium ${minsLeft <= 60 ? 'text-amber-300' : 'text-[#AEAEB2]'}`}>
                {leftLabel}
              </p>
              {perVisit !== null && (
                <p className="text-[12px] text-[#8E8E93]">
                  kalan {remaining} ziyaret · nokta başına ~{perVisit} dk
                </p>
              )}
              {remaining === 0 && target > 0 && (
                <p className="text-[12px] text-emerald-300">hedef tamam</p>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/[0.10] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              pct >= 100 ? 'bg-ios-green' : pct >= 60 ? 'bg-ios-blue' : 'bg-ios-orange'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[12px] pt-1">
            <span className="badge bg-white/[0.07] text-[#D1D1D6]">Durak {stops.length}</span>
            <span className="badge bg-emerald-500/20 text-emerald-300">Gerçekleşen {doneStops}</span>
            {pendingStops.length > 0 && (
              <span className="badge bg-white/10 text-[#8E8E93]">Bekleyen {pendingStops.length}</span>
            )}
            {lateStops.length > 0 && (
              <span className="badge bg-rose-500/20 text-rose-300">Saati geçen {lateStops.length}</span>
            )}
            {orders > 0 && <span className="badge bg-ios-blue/20 text-ios-blue">Sipariş {orders}</span>}
          </div>
        </section>
      )}

      {/* ---------- GECİKMİŞ TAKİPLER (en üstte) ---------- */}
      {(overdueFups.length > 0 || todayFups.length > 0) && (
        <section className="card overflow-hidden">
          <p className={`section-title px-5 pt-5 pb-3 flex items-center gap-2 ${
            overdueFups.length > 0 ? 'text-rose-300' : 'text-amber-300'}`}>
            <AlertTriangle size={15} />
            {overdueFups.length > 0
              ? `${overdueFups.length} geciken takip`
              : `Bugün vadesi gelen ${todayFups.length} takip`}
          </p>
          <p className="px-5 pb-2 text-[13px] text-[#8E8E93]">
            Söz verilmiş iş. Noktayı bugünün rotasına tek dokunuşla ekleyebilirsiniz.
          </p>
          <div className="divide-y divide-white/[0.08]">
            {[...overdueFups, ...todayFups].slice(0, 8).map(f => {
              const inRoute = stops.some(s => s.outlet_id && s.outlet_id === f.outlet_id);
              return (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] truncate">{f.action}</p>
                    <p className="text-[13px] text-[#8E8E93] truncate">
                      {f.outlets?.name ?? '—'} · {fmtDate(f.due_date, false)}
                    </p>
                  </div>
                  {f.due_date < today && (
                    <span className="badge bg-rose-500/20 text-rose-300 shrink-0">gecikmiş</span>
                  )}
                  {f.outlet_id && (
                    inRoute
                      ? <span className="badge bg-emerald-500/20 text-emerald-300 shrink-0">rotada</span>
                      : <button
                          onClick={() => run(() => addOutletsToDay([f.outlet_id!], today), () => 'Rotaya eklendi.')}
                          disabled={pending}
                          className="rounded-lg bg-ios-blue/15 text-ios-blue px-2.5 py-1.5 text-[12px] font-semibold shrink-0">
                          Bugüne ekle
                        </button>
                  )}
                </div>
              );
            })}
          </div>
          <Link href="/sales/follow-ups"
            className="flex items-center justify-between px-5 py-3 text-[13px] text-[#8E8E93] hover:bg-white/[0.04] border-t border-white/[0.08]">
            Tüm takipler <ChevronRight size={14} />
          </Link>
        </section>
      )}

      {/* ---------- GÜNÜN AKIŞI (ilçe ilçe) ---------- */}
      {plan && stops.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
            <p className="section-title !mb-0">Günün akışı</p>
            <Link href="/sales/routes" className="text-[13px] text-ios-blue">Rotayı düzenle</Link>
          </div>
          {byDistrict.map(([district, list]) => (
            <div key={district}>
              <p className="px-5 py-1.5 text-[12px] font-semibold text-[#8E8E93] bg-white/[0.03] flex items-center gap-1.5">
                <MapPin size={12} /> {district}
                <span className="font-normal">· {list.length} durak</span>
              </p>
              <div className="divide-y divide-white/[0.08]">
                {list.map(s => {
                  const m = stopMin(s);
                  const late = s.status === 'planlandi' && m !== null && m < nowMin;
                  const name = s.outlets?.name ?? s.outlet_label ?? 'Nokta';
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`text-[13px] tabular-nums w-11 shrink-0 ${
                        late ? 'text-rose-300 font-semibold' : 'text-[#8E8E93]'}`}>
                        {m !== null ? minToStr(m) : '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[15px] truncate ${
                          s.status === 'gerceklesti' ? 'text-[#8E8E93] line-through' : ''}`}>
                          {name}
                        </p>
                        {(s.purpose || s.result_note) && (
                          <p className="text-[12px] text-[#8E8E93] truncate">
                            {s.result_note || s.purpose}
                          </p>
                        )}
                      </div>
                      {s.status === 'gerceklesti' && (
                        <Check size={16} className="text-emerald-400 shrink-0" />
                      )}
                      {s.status === 'ertelendi' && (
                        <Clock size={16} className="text-amber-400 shrink-0" />
                      )}
                      {s.status === 'planlandi' && s.outlet_id && (
                        <Link href={`/sales/visits/new?outlet=${s.outlet_id}`}
                          className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold shrink-0 ${
                            late ? 'bg-ios-red text-white' : 'bg-ios-blue/15 text-ios-blue'}`}>
                          {late ? 'Gecikti · aç' : 'Ziyareti aç'}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---------- BUGÜN KAYDEDİLENLER ---------- */}
      {visits.length > 0 && (
        <section className="card overflow-hidden">
          <p className="section-title px-5 pt-5 pb-3">Bugün kaydedilenler</p>
          <div className="divide-y divide-white/[0.08]">
            {visits.map(v => (
              <Link key={v.id} href={`/sales/visits/${v.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors">
                <span className="text-sm flex-1 truncate">{v.outlets?.name ?? 'Nokta'}</span>
                {v.overall_score !== null && (
                  <span className="text-[13px] text-[#8E8E93] tabular-nums shrink-0">{v.overall_score}/5</span>
                )}
                <span className={`badge shrink-0 ${OUTCOME_COLOR[v.outcome as keyof typeof OUTCOME_COLOR]}`}>
                  {OUTCOME_LABEL[v.outcome as keyof typeof OUTCOME_LABEL]}
                </span>
                {v.status === 'taslak' && (
                  <span className="badge bg-amber-500/20 text-amber-300 shrink-0 flex items-center gap-1">
                    <FileWarning size={11} /> taslak
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- İHMAL EDİLEN NOKTALAR ---------- */}
      {neglected.length > 0 && !plan?.closed_at && (
        <NeglectedBlock
          rows={neglected}
          stops={stops}
          today={today}
          pending={pending}
          onAdd={(ids) => run(() => addOutletsToDay(ids, today), (r) => `${r.added} nokta rotaya eklendi.`)}
        />
      )}

      {plan?.closed_at && (
        <p className="text-[13px] text-[#8E8E93] flex items-center gap-1.5 px-1">
          <Lock size={13} /> Gün kapatıldı. Değişiklik için Rota sekmesinden günü tekrar açın.
        </p>
      )}

      <p className="text-[12px] text-[#48484A] px-1">
        {outletCount} aktif nokta · kartotekse eklemek için Noktalar sekmesi
      </p>
    </main>
  );
}

/**
 * Uzun süre uğranmamış A/B noktalar. Çoklu seçim var: temsilci bölgeye
 * göre üç-dört noktayı birden rotaya atıyor, tek tek eklemiyor.
 */
function NeglectedBlock({
  rows, stops, pending, onAdd
}: {
  rows: Neglected[]; stops: Stop[]; today: string;
  pending: boolean; onAdd: (ids: string[]) => void;
}) {
  const inRoute = new Set(stops.map(s => s.outlet_id).filter(Boolean) as string[]);
  const open = rows.filter(r => !inRoute.has(r.id));
  const [sel, setSel] = useState<string[]>([]);
  if (!open.length) return null;

  const days = (iso: string | null) =>
    iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  return (
    <section className="card overflow-hidden">
      <p className="section-title px-5 pt-5 pb-3 flex items-center gap-2 text-amber-300">
        <AlertTriangle size={15} /> Uğranmayan noktalar
      </p>
      <p className="px-5 pb-2 text-[13px] text-[#8E8E93]">
        A ve B segmentinde 14 günden uzun süredir ziyaret edilmeyenler. Seçip bugüne ekleyin.
      </p>
      <div className="divide-y divide-white/[0.08]">
        {open.slice(0, 10).map(o => {
          const d = days(o.last_visit_at);
          const on = sel.includes(o.id);
          return (
            <label key={o.id}
              className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.04]">
              <input type="checkbox" checked={on}
                onChange={e => setSel(s => e.target.checked ? [...s, o.id] : s.filter(x => x !== o.id))} />
              <span className="flex-1 min-w-0 text-sm truncate">{o.name}</span>
              {o.district && (
                <span className="text-[12px] text-[#8E8E93] shrink-0 flex items-center gap-1">
                  <MapPin size={11} />{o.district}
                </span>
              )}
              {o.segment && (
                <span className={`badge shrink-0 ${SEGMENT_COLOR[o.segment as 'A' | 'B' | 'C']}`}>
                  {o.segment}
                </span>
              )}
              <span className="badge bg-rose-500/20 text-rose-300 shrink-0">
                {d === null ? 'hiç' : `${d} gün`}
              </span>
            </label>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/[0.08]">
        <button onClick={() => { onAdd(sel); setSel([]); }}
          disabled={pending || sel.length === 0}
          className="btn-outline !py-2 !text-[13px] disabled:opacity-40">
          <Plus size={14} /> {sel.length > 0 ? `${sel.length} noktayı bugüne ekle` : 'Nokta seçin'}
        </button>
      </div>
    </section>
  );
}

function nextDay(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
