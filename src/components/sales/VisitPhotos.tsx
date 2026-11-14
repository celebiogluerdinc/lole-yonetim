'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { uploadVisitPhotos } from '@/app/(app)/sales/actions';
import { shrinkImage } from '@/lib/image-shrink';

const KIND_LABEL: Record<string, string> = {
  raf: 'Raf', dolap: 'Dolap', teshir: 'Teşhir', tadim: 'Tadım', diger: 'Diğer'
};

/**
 * ZİYARET FOTOĞRAFLARI
 *
 * Raf ve dolap fotoğrafı ziyaretin kanıtı: "ürün rafta mı, göz
 * hizasında mı" sorusunun cevabı söz değil görüntü. Fotoğraflar
 * gönderilmeden önce küçültülüyor (lib/image-shrink) ve tek tek
 * yükleniyor — biri takılırsa diğerleri kaybolmuyor.
 */
export default function VisitPhotos({
  visitId, photos, canAdd, max = 8
}: {
  visitId: string;
  photos: { id: string; url: string | null; kind: string | null; file_name: string | null }[];
  canAdd: boolean;
  max?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState('raf');
  const [msg, setMsg] = useState<string | null>(null);
  const room = Math.max(0, max - photos.length);

  function onPick(files: File[]) {
    if (!files.length) return;
    setMsg(null);
    start(async () => {
      let failed = 0, lastErr = '';
      for (const f of files.slice(0, room)) {
        try {
          const fd = new FormData();
          fd.set('visit_id', visitId);
          fd.set('kind', kind);
          fd.append('photos', await shrinkImage(f));
          const r: any = await uploadVisitPhotos(fd);
          if (r?.error) { failed++; lastErr = r.error; }
        } catch {
          failed++; lastErr = 'Bağlantı kesildi.';
        }
      }
      if (failed) setMsg(`${failed} fotoğraf yüklenemedi. ${lastErr}`);
      router.refresh();
    });
  }

  if (!photos.length && !canAdd) return null;

  return (
    <section className="card p-5 space-y-3">
      <p className="section-title">Fotoğraflar{photos.length ? ` (${photos.length})` : ''}</p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(p => p.url ? (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer"
              className="relative block aspect-square rounded-xl overflow-hidden bg-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.file_name ?? 'Ziyaret fotoğrafı'} loading="lazy"
                className="w-full h-full object-cover" />
              {p.kind && (
                <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/60 text-white text-[10.5px] font-semibold px-1.5 py-0.5">
                  {KIND_LABEL[p.kind] ?? p.kind}
                </span>
              )}
            </a>
          ) : (
            <div key={p.id}
              className="aspect-square rounded-xl bg-white/[0.06] flex items-center justify-center text-[11px] text-[#8E8E93] text-center px-1">
              açılamadı
            </div>
          ))}
        </div>
      )}

      {canAdd && room > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-noprint>
          <select value={kind} onChange={e => setKind(e.target.value)} className="input !w-auto">
            {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className={`btn-outline cursor-pointer ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
            <Camera size={16} /> {pending ? 'Yükleniyor…' : 'Fotoğraf ekle'}
            <input type="file" accept="image/*" multiple className="hidden" disabled={pending}
              onChange={e => { const l = Array.from(e.target.files ?? []); e.target.value = ''; onPick(l); }} />
          </label>
          <span className="text-[12px] text-[#8E8E93]">{room} fotoğraf daha eklenebilir</span>
        </div>
      )}
      {msg && <p className="text-[12.5px] text-rose-300">{msg}</p>}
    </section>
  );
}
