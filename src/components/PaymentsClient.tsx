'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Trash2, Wallet, LayoutTemplate, ThumbsUp, ThumbsDown, Ban, ChevronDown
} from 'lucide-react';
import {
  createPaymentRequest, decidePaymentRequest, cancelPaymentRequest,
  completePaymentRequest, deletePaymentTemplate
} from '@/app/(app)/payments/actions';
import PrintButton, { type PrintTable } from '@/components/PrintButton';

interface Req {
  id: string; workTitle: string; workDetail: string | null; firm: string;
  taxNo: string | null; iban: string | null; amount: string | null; note: string | null;
  status: string; date: string; day: string; requester: string; requesterId: string;
  dept: string | null; decider: string | null; decisionNote: string | null;
}
interface Tpl {
  id: string; name: string; workTitle: string | null; workDetail: string | null;
  firm: string | null; taxNo: string | null; iban: string | null; amount: string | null;
  note: string | null; creator: string; creatorId: string; dept: string | null; deptId: string | null;
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

export default function PaymentsClient({
  tab, requests, templates, departments, meId, isAdmin, isDecider
}: {
  tab: 'requests' | 'templates';
  requests: Req[]; templates: Tpl[]; departments: Dept[];
  meId: string; isAdmin: boolean; isDecider: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<Tpl>>({});
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

  function openForm(p?: Partial<Tpl>) {
    setPrefill(p ?? {});
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

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
    title: 'Ödeme Talepleri',
    subtitle: [
      FILTERS.find(f => f[0] === filter)?.[1] ?? 'Tümü',
      (fromDate || toDate) ? `${fmtTr(fromDate) || '…'} – ${fmtTr(toDate) || '…'}` : ''
    ].filter(Boolean).join(' · '),
    landscape: true,
    headers: ['Tarih', 'Yapılan İş', 'Firma', 'Vergi No', 'IBAN', 'Tutar', 'Talep Eden', 'Durum'],
    rows: filtered.map(r => [
      r.date, r.workTitle, r.firm, r.taxNo ?? '—', r.iban ?? '—',
      r.amount ? `${r.amount} TL` : '—', r.requester, STATUS[r.status]?.label ?? r.status
    ])
  }), [filtered, filter, fromDate, toDate]);

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">💸 Ödeme Talepleri</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {pendingCount > 0 ? `${pendingCount} bekleyen talep` : 'Onaylanmış işler için ödeme talep edin'}
          </p>
        </div>
        <div className="segment">
          <Link href="/payments" className={`segment-item ${tab === 'requests' ? 'segment-item-active' : ''}`}>
            Talepler
          </Link>
          <Link href="/payments?tab=templates" className={`segment-item ${tab === 'templates' ? 'segment-item-active' : ''}`}>
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
                <Plus size={16} /> Yeni Ödeme Talebi
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
              key={prefill.id ?? 'blank'}
              ref={formRef}
              action={(fd) => start(async () => {
                setError(null); setOk(null);
                const r = await createPaymentRequest(fd);
                if (r?.error) setError(r.error);
                else {
                  setOk(r.templateSaved
                    ? 'Ödeme talebi oluşturuldu ve şablonlara kaydedildi.'
                    : 'Ödeme talebi oluşturuldu — yöneticilere bildirim gitti.');
                  setFormOpen(false);
                  router.refresh();
                }
              })}
              className="card p-4 space-y-4 border border-ios-blue/25"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold flex items-center gap-2">
                  <Wallet size={15} /> Ödeme Talep Formu
                </h3>
                <button type="button" onClick={() => setFormOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Yapılan iş *</label>
                  <input name="work_title" required minLength={2} defaultValue={prefill.workTitle ?? ''}
                    className="input" placeholder="Örn. Havalandırma bakımı" />
                </div>
                <div>
                  <label className="label">Departman</label>
                  <select name="department_id" defaultValue={prefill.deptId ?? ''} className="input">
                    <option value="">— Genel —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">İş detayı</label>
                <textarea name="work_detail" rows={2} defaultValue={prefill.workDetail ?? ''}
                  className="input" placeholder="Yapılan işin kapsamı, tarihi, teslim durumu…" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Firma adı *</label>
                  <input name="firm_name" required minLength={2} defaultValue={prefill.firm ?? ''}
                    className="input" placeholder="Örn. ABC Teknik Ltd. Şti." />
                </div>
                <div>
                  <label className="label">Vergi / TC No</label>
                  <input name="tax_no" inputMode="numeric" defaultValue={prefill.taxNo ?? ''}
                    className="input" placeholder="10-11 haneli" />
                </div>
                <div>
                  <label className="label">IBAN</label>
                  <input name="iban" defaultValue={prefill.iban ?? ''}
                    className="input" placeholder="TR__ ____ ____ ____ ____ ____ __" />
                </div>
                <div>
                  <label className="label">Tutar (TL)</label>
                  <input name="amount" inputMode="decimal" defaultValue={prefill.amount ?? ''}
                    className="input" placeholder="Örn. 12.500,50" />
                </div>
              </div>

              <input name="note" defaultValue={prefill.note ?? ''} className="input"
                placeholder="Not (opsiyonel — örn. fatura no, vade)" />

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="save_template" className="rounded accent-[#0A84FF] w-4 h-4" />
                <LayoutTemplate size={14} className="text-[#9F9CFF]" />
                Bu formu şablon olarak da kaydet (aynı firmaya sonraki ödemeler için)
              </label>

              <button className="btn-primary w-full" disabled={pending}>
                {pending ? 'Gönderiliyor…' : 'Ödeme Talebini Gönder'}
              </button>
            </form>
          )}

          {/* ---- LİSTE ---- */}
          {filtered.length === 0 && (
            <div className="card p-10 text-center">
              <p className="text-3xl mb-2">💸</p>
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
                      <p className="text-[15px] font-semibold truncate">
                        {r.firm} — {r.workTitle}
                      </p>
                      <p className="text-[12px] text-[#8E8E93] truncate">
                        {r.date} · {r.requester}{r.dept ? ` · ${r.dept}` : ''}
                        {r.amount ? ` · ${r.amount} TL` : ''}
                      </p>
                    </div>
                    <span className={`badge shrink-0 ${st.cls}`}>{st.label}</span>
                    <ChevronDown size={15} className={`text-[#8E8E93] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="px-4 pb-4 space-y-2.5 border-t border-white/[0.06] pt-3 text-[14px]">
                      {r.workDetail && <p><span className="text-[#8E8E93]">İş detayı:</span> {r.workDetail}</p>}
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                        <p><span className="text-[#8E8E93]">Firma:</span> {r.firm}</p>
                        {r.taxNo && <p><span className="text-[#8E8E93]">Vergi/TC No:</span> {r.taxNo}</p>}
                        {r.iban && <p className="sm:col-span-2 font-mono text-[13px]"><span className="text-[#8E8E93] font-sans">IBAN:</span> {r.iban}</p>}
                        {r.amount && <p><span className="text-[#8E8E93]">Tutar:</span> <b>{r.amount} TL</b></p>}
                      </div>
                      {r.note && <p className="text-[13px] text-[#8E8E93]">📝 {r.note}</p>}
                      {r.decider && (
                        <p className="text-[12px] text-[#8E8E93]">
                          Karar: {r.decider}{r.decisionNote ? ` — "${r.decisionNote}"` : ''}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {r.status === 'approved' && isDecider && (
                          <button disabled={pending}
                            onClick={() => run(() => completePaymentRequest(r.id), 'Ödeme bitirildi olarak işaretlendi.')}
                            className="btn-primary text-sm">
                            🏁 İşlem Bitirildi
                          </button>
                        )}
                        {r.status === 'pending' && isDecider && r.requesterId !== meId && (
                          <>
                            <button disabled={pending}
                              onClick={() => run(() => decidePaymentRequest(r.id, true), 'Ödeme talebi onaylandı.')}
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
                            onClick={() => { if (window.confirm('Talebiniz iptal edilsin mi?')) run(() => cancelPaymentRequest(r.id)); }}
                            className="btn-outline text-sm !text-rose-300">
                            <Ban size={14} /> Talebi İptal Et
                          </button>
                        )}
                      </div>

                      {rejectId === r.id && (
                        <form action={(fd) => {
                          const note = String(fd.get('note') ?? '');
                          setRejectId(null);
                          run(() => decidePaymentRequest(r.id, false, note), 'Talep reddedildi.');
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
                Henüz ödeme şablonu yok. Ödeme talebi oluştururken &quot;şablon olarak kaydet&quot; işaretleyin —
                aynı firmaya sonraki ödemelerde form otomatik dolar.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate">{t.name}</p>
                    <p className="text-[12px] text-[#8E8E93] truncate">
                      {t.firm ?? '—'}{t.amount ? ` · ${t.amount} TL` : ''}{t.dept ? ` · ${t.dept}` : ''} · {t.creator}
                    </p>
                    {t.iban && <p className="text-[12px] text-[#8E8E93] font-mono mt-0.5">{t.iban}</p>}
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href="/payments"
                      onClick={() => openForm(t)}
                      className="btn-outline text-sm"
                    >
                      <Wallet size={14} /> Talep Oluştur
                    </Link>
                    {(isAdmin || t.creatorId === meId) && (
                      <button
                        onClick={() => { if (window.confirm(`"${t.name}" şablonu silinsin mi?`)) run(() => deletePaymentTemplate(t.id)); }}
                        className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30"
                        title="Şablonu sil">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
