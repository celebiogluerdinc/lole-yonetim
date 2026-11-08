'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';
import { updateSupplySettings } from '@/app/(app)/sales/actions';

/**
 * Nokta bazlı tedarik ayarları — F10 tekrar sipariş önerisinin girdileri.
 *
 * Güvenlik stoku GÜN cinsinden: nokta başına tek sayı yetiyor ve şişe
 * karşılığı her ürünün kendi satış hızından çıkıyor. Şişe olarak
 * tutulsaydı her nokta için dört ayrı sayı girilmesi gerekirdi ve
 * liste kısa sürede bakımsız kalırdı.
 */
export default function SupplySettings({
  outletId, leadDays, safetyStockDays, isDefault
}: {
  outletId: string;
  leadDays: number;
  safetyStockDays: number;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lead, setLead] = useState(leadDays);
  const [safety, setSafety] = useState(safetyStockDays);

  // Örnek: günde 6 şişe satan bir ürün için bu ayarlarla ne önerilir
  const example = useMemo(() => {
    const daily = 6, nextCheck = 7, stock = 24;
    const ss = Math.ceil(daily * safety);
    const need = Math.ceil(daily * (lead + nextCheck));
    const bottles = Math.max(need + ss - stock, 0);
    return { ss, bottles, cases: Math.ceil(bottles / 12) };
  }, [lead, safety]);

  async function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await updateSupplySettings(fd);
      if (r?.error) { setErr(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 text-sm rounded-xl bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06] transition-colors">
        <span className="flex items-center gap-2 text-[#D1D1D6]">
          <Truck size={15} className="text-[#8E8E93]" />
          Tedarik {leadDays} gün · güvenlik stoku {safetyStockDays} gün
        </span>
        <span className={`badge ${isDefault ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-[#AEAEB2]'}`}>
          {isDefault ? 'varsayılan' : 'ayarlandı'}
        </span>
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-xl bg-white/[0.03] p-3 space-y-3">
      <input type="hidden" name="outlet_id" value={outletId} />
      {err && <p className="alert-error">{err}</p>}

      <p className="text-[14px] font-medium flex items-center gap-2">
        <Truck size={15} /> Tedarik ayarları
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Tedarik süresi (gün)</label>
          <input type="number" min={0} max={60} name="lead_days" value={lead}
            onChange={e => setLead(Number(e.target.value))} className="input" />
          <p className="text-[12px] text-[#8E8E93] mt-1">Sevkiyat bu noktaya kaç günde ulaşıyor.</p>
        </div>
        <div>
          <label className="label">Güvenlik stoku (gün)</label>
          <input type="number" min={0} max={60} name="safety_stock_days" value={safety}
            onChange={e => setSafety(Number(e.target.value))} className="input" />
          <p className="text-[12px] text-[#8E8E93] mt-1">Kaç günlük ek stok tutulsun.</p>
        </div>
      </div>

      <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-[#AEAEB2]">
        <span className="text-[#8E8E93]">Örnek:</span> günde 6 şişe satan, elinde 24 şişe olan bir ürün
        için 7 gün sonraki kontrolde <strong className="text-[#F0EFEC]">{example.bottles} şişe
        ({example.cases} koli)</strong> önerilir. Güvenlik payı {example.ss} şişe.
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Kaydet</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
      </div>
    </form>
  );
}
