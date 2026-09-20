'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Package, Wallet, ShieldAlert, Plane, ShieldQuestion,
  Megaphone, Presentation, ClipboardList, Check, X, ChevronRight,
  Building2, Activity, Inbox
} from 'lucide-react';
import { decidePurchaseRequest } from '@/app/(app)/purchasing/actions';
import { decidePaymentRequest } from '@/app/(app)/payments/actions';
import { decideLeave } from '@/app/(app)/hr/actions';
import { decideIncident } from '@/app/(app)/incidents/actions';
import { reviewTask } from '@/app/(app)/tasks/actions';
import AutoRefresh from '@/components/AutoRefresh';

type Kind = 'purchase' | 'payment' | 'leave' | 'incident' | 'review';

interface Waiting {
  key: string; kind: Kind; id: string;
  companyId: string; company: string; orderLine: boolean;
  title: string; sub: string; who: string; atText: string; href: string;
}
interface Feed {
  key: string; companyId: string; company: string;
  icon: string; color: string; title: string; sub: string; atText: string; href: string;
}
interface Company {
  id: string; name: string; orderLine: boolean; bekleyen: number;
}

const KIND_META: Record<Kind, { Icon: any; color: string; label: string }> = {
  purchase: { Icon: ShoppingCart, color: '#E8930C', label: 'Satın alma' },
  payment:  { Icon: Wallet,       color: '#12A150', label: 'Ödeme' },
  leave:    { Icon: Plane,        color: '#0E9F9F', label: 'İzin' },
  incident: { Icon: ShieldAlert,  color: '#E5484D', label: 'Olay kaydı' },
  review:   { Icon: ShieldQuestion, color: '#0A6CFF', label: 'Görev onayı' }
};

const FEED_ICON: Record<string, any> = {
  cart: ShoppingCart, package: Package, wallet: Wallet, incident: ShieldAlert,
  meeting: Presentation, task: ClipboardList, megaphone: Megaphone
};

