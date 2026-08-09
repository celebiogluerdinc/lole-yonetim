'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Trash2, ShoppingCart, LayoutTemplate, ThumbsUp, ThumbsDown, Ban, ChevronDown
} from 'lucide-react';
import {
  createPurchaseRequest, decidePurchaseRequest, cancelPurchaseRequest,
  completePurchaseRequest, savePurchaseRequestAsTemplate, deletePurchaseTemplate
} from '@/app/(app)/purchasing/actions';
import PrintButton, { type PrintTable } from '@/components/PrintButton';
import { useConfirm } from '@/components/ConfirmProvider';

interface Item { product: string; quantity: string | null; unit: string | null; brand: string | null; spec: string | null; }
interface Req {
  id: string; title: string; note: string | null; status: string; date: string; day: string;
  requester: string; requesterId: string; dept: string | null;
  decider: string | null; decisionNote: string | null; items: Item[];
}
interface Tpl {
  id: string; name: string; note: string | null; creator: string; creatorId: string;
  dept: string | null; deptId: string | null; items: Item[];
}
interface Dept { id: string; name: string; }

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Bekliyor', cls: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Onaylandı', cls: 'bg-emerald-500/20 text-emerald-300' },
  completed: { label: '🏁 Bitirildi', cls: 'bg-blue-500/20 text-blue-300' },
  rejected: { label: 'Reddedildi', cls: 'bg-rose-500/20 text-rose-300' },
  cancelled: { label: 'İptal', cls: 'bg-white/10 text-[#8E8E93]' }
};

const FILTERS = [
  ['pending', 'Bekleyen'], ['approved', 'Onaylanan'], ['completed', 'Bitirilen'], ['all', 'Tümü']
] as const;

const emptyRow = () => ({ product: '', quantity: '', unit: '', brand: '', spec: '' });

const itemLine = (it: Item) =>
  [it.product, it.quantity && `${it.quantity}${it.unit ? ` ${it.unit}` : ''}`, it.brand, it.spec]
    .filter(Boolean).join(' · ');

