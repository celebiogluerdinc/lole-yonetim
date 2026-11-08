'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calculator } from 'lucide-react';
import { createReorderPlan, reorderSuggestion } from '@/app/(app)/sales/complaints/actions';

interface Outlet {
  id: string; name: string; city: string | null; district: string | null;
  lead_days: number; safety_stock_days: number;
}
interface Product { id: string; name: string }

const CHECKPOINTS = [
  { v: '48_72_saat', l: '48–72 saat', days: 5 },
  { v: '7_gun', l: '7. gün', days: 7 },
  { v: '14_gun', l: '14. gün', days: 14 },
  { v: 'rutin', l: 'Rutin takip', days: 14 }
] as const;

type Preview = Record<string, { bottles: number; cases: number; safety: number }>;

/**
 * F10 Takip ve tekrar sipariş planı.
 *
 * Öneri hesabı arayüzde tekrar YAZILMAZ: veritabanındaki
 * fn_reorder_suggestion çağrılır. Formülün tek bir doğrusu olsun diye —
 * iki yerde yazılsaydı biri sessizce eskirdi.
 */
export default function ReorderPlanForm({
  outlets, products
}: { outlets: Outlet[]; products: Product[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [outletId, setOutletId] = useState('');
  const [checkpoint, setCheckpoint] = useState<string>('7_gun');
  const [nextDays, setNextDays] = useState(7);
  const [rows, setRows] = useState<Record<string, { stock: string; daily: string }>>({});
  const [preview, setPreview] = useState<Preview>({});
  const [calculating, setCalculating] = useState(false);

  const outlet = outlets.find(o => o.id === outletId);

  function setRow(pid: string, k: 'stock' | 'daily', v: string) {
    setRows(r => ({ ...r, [pid]: { stock: r[pid]?.stock ?? '', daily: r[pid]?.daily ?? '', [k]: v } }));
    setPreview({});   // girdi değişti, eski hesap geçersiz
  }

  async function calculate() {
    if (!outletId) { setErr('Önce nokta seçin.'); return; }
    setErr(null); setCalculating(true);
    const next: Preview = {};
    for (const p of products) {
      const r = rows[p.id];
      const daily = Number(r?.daily ?? 0);
      const stock = Number(r?.stock ?? 0);
      if (!daily && !stock) continue;
      const res = await reorderSuggestion(outletId, daily, stock, nextDays);
      if ('error' in res && res.error) { setErr(res.error); setCalculating(false); return; }
      next[p.id] = {
        bottles: (res as any).suggested_bottles ?? 0,
        cases: (res as any).suggested_cases ?? 0,
        safety: (res as any).safety_stock ?? 0
      };
    }
    setPreview(next);
    setCalculating(false);
  }

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await createReorderPlan(fd);
      if (r?.error) { setErr(r.error); return; }
      setOpen(false); setRows({}); setPreview({}); setOutletId('');
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> Tekrar Sipariş Planı
      </button>
    );
  }

  return (
    <form action={onSubmit} className="card p-5 space-y-4">
      <p className="section-title">Tekrar sipariş planı</p>
      {err && <p className="alert-error">{err}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nokta *</label>
          <select name="outlet_id" required className="input" value={outletId}
            onChange={e => { setOutletId(e.target.value); setPreview({}); }}>
            <option value="" disabled>Seçin</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}{o.district ? ` · ${o.district}` : ''}</option>
            ))}
          </select>
          {outlet && (
            <p className="text-[12px] text-[#8E8E93] mt-1">
              Tedarik {outlet.lead_days} gün · güvenlik stoku {outlet.safety_stock_days} gün
              {' '}(nokta kartından ayarlanır)
            </p>
          )}
        </div>
        <div>
          <label className="label">İlk sipariş tarihi</label>
          <input type="date" name="first_order_date" className="input" />
        </div>
      </div>

      <div>
        <label className="label">Kontrol noktası</label>
        <div className="flex flex-wrap gap-1.5">
          {CHECKPOINTS.map(c => (
            <button key={c.v} type="button"
              onClick={() => { setCheckpoint(c.v); setNextDays(c.days); setPreview({}); }}
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                checkpoint === c.v ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6]'
              }`}>{c.l}</button>
          ))}
        </div>
        <input type="hidden" name="checkpoint" value={checkpoint} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Bir sonraki kontrol (gün)</label>
          <input type="number" min={1} max={120} name="next_check_days" className="input"
            value={nextDays} onChange={e => { setNextDays(Number(e.target.value)); setPreview({}); }} />
        </div>
        <div>
          <label className="label">Veri dönemi / kaynağı</label>
          <input name="data_period" className="input" placeholder="son 14 gün · kasa raporu" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[14px] font-medium">Ürünler</p>
        <p className="text-[12px] text-[#8E8E93]">
          Mevcut stok ve günlük ücretli satış saha gözlemidir — stok defterinden değil,
          noktada sayılarak veya işletmeden öğrenilerek girilir.
        </p>
        {products.map(p => (
          <div key={p.id} className="rounded-xl bg-white/[0.03] p-3">
            <input type="hidden" name="product_id" value={p.id} />
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[14px] font-medium">{p.name}</p>
              {preview[p.id] && (
                <span className="badge bg-emerald-500/20 text-emerald-300 tabular-nums">
                  {preview[p.id].bottles} şişe · {preview[p.id].cases} koli
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label !text-[12px]">Mevcut stok</label>
                <input type="number" min={0} name={`stock_${p.id}`} className="input !py-2 !text-[13px]"
                  value={rows[p.id]?.stock ?? ''} onChange={e => setRow(p.id, 'stock', e.target.value)} />
              </div>
              <div>
                <label className="label !text-[12px]">Günlük satış</label>
                <input type="number" min={0} step="0.1" name={`daily_${p.id}`}
                  className="input !py-2 !text-[13px]"
                  value={rows[p.id]?.daily ?? ''} onChange={e => setRow(p.id, 'daily', e.target.value)} />
              </div>
              <div>
                <label className="label !text-[12px]">Güvenlik (şişe)</label>
                <input type="number" min={0} name={`safety_${p.id}`} className="input !py-2 !text-[13px]"
                  placeholder={preview[p.id] ? String(preview[p.id].safety) : 'otomatik'} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={calculate} disabled={calculating} className="btn-outline">
        <Calculator size={16} /> {calculating ? 'Hesaplanıyor…' : 'Öneriyi hesapla'}
      </button>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Tahsilat durumu</label>
          <input name="collection_status" className="input" />
        </div>
        <div>
          <label className="label">Tahsilat belge no</label>
          <input name="collection_doc_no" className="input" />
        </div>
      </div>

      <div>
        <label className="label">Yavaş ürün nedeni</label>
        <textarea name="slow_product_reason" rows={2} className="input" />
      </div>
      <div>
        <label className="label">Uygulanacak TEK iyileştirme</label>
        <input name="single_improvement" className="input"
          placeholder="Tek bir şey yazın — liste değil" />
        <p className="text-[12px] text-[#8E8E93] mt-1">
          Bir ziyarette birden fazla şeyi düzeltmeye çalışmak hiçbirini düzeltmemekle sonuçlanır.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Planı kaydet</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
      </div>
    </form>
  );
}
