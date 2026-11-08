'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ShieldAlert, AlertTriangle, PackageCheck } from 'lucide-react';
import { createComplaint, updateComplaint } from '@/app/(app)/sales/complaints/actions';
import ReorderPlanForm from '@/components/sales/ReorderPlanForm';
import { fmtDate } from '@/lib/utils';

export const CATEGORY_LABEL: Record<string, string> = {
  teslimat_hasari: 'Teslimat hasarı',
  tat_beklentisi: 'Tat beklentisi',
  hizmet: 'Hizmet',
  urun_guvenligi: 'Ürün güvenliği şüphesi',
  diger: 'Diğer'
};
const CATEGORY_COLOR: Record<string, string> = {
  teslimat_hasari: 'bg-amber-500/20 text-amber-300',
  tat_beklentisi: 'bg-indigo-500/20 text-indigo-300',
  hizmet: 'bg-blue-500/20 text-blue-300',
  urun_guvenligi: 'bg-rose-500/20 text-rose-300',
  diger: 'bg-white/10 text-[#AEAEB2]'
};
const STATUS_LABEL: Record<string, string> = {
  acik: 'Açık', incelemede: 'İncelemede', cozuldu: 'Çözüldü', reddedildi: 'Reddedildi'
};
const STATUS_COLOR: Record<string, string> = {
  acik: 'bg-amber-500/20 text-amber-300',
  incelemede: 'bg-blue-500/20 text-blue-300',
  cozuldu: 'bg-emerald-500/20 text-emerald-300',
  reddedildi: 'bg-white/10 text-[#8E8E93]'
};
const CHECKPOINT_LABEL: Record<string, string> = {
  '48_72_saat': '48–72 saat', '7_gun': '7. gün', '14_gun': '14. gün', rutin: 'Rutin takip'
};

interface Outlet { id: string; name: string; city: string | null; district: string | null; lead_days: number; safety_stock_days: number }
interface Product { id: string; name: string }
interface Batch { id: string; product_id: string; batch_no: string; expiry_date: string | null }

