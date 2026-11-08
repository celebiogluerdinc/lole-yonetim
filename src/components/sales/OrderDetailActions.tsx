'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PackageCheck, ClipboardCheck, Truck, CheckCircle2, X } from 'lucide-react';
import {
  confirmOrderStock, acceptOrder, setOrderStatus, linkOrderToVisit, addCommerceFollowUp
} from '@/app/(app)/sales/orders/actions';

interface PersonLite { id: string; full_name: string }
interface VisitLite { id: string; visit_date: string; outcome: string }

/**
 * SİPARİŞ İŞLEMLERİ (F06)
 *
 * İki teyit — stok/sevk ve sipariş kabulü — ayrı ayrı. Stok teyidi
 * verilmeden "Onayla" açılmıyor; veritabanı da reddediyor, arayüz
 * bunu önceden gösteriyor.
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
      const r = await fn();
      if (r?.error) { setErr(r.error); return; }
      setCancelOpen(false); setFupOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {err && <p className="alert-error">{err}</p>}

      <section className="card p-5 space-y-3">
        <p className="section-title">Teyitler</p>

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

        {open && (
          <div className="flex flex-wrap gap-2 pt-1">
            {['taslak', 'onay_bekliyor'].includes(order.status) && (
              <button disabled={!order.stock_confirmed_at || pending}
                onClick={() => run(() => setOrderStatus(order.id, 'onayli'))}
                className="btn-primary disabled:opacity-40"
                title={order.stock_confirmed_at ? '' : 'Önce stok ve sevk teyidi gerekli'}>
                <CheckCircle2 size={16} /> Siparişi onayla
              </button>
            )}
            {order.status === 'onayli' && (
              <button disabled={pending} onClick={() => run(() => setOrderStatus(order.id, 'sevk_edildi'))}
                className="btn-outline">
                <Truck size={15} /> Sevk edildi
              </button>
            )}
            {order.status === 'sevk_edildi' && (
              <button disabled={pending} onClick={() => run(() => setOrderStatus(order.id, 'teslim'))}
                className="btn-primary">
                <CheckCircle2 size={16} /> Teslim edildi
              </button>
            )}
            <button disabled={pending} onClick={() => setCancelOpen(v => !v)} className="btn-ghost">
              <X size={15} /> İptal
            </button>
          </div>
        )}

        {cancelOpen && (
          <div className="rounded-xl bg-white/[0.03] p-3 space-y-2">
            <input value={cancelText} onChange={e => setCancelText(e.target.value)}
              className="input" placeholder="İptal sebebi (zorunlu)" />
            <button disabled={pending} onClick={() => run(() => setOrderStatus(order.id, 'iptal', cancelText))}
              className="btn-danger">İptali kaydet</button>
          </div>
        )}

        {order.cancel_reason && (
          <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            İptal sebebi: {order.cancel_reason}
          </p>
        )}
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

      <section className="card p-5 space-y-3">
        <p className="section-title">Sonraki adım ve kontrol</p>
        {!fupOpen ? (
          <button onClick={() => setFupOpen(true)} className="btn-ghost text-sm">Takip ekle</button>
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
