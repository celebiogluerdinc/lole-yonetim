'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { postAnnouncement } from '@/app/(app)/announcements/actions';

export default function AnnouncementComposer({
  departments, companyWide
}: { departments: { id: string; name: string }[]; companyWide: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-full !py-3">
        <Megaphone size={16} /> Yeni Duyuru Yayınla
      </button>
    );
  }

  return (
    <form
      ref={ref}
      action={(fd) => start(async () => {
        setError(null);
        const r = await postAnnouncement(fd);
        if (r?.error) setError(r.error);
        else { ref.current?.reset(); setOpen(false); router.refresh(); }
      })}
      className="card p-5 space-y-3 border-brand-200"
    >
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div>
        <label className="label">Başlık *</label>
        <input name="title" required className="input" placeholder="Duyuru başlığı" />
      </div>
      <div>
        <label className="label">İçerik *</label>
        <textarea name="body" required rows={4} className="input" placeholder="Ekibinize iletmek istediğiniz mesaj…" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="label">Hedef</label>
          <select name="department_id" className="input" defaultValue={companyWide ? '' : departments[0]?.id}>
            {companyWide && <option value="">🏢 Tüm şirket (Pano)</option>}
            {departments.map(d => <option key={d.id} value={d.id}>📍 {d.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2.5 cursor-pointer">
          <input type="checkbox" name="is_pinned" className="rounded accent-[#ff5a1f] w-4 h-4" />
          📌 Panoya sabitle
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1">Vazgeç</button>
        <button className="btn-primary flex-1" disabled={pending}>
          {pending ? 'Yayınlanıyor…' : 'Yayınla'}
        </button>
      </div>
    </form>
  );
}