export default function ComplaintsClient({
  complaints, plans, outlets, products, batches
}: { complaints: any[]; plans: any[]; outlets: Outlet[]; products: Product[]; batches: Batch[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [tab, setTab] = useState<'sikayet' | 'tekrar'>('sikayet');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [category, setCategory] = useState('teslimat_hasari');
  const [productId, setProductId] = useState('');
  const [quarantined, setQuarantined] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const isSafety = category === 'urun_guvenligi';
  const pBatches = useMemo(
    () => batches.filter(b => b.product_id === productId), [batches, productId]
  );
  const safetyOpen = useMemo(
    () => complaints.filter(c => c.category === 'urun_guvenligi' && ['acik', 'incelemede'].includes(c.status)),
    [complaints]
  );

  function run(fn: (fd: FormData) => Promise<any>, fd: FormData, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn(fd);
      if (r?.error) { setErr(r.error); return; }
      after?.();
      router.refresh();
    });
  }

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Şikâyet & Tekrar Sipariş</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {complaints.length} şikâyet · {plans.length} tekrar sipariş planı
          </p>
        </div>
      </header>

      {safetyOpen.length > 0 && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert size={16} /> {safetyOpen.length} açık ürün güvenliği şikâyeti var
          </p>
          <p className="text-[13px] mt-1 text-rose-200/80">
            Bu şikâyetlere bağlı partiler <strong>tadıma kapalıdır</strong> — inceleme kapanana
            kadar sahada tattırılamaz. Partiler:{' '}
            {safetyOpen.map(c => c.product_batches?.batch_no).filter(Boolean).join(', ') || '(parti girilmemiş)'}
          </p>
        </div>
      )}

      <div className="flex gap-1.5">
        {([['sikayet', 'Şikâyetler'], ['tekrar', 'Tekrar Sipariş']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === k ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'
            }`}>{l}</button>
        ))}
      </div>

      {err && <p className="alert-error">{err}</p>}

      {/* ---------------- ŞİKÂYETLER (F11) ---------------- */}
      {tab === 'sikayet' && (
        <>
          <button onClick={() => setOpen(v => !v)} className="btn-primary">
            <Plus size={16} /> Şikâyet Kaydet
          </button>

          {open && (
            <form action={(fd) => run(createComplaint, fd, () => setOpen(false))}
              className="card p-5 space-y-4">
              <p className="section-title">Yeni şikâyet</p>

              <div>
                <label className="label">Kategori *</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setCategory(v)}
                      className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                        category === v ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6]'
                      }`}>{l}</button>
                  ))}
                </div>
                <input type="hidden" name="category" value={category} />
              </div>

              {isSafety && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-[13px] text-rose-300 flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Ürün güvenliği şüphesinde ürün <strong>satıştan ayrılmalı</strong> ve
                    <strong> yeniden tadım yaptırılmamalı</strong>. Parti seçilirse o parti
                    otomatik olarak tadıma kapanır. Karantina girilmeden şikâyet "çözüldü" olarak kapatılamaz.
                  </span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nokta *</label>
                  <select name="outlet_id" required className="input" defaultValue="">
                    <option value="" disabled>Seçin</option>
                    {outlets.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name}{o.district ? ` · ${o.district}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Sipariş / sevk belgesi</label>
                  <input name="shipment_doc_no" className="input" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Ürün {isSafety && '*'}</label>
                  <select name="product_id" className="input" value={productId}
                    onChange={e => setProductId(e.target.value)}>
                    <option value="">—</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Parti / TETT</label>
                  <select name="batch_id" className="input" defaultValue="">
                    <option value="">—</option>
                    {pBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batch_no}{b.expiry_date ? ` · ${b.expiry_date}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Adet</label>
                  <input type="number" min={0} name="quantity" className="input" />
                </div>
              </div>

              <div>
                <label className="label">Bildirilen olay *</label>
                <textarea name="event_description" rows={3} required className="input"
                  placeholder="Ne oldu, ne zaman, kim bildirdi" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Bildirim yapılan yetkili</label>
                  <input name="notified_person" className="input" />
                </div>
                <div>
                  <label className="label">TETT (parti yoksa elle)</label>
                  <input type="date" name="expiry_date" className="input" />
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="quarantined" checked={quarantined}
                    onChange={e => setQuarantined(e.target.checked)} />
                  Ürün satıştan ayrıldı (karantina)
                </label>
                {quarantined && (
                  <div>
                    <label className="label">Karantina adedi *</label>
                    <input type="number" min={1} name="quarantined_qty" className="input" required />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn-primary">Kaydet</button>
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
              </div>
            </form>
          )}

          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {complaints.length === 0 && (
              <div className="p-10 text-center">
                <p className="text-3xl mb-2">✓</p>
                <p className="text-[15px] text-[#8E8E93]">Kayıtlı şikâyet yok.</p>
              </div>
            )}
            {complaints.map(c => (
              <div key={c.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/sales/outlets/${c.outlets?.id}`}
                        className="text-[15px] font-medium hover:underline">
                        {c.outlets?.name ?? 'Nokta'}
                      </Link>
                      <span className={`badge ${CATEGORY_COLOR[c.category]}`}>
                        {CATEGORY_LABEL[c.category]}
                      </span>
                      {c.quarantined && (
                        <span className="badge bg-rose-500/20 text-rose-300">
                          karantina {c.quarantined_qty ?? ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#8E8E93] mt-0.5">
                      {fmtDate(c.reported_at)}
                      {c.products?.name ? ` · ${c.products.name}` : ''}
                      {c.product_batches?.batch_no ? ` · parti ${c.product_batches.batch_no}` : ''}
                      {c.profiles?.full_name ? ` · ${c.profiles.full_name}` : ''}
                    </p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{c.event_description}</p>
                    {c.investigation_result && (
                      <p className="text-[13px] text-[#AEAEB2] mt-1">
                        <span className="text-[#8E8E93]">Sonuç:</span> {c.investigation_result}
                      </p>
                    )}
                  </div>
                  <span className={`badge shrink-0 ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>

                {editing === c.id ? (
                  <form action={(fd) => run(updateComplaint, fd, () => setEditing(null))}
                    className="rounded-xl bg-white/[0.03] p-3 space-y-3">
                    <input type="hidden" name="complaint_id" value={c.id} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Durum</label>
                        <select name="status" className="input" defaultValue={c.status}>
                          {Object.entries(STATUS_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Değişim / sevk / iade belge no</label>
                        <input name="resolution_doc_no" className="input"
                          defaultValue={c.resolution_doc_no ?? ''} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Talep / inceleme sonucu / onaylanan işlem</label>
                      <textarea name="investigation_result" rows={2} className="input"
                        defaultValue={c.investigation_result ?? ''} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="quarantined" defaultChecked={c.quarantined} />
                        Satıştan ayrıldı
                      </label>
                      <div>
                        <label className="label">Karantina adedi</label>
                        <input type="number" min={0} name="quarantined_qty" className="input"
                          defaultValue={c.quarantined_qty ?? ''} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="outlet_confirmed" defaultChecked={c.outlet_confirmed} />
                      İşletme teyit etti
                    </label>
                    {c.category === 'urun_guvenligi' && (
                      <p className="text-[12px] text-rose-300">
                        Ürün güvenliği: karantina işaretlenmeden "Çözüldü" seçilemez.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary">Kaydet</button>
                      <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Vazgeç</button>
                    </div>
                  </form>
                ) : (
                  c.status !== 'cozuldu' && (
                    <button onClick={() => setEditing(c.id)} className="btn-ghost text-sm">
                      Sonuçlandır
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------------- TEKRAR SİPARİŞ (F10) ---------------- */}
      {tab === 'tekrar' && (
        <>
          <ReorderPlanForm outlets={outlets} products={products} />

          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {plans.length === 0 && (
              <div className="p-10 text-center">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-[15px] text-[#8E8E93]">Henüz tekrar sipariş planı yok.</p>
              </div>
            )}
            {plans.map(p => {
              const items = p.reorder_plan_items ?? [];
              const totalCases = items.reduce((a: number, i: any) => a + (i.suggested_cases ?? 0), 0);
              return (
                <div key={p.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link href={`/sales/outlets/${p.outlets?.id}`}
                          className="text-[15px] font-medium hover:underline">
                          {p.outlets?.name ?? 'Nokta'}
                        </Link>
                        <span className="badge bg-indigo-500/20 text-indigo-300">
                          {CHECKPOINT_LABEL[p.checkpoint] ?? p.checkpoint}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#8E8E93] mt-0.5">
                        {fmtDate(p.created_at)} · sonraki kontrol {p.next_check_days} gün sonra
                      </p>
                    </div>
                    <span className="badge bg-emerald-500/20 text-emerald-300 shrink-0 flex items-center gap-1">
                      <PackageCheck size={12} /> {totalCases} koli
                    </span>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="text-[#8E8E93]">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium">Ürün</th>
                          <th className="px-3 py-2 font-medium text-right">Stok</th>
                          <th className="px-3 py-2 font-medium text-right">Günlük</th>
                          <th className="px-3 py-2 font-medium text-right">Güvenlik</th>
                          <th className="px-3 py-2 font-medium text-right">Öneri</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i: any) => (
                          <tr key={i.product_id} className="border-t border-white/[0.06]">
                            <td className="px-3 py-1.5">{i.products?.name}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{i.current_stock}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{i.daily_sales}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{i.safety_stock}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                              {i.suggested_bottles} şişe
                              <span className="text-[#8E8E93]"> / {i.suggested_cases} koli</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(p.slow_product_reason || p.single_improvement) && (
                    <div className="text-[13px] space-y-0.5">
                      {p.slow_product_reason && (
                        <p><span className="text-[#8E8E93]">Yavaş ürün nedeni:</span> {p.slow_product_reason}</p>
                      )}
                      {p.single_improvement && (
                        <p><span className="text-[#8E8E93]">Uygulanacak tek iyileştirme:</span> {p.single_improvement}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
