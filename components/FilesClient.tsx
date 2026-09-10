'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen, Plus, X, Trash2, Download, FileText, Image as ImageIcon, File as FileIcon, Search
} from 'lucide-react';
import { uploadDocument, deleteDocument } from '@/app/(app)/files/actions';
import { useConfirm } from '@/components/ConfirmProvider';

interface Doc {
  id: string; title: string; category: string | null; fileName: string;
  mime: string | null; url: string | null; dept: string | null;
  uploader: string; uploaderId: string | null; date: string;
  validUntil: string | null;
}

/** geçerlilik rozeti: 30 gün kala sarı, geçtiyse kırmızı */
function validityBadge(validUntil: string | null) {
  if (!validUntil) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const label = new Date(validUntil + 'T12:00:00Z').toLocaleDateString('tr-TR', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'
  });
  if (validUntil < today) return { cls: 'bg-rose-500/20 text-rose-300', text: `⛔ Süresi doldu: ${label}` };
  const soon = new Date(new Date(today).getTime() + 30 * 86400000).toISOString().slice(0, 10);
  if (validUntil <= soon) return { cls: 'bg-amber-500/20 text-amber-300', text: `⚠️ Son: ${label}` };
  return { cls: 'bg-white/10 text-[#8E8E93]', text: `Geçerli: ${label}` };
}
interface Dept { id: string; name: string; }

const iconFor = (mime: string | null) => {
  if (mime?.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf' || mime?.includes('word') || mime === 'text/plain') return FileText;
  return FileIcon;
};

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Şirket dosya arşivi: sözleşmeler, talimatlar, formlar… */
export default function FilesClient({
  docs, departments, canUpload, isAdmin, meId
}: { docs: Doc[]; departments: Dept[]; canUpload: boolean; isAdmin: boolean; meId: string }) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(docs.map(d => d.category).filter(Boolean))) as string[],
    [docs]
  );

  const filtered = docs.filter(d => {
    if (cat && d.category !== cat) return false;
    if (q && !tr(`${d.title} ${d.fileName} ${d.category ?? ''} ${d.dept ?? ''}`).includes(tr(q))) return false;
    return true;
  });

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">📁 Dosyalar</h1>
          <p className="text-[14px] text-[#8E8E93]">
            Şirket arşivi — talimatlar, formlar, sözleşmeler ({docs.length} dosya)
          </p>
        </div>
        {canUpload && !formOpen && (
          <button onClick={() => setFormOpen(true)} className="btn-primary shrink-0">
            <Plus size={16} /> Dosya Yükle
          </button>
        )}
      </header>

      {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}

      {formOpen && (
        <form
          ref={formRef}
          action={(fd) => start(async () => {
            setError(null); setOk(null);
            const r = await uploadDocument(fd);
            if (r?.error) setError(r.error);
            else {
              setOk('Dosya arşive yüklendi.');
              setFormOpen(false);
              formRef.current?.reset();
              router.refresh();
            }
          })}
          className="card p-4 space-y-3 border border-ios-blue/25"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold flex items-center gap-2"><FolderOpen size={15} /> Dosya Yükle</h3>
            <button type="button" onClick={() => setFormOpen(false)} aria-label="Kapat"
              className="w-8 h-8 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Başlık *</label>
              <input name="title" required minLength={2} className="input" placeholder="Örn. Hijyen Talimatı 2026" />
            </div>
            <div>
              <label className="label">Kategori</label>
              <input name="category" className="input" list="doc-cats" placeholder="Örn. Talimat, Form, Sözleşme" />
              <datalist id="doc-cats">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Departman (ops. — boşsa tüm şirket görür)</label>
              <select name="department_id" className="input">
                <option value="">🏢 Tüm şirket</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Dosya * (en fazla 20MB)</label>
              <input name="file" type="file" required className="input !py-2"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*" />
            </div>
            <div>
              <label className="label">Geçerlilik sonu (ops. — rapor/sertifika için)</label>
              <input name="valid_until" type="date" className="input !py-2" />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? 'Yükleniyor…' : 'Arşive Yükle'}
          </button>
        </form>
      )}

      {/* arama + kategori */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Dosya, kategori veya departman ara…" className="input !pl-10" />
        </div>
        {categories.length > 0 && (
          <select value={cat} onChange={e => setCat(e.target.value)} className="input sm:w-56">
            <option value="">Tüm kategoriler</option>
            {categories.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">📁</p>
          <p className="text-[15px] text-[#8E8E93]">
            {docs.length === 0
              ? 'Arşiv boş. Talimat, form ve sözleşmeleri buraya yükleyin — herkes tek yerden ulaşsın.'
              : 'Bu aramayla eşleşen dosya yok.'}
          </p>
        </div>
      )}

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {filtered.map(d => {
          const Icon = iconFor(d.mime);
          return (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 group">
              <span className="w-9 h-9 rounded-xl bg-ios-blue/15 text-ios-blue flex items-center justify-center shrink-0">
                <Icon size={17} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate">{d.title}</p>
                <p className="text-[12px] text-[#8E8E93] truncate">
                  {d.date} · {d.uploader}
                  {d.category ? ` · 🏷 ${d.category}` : ''}
                  {d.dept ? ` · 📍 ${d.dept}` : ' · 🏢 Tüm şirket'}
                </p>
                {(() => {
                  const v = validityBadge(d.validUntil);
                  return v ? <span className={`badge !text-[11px] mt-1 inline-block ${v.cls}`}>{v.text}</span> : null;
                })()}
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer" title="İndir / Görüntüle"
                  className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center hover:bg-emerald-500/30 transition-colors shrink-0">
                  <Download size={15} />
                </a>
              )}
              {(isAdmin || d.uploaderId === meId) && (
                <button
                  title="Dosyayı sil" aria-label="Dosyayı sil"
                  onClick={async () => {
                    if (await confirmS({ message: `"${d.title}" arşivden silinsin mi?`, danger: true })) {
                      start(async () => {
                        setError(null);
                        const r = await deleteDocument(d.id);
                        if (r?.error) setError(r.error); else router.refresh();
                      });
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30 transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