export default function PurchasingClient({
  tab, requests, templates, departments, meId, isAdmin, isDecider
}: {
  tab: 'requests' | 'templates';
  requests: Req[]; templates: Tpl[]; departments: Dept[];
  meId: string; isAdmin: boolean; isDecider: boolean;
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);
  const [prefill, setPrefill] = useState<{ title?: string; note?: string; deptId?: string }>({});
  const [filter, setFilter] = useState<string>('pending');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandId, setExpandId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<any>, okText?: string) => start(async () => {
    setError(null); setOk(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else { if (okText) setOk(okText); router.refresh(); }
  });

  function openForm(p?: { title?: string; note?: string; deptId?: string; items?: Item[] }) {
    setPrefill({ title: p?.title, note: p?.note, deptId: p?.deptId });
    setRows(p?.items?.length
      ? p.items.map(it => ({
          product: it.product ?? '', quantity: it.quantity ?? '', unit: it.unit ?? '',
          brand: it.brand ?? '', spec: it.spec ?? ''
        }))
      : [emptyRow()]);
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const setRow = (i: number, k: string, v: string) =>
    setRows(a => a.map((r, x) => x === i ? { ...r, [k]: v } : r));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length };
    for (const r of requests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [requests]);

  const filtered = useMemo(() => requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (fromDate && r.day < fromDate) return false;
    if (toDate && r.day > toDate) return false;
    return true;
  }), [requests, filter, fromDate, toDate]);
  const pendingCount = counts.pending ?? 0;

  const fmtTr = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const printTable: PrintTable = useMemo(() => ({
    title: 'Satın Alma Talepleri',
    subtitle: [
      FILTERS.find(f => f[0] === filter)?.[1] ?? 'Tümü',
      (fromDate || toDate) ? `${fmtTr(fromDate) || '…'} – ${fmtTr(toDate) || '…'}` : ''
    ].filter(Boolean).join(' · '),
    landscape: true,
    headers: ['Tarih', 'Talep', 'Talep Eden', 'Departman', 'Ürünler', 'Durum', 'Karar'],
    rows: filtered.map(r => [
      r.date, r.title, r.requester, r.dept ?? '—',
      r.items.map(itemLine).join('\n') || '—',
      STATUS[r.status]?.label ?? r.status,
      r.decider ? `${r.decider}${r.decisionNote ? ` — ${r.decisionNote}` : ''}` : '—'
    ])
  }), [filtered, filter, fromDate, toDate]);

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">🛒 Satın Alma</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {pendingCount > 0 ? `${pendingCount} bekleyen talep` : 'Talep oluşturun, yöneticiler onaylasın'}
          </p>
        </div>
        <div className="segment">
          <Link href="/purchasing" className={`segment-item ${tab === 'requests' ? 'segment-item-active' : ''}`}>
            Talepler
          </Link>
          <Link href="/purchasing?tab=templates" className={`segment-item ${tab === 'templates' ? 'segment-item-active' : ''}`}>
            Şablonlar ({templates.length})
          </Link>
        </div>
      </header>

      {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}

      {/* =============== TALEPLER =============== */}
      {tab === 'requests' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!formOpen && (
              <button onClick={() => openForm()} className="btn-primary">
                <Plus size={16} /> Yeni Talep
              </button>
            )}
            <div className="segment">
              {FILTERS.map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`segment-item ${filter === k ? 'segment-item-active' : ''}`}>
                  {l} ({counts[k] ?? 0})
                </button>
              ))}
            </div>
            <PrintButton table={printTable} />
          </div>

          {/* tarih aralığı (liste + PDF için) */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Başlangıç tarihi</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input !py-2" />
            </div>
            <div>
              <label className="label">Bitiş tarihi</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input !py-2" />
            </div>
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="btn-ghost text-sm">
                <X size={14} /> Temizle
              </button>
            )}
            <span className="text-[12px] text-[#8E8E93] pb-2.5">
              {filtered.length} kayıt {(fromDate || toDate) ? 'seçili aralıkta' : ''} — PDF bu listeyi yazdırır
            </span>
          </div>

          {/* ---- FORM ---- */}
          {formOpen && (
            <form
              ref={formRef}
              action={(fd) => start(async () => {
                setError(null); setOk(null);
                const items = rows
                  .map(r => ({ ...r, product: r.product.trim() }))
                  .filter(r => r.product);
                if (!items.length) { setError('En az bir ürün adı girin.'); return; }
                fd.set('items', JSON.stringify(items));
                const r = await createPurchaseRequest(fd);
                if (r?.error) setError(r.error);
                else {
                  setOk(r.templateSaved
                    ? 'Talep oluşturuldu ve şablonlara kaydedildi.'
                    : 'Satın alma talebi oluşturuldu — yöneticilere bildirim gitti.');
                  setFormOpen(false);
                  setRows([emptyRow()]);
                  router.refresh();
                }
              })}
              className="card p-4 space-y-4 border border-ios-blue/25"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold flex items-center gap-2">
                  <ShoppingCart size={15} /> Yeni Satın Alma Talebi
                </h3>
                <button type="button" onClick={() => setFormOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Talep başlığı *</label>
                  <input name="title" required minLength={2} defaultValue={prefill.title ?? ''}
                    className="input" placeholder="Örn. Mutfak haftalık malzeme" />
                </div>
                <div>
                  <label className="label">Departman</label>
                  <select name="department_id" defaultValue={prefill.deptId ?? ''} className="input">
                    <option value="">— Genel —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ürün satırları */}
              <div className="space-y-2">
                <label className="label">Ürünler *</label>
                <div className="hidden sm:grid grid-cols-[1fr_70px_70px_100px_1fr_28px] gap-1.5 px-1 text-[11px] font-semibold text-[#8E8E93] uppercase">
                  <span>Ürün</span><span>Miktar</span><span>Birim</span><span>Marka</span><span>Özellik</span><span />
                </div>
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_70px_70px_100px_1fr_28px] gap-1.5 items-center rounded-xl bg-white/[0.03] p-1.5 sm:p-0 sm:bg-transparent">
                    <input value={r.product} onChange={e => setRow(i, 'product', e.target.value)}
                      placeholder="Ürün adı" className="input !py-2 col-span-2 sm:col-span-1" />
                    <input value={r.quantity} onChange={e => setRow(i, 'quantity', e.target.value)}
                      placeholder="Miktar" className="input !py-2" />
                    <input value={r.unit} onChange={e => setRow(i, 'unit', e.target.value)}
                      placeholder="kg/adet" className="input !py-2" />
                    <input value={r.brand} onChange={e => setRow(i, 'brand', e.target.value)}
                      placeholder="Marka" className="input !py-2" />
                    <input value={r.spec} onChange={e => setRow(i, 'spec', e.target.value)}
                      placeholder="Özellik/açıklama" className="input !py-2 col-span-2 sm:col-span-1" />
                    <button type="button" onClick={() => setRows(a => a.length > 1 ? a.filter((_, x) => x !== i) : a)}
                      className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center justify-self-end sm:justify-self-auto"
                      title="Satırı sil">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setRows(a => [...a, emptyRow()])} className="btn-outline text-sm">
                  <Plus size={14} /> Ürün Ekle
                </button>
              </div>

              <input name="note" defaultValue={prefill.note ?? ''} className="input"
                placeholder="Not (opsiyonel — örn. Cuma gününe kadar lazım)" />

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="save_template" className="rounded accent-[#0A84FF] w-4 h-4" />
                <LayoutTemplate size={14} className="text-[#9F9CFF]" />
                Bu talebi şablon olarak da kaydet (tekrar tekrar kullanmak için)
              </label>

              <button className="btn-primary w-full" disabled={pending}>
                {pending ? 'Gönderiliyor…' : 'Talebi Gönder'}
              </button>
            </form>
          )}

          {/* ---- LİSTE ---- */}
          {filtered.length === 0 && (
            <div className="card p-10 text-center">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-[15px] text-[#8E8E93]">Bu filtre ve tarih aralığında talep yok.</p>
            </div>
          )}
          <div className="space-y-3">
            {filtered.map(r => {
              const st = STATUS[r.status] ?? STATUS.pending;
              const open = expandId === r.id;
              return (
                <div key={r.id} className="card overflow-hidden">
                  <button onClick={() => setExpandId(open ? null : r.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold truncate">{r.title}</p>
                      <p className="text-[12px] text-[#8E8E93] truncate">
                        {r.date} · {r.requester}{r.dept ? ` · ${r.dept}` : ''} · {r.items.length} kalem
                      </p>
                    </div>
                    <span className={`badge shrink-0 ${st.cls}`}>{st.label}</span>
                    <ChevronDown size={15} className={`text-[#8E8E93] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                      <ul className="space-y-1.5">
                        {r.items.map((it, i) => (
                          <li key={i} className="flex items-start gap-2 text-[14px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mt-1.5 shrink-0" />
                            <span>
                              <b>{it.product}</b>
                              {it.quantity && <span className="text-[#D1D1D6]"> — {it.quantity}{it.unit ? ` ${it.unit}` : ''}</span>}
                              {it.brand && <span className="text-[#8E8E93]"> · {it.brand}</span>}
                              {it.spec && <span className="text-[#8E8E93]"> · {it.spec}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {r.note && <p className="text-[13px] text-[#8E8E93]">📝 {r.note}</p>}
                      {r.decider && (
                        <p className="text-[12px] text-[#8E8E93]">
                          Karar: {r.decider}{r.decisionNote ? ` — "${r.decisionNote}"` : ''}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {r.status === 'approved' && isDecider && (
                          <button disabled={pending}
                            onClick={() => run(() => completePurchaseRequest(r.id), 'İşlem bitirildi olarak işaretlendi.')}
                            className="btn-primary text-sm">
                            🏁 İşlem Bitirildi
                          </button>
                        )}
                        {r.status === 'pending' && isDecider && r.requesterId !== meId && (
                          <>
                            <button disabled={pending}
                              onClick={() => run(() => decidePurchaseRequest(r.id, true), 'Talep onaylandı.')}
                              className="btn-success text-sm">
                              <ThumbsUp size={14} /> Onayla
                            </button>
                            <button disabled={pending} onClick={() => setRejectId(rejectId === r.id ? null : r.id)}
                              className="btn-outline text-sm !text-rose-300 !border-rose-500/30">
                              <ThumbsDown size={14} /> Reddet
                            </button>
                          </>
                        )}
                        {r.status === 'pending' && r.requesterId === meId && (
                          <button disabled={pending}
                            onClick={async () => { if (await confirmS({ message: 'Talebiniz iptal edilsin mi?', danger: true })) run(() => cancelPurchaseRequest(r.id)); }}
                            className="btn-outline text-sm !text-rose-300">
                            <Ban size={14} /> Talebi İptal Et
                          </button>
                        )}
                        <button disabled={pending}
                          onClick={() => run(() => savePurchaseRequestAsTemplate(r.id), 'Şablonlara eklendi.')}
                          className="btn-outline text-sm !text-[#9F9CFF]">
                          <LayoutTemplate size={14} /> Şablona Kaydet
                        </button>
                      </div>

                      {rejectId === r.id && (
                        <form action={(fd) => {
                          const note = String(fd.get('note') ?? '');
                          setRejectId(null);
                          run(() => decidePurchaseRequest(r.id, false, note), 'Talep reddedildi.');
                        }} className="flex gap-2">
                          <input name="note" required placeholder="Reddetme sebebi…" className="input" />
                          <button className="btn-danger shrink-0" disabled={pending}>Reddet</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* =============== ŞABLONLAR =============== */}
      {tab === 'templates' && (
        <>
          {templates.length === 0 && (
            <div className="card p-10 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-[15px] text-[#8E8E93]">
                Henüz satın alma şablonu yok. Talep oluştururken &quot;şablon olarak kaydet&quot; işaretleyin
                veya bir talebin altındaki &quot;Şablona Kaydet&quot; düğmesini kullanın.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate">{t.name}</p>
                    <p className="text-[12px] text-[#8E8E93]">
                      {t.creator}{t.dept ? ` · ${t.dept}` : ''} · {t.items.length} kalem
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href="/purchasing"
                      onClick={() => openForm({ title: t.name, note: t.note ?? '', deptId: t.deptId ?? '', items: t.items })}
                      className="btn-outline text-sm"
                    >
                      <ShoppingCart size={14} /> Talep Oluştur
                    </Link>
                    {(isAdmin || t.creatorId === meId) && (
                      <button
                        onClick={async () => { if (await confirmS({ message: `"${t.name}" şablonu silinsin mi?`, danger: true })) run(() => deletePurchaseTemplate(t.id)); }}
                        className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30"
                        title="Şablonu sil">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1">
                  {t.items.slice(0, 6).map((it, i) => (
                    <li key={i} className="text-[13px] text-[#8E8E93] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                      {itemLine(it)}
                    </li>
                  ))}
                  {t.items.length > 6 && (
                    <li className="text-[12px] text-[#AEAEB2]">+{t.items.length - 6} kalem daha</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
