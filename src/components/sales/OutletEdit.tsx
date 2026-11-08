'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { updateOutlet } from '@/app/(app)/sales/actions';
import OutletForm, {
  type OutletFormValues, type OutletTypeRow, type OutletRoleContacts
} from '@/components/sales/OutletForm';

interface OutletRow extends OutletFormValues { id: string; name: string }

/**
 * Nokta bilgilerini düzenleme.
 *
 * Alan seti OutletForm'dan geliyor: oluşturma ve düzenleme aynı sırada
 * aynı alanları gösteriyor. Kart üzerinden açılıyor ki temsilci başka
 * ekrana gitmesin.
 */
export default function OutletEdit({
  outlet, types, contacts, defaultOpen = false, label = 'Bilgileri düzenle'
}: {
  outlet: OutletRow;
  types: OutletTypeRow[];
  contacts?: OutletRoleContacts;
  /** Eksik bilgi varsa form kapalı gelmesin: temsilci bir tıkla tamamlasın. */
  defaultOpen?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(defaultOpen);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(outlet.name ?? '');

  const onName = useCallback((v: string) => setName(v), []);

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      let r: { ok?: boolean; error?: string } | undefined;
      try {
        r = await updateOutlet(fd);
      } catch (e: any) {
        setErr(`Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`);
        return;
      }
      if (r?.error) { setErr(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-sm">
        <Pencil size={15} /> {label}
      </button>
    );
  }

  const blocker = !name.trim() ? 'Nokta adı girin' : null;

  return (
    <form action={onSubmit} className="rounded-xl bg-white/[0.03] p-4 space-y-5">
      <input type="hidden" name="outlet_id" value={outlet.id} />
      <p className="text-[15px] font-semibold">Nokta bilgileri</p>

      <OutletForm types={types} mode="edit" values={outlet}
        onNameChange={onName} contacts={contacts} />

      <div className="space-y-2">
        {err && <p className="alert-error">{err}</p>}
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={!!blocker || pending} className="btn-primary disabled:opacity-40">
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
          {blocker && !pending && <span className="text-[12px] text-amber-300">{blocker}</span>}
        </div>
      </div>
    </form>
  );
}