export default function MerkezClient({
  companies, waiting, feed, selectedCompany, selectedTab
}: {
  companies: Company[]; waiting: Waiting[]; feed: Feed[];
  selectedCompany: string; selectedTab: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sirket, setSirket] = useState(selectedCompany);
  const [sekme, setSekme] = useState<'onay' | 'akis'>(selectedTab === 'akis' ? 'akis' : 'onay');
  const [redOpen, setRedOpen] = useState<Waiting | null>(null);
  const [redNot, setRedNot] = useState('');

  const bekleyen = useMemo(
    () => waiting.filter(w => sirket === 'all' || w.companyId === sirket),
    [waiting, sirket]);
  const akis = useMemo(
    () => feed.filter(f => sirket === 'all' || f.companyId === sirket),
    [feed, sirket]);

  /** Bir onay kaydını sonuçlandırır. Hangi modül olursa olsun tek yerden. */
  async function karar(w: Waiting, onayla: boolean, not?: string) {
    switch (w.kind) {
      case 'purchase': return decidePurchaseRequest(w.id, onayla, not);
      case 'payment':  return decidePaymentRequest(w.id, onayla, not);
      case 'leave':    return decideLeave(w.id, onayla, not);
      case 'incident': return decideIncident(w.id, onayla, not);
      case 'review':   return reviewTask(w.id, onayla, not);
    }
  }

  function calistir(w: Waiting, onayla: boolean, not?: string) {
    setBusy(w.key);
    start(async () => {
      setError(null); setOk(null);
      try {
        const r: any = await karar(w, onayla, not);
        if (r?.error) setError(`${w.title}: ${r.error}`);
        else {
          setOk(`${w.title} — ${onayla ? 'onaylandı' : 'reddedildi'}`);
          setRedOpen(null); setRedNot('');
          router.refresh();
        }
      } catch {
        // ağ kopması ya da beklenmedik sunucu hatası: düğmeler kilitli kalmasın
        setError('Bağlantı hatası — işlem tamamlanamadı, tekrar deneyin.');
      } finally {
        setBusy(null);
      }
    });
  }

  const toplamBekleyen = waiting.length;
  /** Görev onayını reddederken sunucu en az 3 karakterlik gerekçe ister. */
  const notZorunlu = redOpen?.kind === 'review';

  return (
    <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <AutoRefresh seconds={45} />

      {/* ---- BAŞLIK ---- */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
            <Building2 size={20} className="text-ios-blue" />
            Şirket Yönetim Merkezi
          </h1>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">
            Tüm şirketler ve sipariş hattı tek ekranda — şirket değiştirmeden onaylayın.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[26px] font-bold leading-none num"
            style={{ color: toplamBekleyen ? '#E8930C' : '#12A150' }}>
            {toplamBekleyen}
          </div>
          <div className="text-[11px] text-[#8E8E93] mt-1">onay bekliyor</div>
        </div>
      </header>

      {error && !redOpen && <div className="alert-error">{error}</div>}
      {ok && (
        <div className="rounded-xl px-3 py-2 text-[13px]"
          style={{ background: '#e7f7ee', color: '#0b7a3d', border: '1px solid #bfe8d0' }}>
          {ok}
        </div>
      )}

      {/* ---- ŞİRKET SEÇİMİ ---- */}
      <section>
        <div className="section-title">Şirketler</div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setSirket('all')}
            className={`shrink-0 rounded-xl px-3.5 py-2.5 text-left transition-all ${
              sirket === 'all' ? 'bg-ios-blue text-white shadow-sm' : 'card hover:bg-white/[0.04]'}`}>
            <div className="text-[13px] font-semibold whitespace-nowrap">Tümü</div>
            <div className={`text-[11px] ${sirket === 'all' ? 'text-white/80' : 'text-[#8E8E93]'}`}>
              {companies.length} şirket · {toplamBekleyen} bekleyen
            </div>
          </button>
          {companies.map(c => (
            <button key={c.id} onClick={() => setSirket(c.id)}
              className={`shrink-0 rounded-xl px-3.5 py-2.5 text-left transition-all ${
                sirket === c.id ? 'bg-ios-blue text-white shadow-sm' : 'card hover:bg-white/[0.04]'}`}>
              <div className="text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5">
                {c.orderLine && <Package size={12} />}{c.name}
              </div>
              <div className={`text-[11px] ${sirket === c.id ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {c.bekleyen > 0 ? `${c.bekleyen} bekleyen` : 'bekleyen yok'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ---- SEKMELER ---- */}
      <div className="segment max-w-sm">
        <button onClick={() => setSekme('onay')}
          className={`segment-item ${sekme === 'onay' ? 'segment-item-active' : ''}`}>
          Onay bekleyenler {bekleyen.length > 0 && `(${bekleyen.length})`}
        </button>
        <button onClick={() => setSekme('akis')}
          className={`segment-item ${sekme === 'akis' ? 'segment-item-active' : ''}`}>
          Tüm hareketler
        </button>
      </div>

      {/* ---- ONAY BEKLEYENLER ---- */}
      {sekme === 'onay' && (
        bekleyen.length === 0 ? (
          <div className="card p-8 text-center">
            <Inbox size={30} className="mx-auto text-[#c3cbd9]" />
            <p className="mt-3 text-[15px] font-semibold">Bekleyen onay yok</p>
            <p className="text-[13px] text-[#8E8E93] mt-1">
              {sirket === 'all' ? 'Tüm şirketlerde' : 'Bu şirkette'} her şey kapanmış durumda.
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-white/[0.08]">
            {bekleyen.map(w => {
              const M = KIND_META[w.kind];
              const Icon = w.kind === 'purchase' && w.orderLine ? Package : M.Icon;
              const calisiyor = busy === w.key;
              return (
                <div key={w.key} className="p-3.5 flex items-start gap-3">
                  <span className="smart-icon mt-0.5" style={{ background: M.color }}>
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge" style={{ background: '#eef1f6', color: '#475467' }}>
                        {w.company}
                      </span>
                      <span className="text-[11px] text-[#8E8E93]">{w.atText}</span>
                    </div>
                    <p className="text-[15px] font-semibold mt-1 break-words">{w.title}</p>
                    <p className="text-[12px] text-[#8E8E93]">
                      {w.sub}{w.who !== '—' && w.kind !== 'leave' ? ` · ${w.who}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <button disabled={pending}
                        onClick={() => calistir(w, true)}
                        className="btn-success !py-1.5 !px-3 !text-[13px]">
                        <Check size={14} /> {calisiyor ? '…' : 'Onayla'}
                      </button>
                      <button disabled={pending}
                        onClick={() => { setRedOpen(w); setRedNot(''); }}
                        className="btn-danger !py-1.5 !px-3 !text-[13px]">
                        <X size={14} /> Reddet
                      </button>
                      <Link href={w.href}
                        className="btn-ghost !py-1.5 !px-2 !text-[13px]">
                        Ayrıntı <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ---- HAREKET AKIŞI ---- */}
      {sekme === 'akis' && (
        akis.length === 0 ? (
          <div className="card p-8 text-center">
            <Activity size={30} className="mx-auto text-[#c3cbd9]" />
            <p className="mt-3 text-[15px] font-semibold">Henüz hareket yok</p>
          </div>
        ) : (
          <div className="card divide-y divide-white/[0.08]">
            {akis.map(f => {
              const Icon = FEED_ICON[f.icon] ?? ClipboardList;
              return (
                <Link key={f.key} href={f.href}
                  className="flex items-center gap-3 p-3.5 hover:bg-white/[0.04] transition-colors">
                  <span className="smart-icon" style={{ background: f.color }}>
                    <Icon size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge" style={{ background: '#eef1f6', color: '#475467' }}>
                        {f.company}
                      </span>
                      <span className="text-[11px] text-[#8E8E93]">{f.atText}</span>
                    </div>
                    <p className="text-[14px] font-medium mt-0.5 truncate">{f.title}</p>
                    <p className="text-[12px] text-[#8E8E93] truncate">{f.sub}</p>
                  </div>
                  <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* ---- RET NOTU ---- */}
      {redOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => setRedOpen(null)}>
          <div className="card p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[16px]">Reddetme gerekçesi</h3>
            <p className="text-[13px] text-[#8E8E93] break-words">{redOpen.title}</p>
            {/* Görev onayında gerekçe ZORUNLUDUR (sunucu da böyle ister). */}
            <textarea value={redNot} onChange={e => setRedNot(e.target.value)}
              rows={3} className="input" autoFocus
              placeholder={notZorunlu
                ? 'Zorunlu — personele neden geri gönderildiğini yazın'
                : 'İsteğe bağlı — talep sahibine iletilir'} />
            {/* Hata mesajı kipin İÇİNDE durur; dışarıdaki afiş karartmanın altında kalıyordu. */}
            {error && !redOpen && <div className="alert-error">{error}</div>}
            {notZorunlu && redNot.trim().length < 3 && (
              <p className="text-[12px] text-[#8E8E93]">En az 3 karakter yazın.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setRedOpen(null); setError(null); }}
                className="btn-outline flex-1">Vazgeç</button>
              <button disabled={pending || (notZorunlu && redNot.trim().length < 3)}
                onClick={() => calistir(redOpen, false, redNot.trim() || undefined)}
                className="btn-danger flex-1">Reddet</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
