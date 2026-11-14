'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Eye } from 'lucide-react';
import { deleteOutlet, setOutletActive } from '@/app/(app)/sales/actions';
import DeleteButton from '@/components/sales/DeleteButton';

/**
 * Noktanın silme / pasife alma kontrolleri.
 *
 * Ayrı bir istemci bileşeni olmasının sebebi teknik: sunucu bileşeni
 * istemciye kapanış fonksiyonu (closure) geçiremiyor. Nokta kimliği
 * buraya veri olarak geliyor, action çağrısı burada kuruluyor.
 */
export default function OutletDangerZone({
  outletId, name, isActive
}: { outletId: string; name: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    setErr(null);
    start(async () => {
      const r = await setOutletActive(outletId, !isActive);
      if (r?.error) { setErr(r.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} disabled={pending}
          className="btn-ghost text-sm disabled:opacity-40">
          {isActive ? <EyeOff size={15} /> : <Eye size={15} />}
          {pending ? 'Kaydediliyor…' : isActive ? 'Pasife al' : 'Yeniden aktifleştir'}
        </button>

        <DeleteButton
          label="Noktayı sil"
          title="Nokta silinsin mi?"
          message={`${name} silinecek. Bu noktaya bağlı ziyaret, teklif veya sipariş varsa silinmez — pasife alınır.`}
          action={r => deleteOutlet(outletId, r)}
          redirectTo="/sales/outlets"
          size="md"
        />
      </div>
      <p className="text-[12px] text-[#8E8E93]">
        Pasif nokta listelerde ve rotada çıkmaz; geçmiş ziyaret ve raporlar korunur.
      </p>
      {err && <p className="text-[12px] text-ios-red">{err}</p>}
    </div>
  );
}
