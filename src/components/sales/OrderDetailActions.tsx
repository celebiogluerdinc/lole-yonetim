'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PackageCheck, ClipboardCheck, Truck, CheckCircle2, X } from 'lucide-react';
import {
  confirmOrderStock, acceptOrder, setOrderStatus, linkOrderToVisit, addCommerceFollowUp
} from '@/app/(app)/sales/orders/actions';
import { SalesStep, NextStepCard } from '@/components/sales/OrdersClient';

interface PersonLite { id: string; full_name: string }
interface VisitLite { id: string; visit_date: string; outcome: string }

/**
 * SİPARİŞ İŞLEMLERİ (F06)
 *
 * Teklif detayıyla aynı düzen: en tepede "Sıradaki adım" kartı — her
 * durumda TEK birincil buton ve kilitliyse NEDENİ — ardından onay/kontrol
 * ve en sonda takip.
 *
 * İki teyit ayrı ayrı: stok/sevk ve sipariş kabulü. Stok teyidi
 * verilmeden "Onayla" açılmıyor; veritabanı da reddediyor, arayüz bunu
 * önceden söylüyor.
 */
export default function OrderDetailActions({
  order, people, linkableVisits
}: {
  order: {
    id: string; outlet_id: string; status: string;
    stock_confirmed_at: string | null; stock_confirmed_by_name: string | null;
    order_accepted_at: string | null; order_accepted_by_name: string | null;
    visit_id: string | null; cancel_reason: string | null;
  };
  people: PersonLite[];
  linkableVisits: VisitLite[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelText, setCancelText] = useState('');
  const [fupOpen, setFupOpen] = useState(false);
  const [visitId, setVisitId] = useState('');

  const open = !['iptal', 'teslim'].includes(order.status);

  function run(fn: () => Promise<any>) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) { setErr(r.error); return; }
        setCancelOpen(false); setFupOpen(false);
        router.refresh();
      } catch {
        setErr('İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyin.');
      }
    });
  }

  const nextStep = (() => {
    if (order.status === 'iptal') {
      return {
        title: 'Sipariş iptal edildi',
        hint: 'İptal edilmiş siparişte yapılacak işlem yok.',
        blocked: null as string | null,
        button: null as React.ReactNode
      };
    }
    if (order.status === 'teslim') {
      return {
        title: 'Teslim edildi — zincir kapandı',
        hint: 'Teslimden 48–72 saat sonra memnuniyet takibi yapılması kuraldır. Takip kaydını aşağıdan ekleyin.',
        blocked: null,
        button: null
      };
    }
    if (!order.stock_confirmed_at) {
      return {
        title: 'Stok ve sevk teyidi ver',
        hint: 'Teyit verilmeden sipariş onaylanamaz; depo tarafı bu teyitle sevke başlar.',
        blocked: null,
        button: (
          <button disabled={pending} onClick={() => run(() => confirmOrderStock(order.id))}
            className="btn-primary">
            <PackageCheck size={16} /> Teyit ver
          </button>
        )
      };
    }
    if (['taslak', 'onay_bekliyor'].includes(order.status)) {
      return {
        title: 'Siparişi onayla',
        hint: 'Stok teyidi tamam. Onaydan sonra sevk adımına geçilir.',
        blocked: null,
        button: (
          <button disabled={pending} onClick={() => run(() => setOrderStatus(order.id, 'onayli'))}
            className="btn-primary">
            <CheckCircle2 size={16} /> Siparişi onayla
          </button>
        )
      };
    }
    if (order.status === 'onayli') {
      return {
        title: 'Sevk edildi olarak işaretle',
        hint: 'Ürün yola çıktığında işaretleyin; teslim teyidi bir sonraki adım.',
        blocked: null,
        button: (
          <button disabled={pending} onClick={() => run(() => setOrderStatus(order.id, 'sevk_edildi'))}
            className="btn-primary">
            <Truck size={16} /> Sevk edildi
          </button>
        )
      };
    }
    return {
      title: 'Teslim teyidi al',
      hint: 'Teslim alan kişiyle teyitleyip işaretleyin; zincir burada kapanır.',
      blocked: null,
      button: (
        <button disabled={pending} onClick={() => run(() => setOrderStatus(order.id, 'teslim'))}
          className="btn-primary">
          <CheckCircle2 size={16} /> Teslim edildi
        </button>
      )
    };
  })();

  return (
    <div className="space-y-5">
      {err && <p className="alert-error">{err}</p>}

      <NextStepCard title={nextStep.title} hint={nextStep.hint} blocked={nextStep.blocked}>
        {nextStep.button}
        {open && (
          <button disabled={pending} onClick={() => setCancelOpen(v => !v)} className="btn-ghost">
            <X size={15} /> İptal
          </button>
        )}
      </NextStepCard>

      {cancelOpen && (
        <section className="card p-5 space-y-2">
          <p className="section-title">İptal sebebi</p>
          <input value={cancelText} onChange={e => setCancelText(e.target.value)}
            className="input" placeholder="İptal sebebi (zorunlu)" />
          <div className="flex gap-2">
            <button disabled={pending || !cancelText.trim()}
              onClick={() => run(() => setOrderStatus(order.id, 'iptal', cancelText))}
              className="btn-danger disabled:opacity-40">İptali kaydet</button>
            <button onClick={() => setCancelOpen(false)} className="btn-ghost">Vazgeç</button>
          </div>
        </section>
      )}

      {order.cancel_reason && (
        <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
          İptal sebebi: {order.cancel_reason}
        </p>
      )}

      {/* ---------- ONAY & KONTROL ---------- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Onay ve kontrol</p>
        <Confirm
          title="Stok ve Sevk Teyidi" at={order.stock_confirmed_at} by={order.stock_confirmed_by_name}
          disabled={pending || !open} icon={<PackageCheck size={14} />}
          onClick={() => run(() => confirmOrderStock(order.id))}
        />
        <Confirm
          title="Sipariş Kabulü" at={order.order_accepted_at} by={order.order_accepted_by_name}
          disabled={pending || !open} icon={<ClipboardCheck size={14} />}
          onClick={() => run(() => acceptOrder(order.id))}
        />
        <p className="text-[12px] text-[#8E8E93]">
          Şu an tüm departmanlar teyit verebiliyor.
        </p>
      </section>

      {/* Ziyarete bağla — ziyaret "sipariş" sonucuyla kapanacaksa bu bağ şart */}
      {!order.visit_id && linkableVisits.length > 0 && (
        <section className="card p-5 space-y-3">
          <p className="section-title">Ziyarete bağla</p>
          <p className="text-[13px] text-[#8E8E93]">
            Bir ziyaret &quot;sipariş&quot; sonucuyla kapatılacaksa bağlı sipariş kaydı zorunludur.
          </p>
          <div className="flex gap-2">
            <select value={visitId} onChange={e => setVisitId(e.target.value)} className="input">
              <option value="">Ziyaret seçin…</option>
              {linkableVisits.map(v => (
                <option key={v.id} value={v.id}>
                  {new Date(v.visit_date).toLocaleDateString('tr-TR')} · {v.outcome}
                </option>
              ))}
            </select>
            <button disabled={!visitId || pending}
              onClick={() => run(() => linkOrderToVisit(order.id, visitId))}
              className="btn-outline shrink-0 disabled:opacity-40">Bağla</button>
          </div>
        </section>
      )}

      {/* ---------- 5 · SONUÇ & TAKİP ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={5} title="Sonuç & Takip" sub="Tek sorumlu ve son tarih" />
        {!fupOpen ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFupOpen(true)} className="btn-ghost text-sm">Takip ekle</button>
            <Link href={`/sales/orders/quotes/new?outlet=${order.outlet_id}`} className="btn-ghost text-sm">
              Aynı noktaya yeni teklif
            </Link>
          </div>
        ) : (
          <form action={(fd) => run(() => addCommerceFollowUp(fd))} className="space-y-3">
            <input type="hidden" name="source_type" value="order" />
            <input type="hidden" name="source_id" value={order.id} />
            <input type="hidden" name="outlet_id" value={order.outlet_id} />
            <input name="action" className="input" placeholder="Yapılacak işlem" required />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Tek sorumlu</label>
                <select name="owner_user_id" className="input" defaultValue="">
                  <option value="">Ben</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Son tarih</label>
                <input type="date" name="due_date" className="input" required />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-primary">Kaydet</button>
              <button type="button" onClick={() => setFupOpen(false)} className="btn-ghost">Vazgeç</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Confirm({
  title, at, by, disabled, icon, onClick
}: {
  title: string; at: string | null; by: string | null;
  disabled: boolean; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12px] text-[#8E8E93]">
          {at
            ? `${by ?? 'bilinmeyen'} · ${new Date(at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`
            : 'bekliyor'}
        </p>
      </div>
      {!at && (
        <button onClick={onClick} disabled={disabled}
          className="btn-outline !py-1.5 !text-[13px] disabled:opacity-30">
          {icon} Teyit ver
        </button>
      )}
    </div>
  );
}
