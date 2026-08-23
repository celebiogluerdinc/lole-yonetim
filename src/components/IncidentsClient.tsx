'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, ShieldAlert, ThumbsUp, ThumbsDown, ChevronDown, Lock,
  ClipboardCheck, Trash2, Pencil, Flag
} from 'lucide-react';
import {
  createIncident, decideIncident, closeIncident,
  addIncidentAction, updateIncidentAction, deleteIncidentAction
} from '@/app/(app)/incidents/actions';
import PrintButton, { type PrintTable } from '@/components/PrintButton';
import { useConfirm } from '@/components/ConfirmProvider';

interface ActionRow {
  id: string; body: string; author: string; authorId: string; date: string;
}
interface Incident {
  id: string; title: string; body: string; location: string | null;
  severity: string; status: string; occurred: string; day: string; created: string;
  reporter: string; reporterId: string; dept: string | null;
  approver: string | null; decisionNote: string | null; actions: ActionRow[];
}
interface Dept { id: string; name: string; }

const SEVERITY: Record<string, { label: string; cls: string }> = {
  low: { label: 'Düşük', cls: 'bg-white/10 text-[#C7C7CC]' },
  medium: { label: 'Orta', cls: 'bg-amber-500/20 text-amber-300' },
  high: { label: 'Yüksek', cls: 'bg-orange-500/20 text-orange-300' },
  critical: { label: 'Kritik', cls: 'bg-rose-500/20 text-rose-300' }
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Bekliyor', cls: 'bg-amber-500/20 text-amber-300' },
  approved: { label: '✔ Onaylandı', cls: 'bg-emerald-500/20 text-emerald-300' },
  closed: { label: '🏁 Kapatıldı', cls: 'bg-blue-500/20 text-blue-300' },
  rejected: { label: 'Reddedildi', cls: 'bg-rose-500/20 text-rose-300' }
};

const FILTERS = [
  ['pending', 'Bekleyen'], ['approved', 'Onaylanan'],
  ['closed', 'Kapatılan'], ['rejected', 'Reddedilen'], ['all', 'Tümü']
] as const;

export default function IncidentsClient({
  incidents, departments, meId, isAdmin, isSuper
}: {
  incidents: Incident[]; departments: Dept[];
  meId: string; isAdmin: boolean; isSuper: boolean;
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<string>(isAdmin ? 'pending' : 'all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandId, setExpandId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [actionDraft, setActionDraft] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<any>, okText?: string) => start(async () => {
    setError(null); setOk(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else { if (okText) setOk(okText); router.refresh(); }
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: incidents.length };
    for (const r of incidents) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [incidents]);

  const filtered = useMemo(() => incidents.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (fromDate && r.day < fromDate) return false;
    if (toDate && r.day > toDate) return false;
    return true;
  }), [incidents, filter, fromDate, toDate]);

  const fmtTr = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const printTable: PrintTable = useMemo(() => ({
    title: 'Olay Kayıtları',
    subtitle: [
      FILTERS.find(f => f[0] === filter)?.[1] ?? 'Tümü',
      (fromDate || toDate) ? `${fmtTr(fromDate) || '…'} – ${fmtTr(toDate) || '…'}` : ''
    ].filter(Boolean).join(' · '),
    landscape: true,
    headers: ['Olay Tarihi', 'Başlık', 'Önem', 'Yer', 'Departman', 'Bildiren', 'Durum', 'Aksiyon Raporu'],
    rows: filtered.map(r => [
      r.occurred, r.title, SEVERITY[r.severity]?.label ?? r.severity,
      r.location ?? '—', r.dept ?? '—', r.reporter,
      STATUS[r.status]?.label ?? r.status,
      r.actions.length ? r.actions.map(a => `${a.author}: ${a.body}`).join('\n') : '—'
    ])
  }), [filtered, filter, fromDate, toDate]);

  // datetime-local varsayılanı: şu an (İstanbul)
  const nowLocal = useMemo(() => {
    const p = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    return p.replace(' ', 'T').slice(0, 16);
  }, []);

  const pendingCount = counts.pending ?? 0;

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">🚨 Olay Kaydı</h1>
        <p className="text-[14px] text-[#8E8E93]">
          {isAdmin
            ? (pendingCount > 0 ? `${pendingCount} onay bekleyen olay kaydı` : 'Şirkette yaşanan olayların kayıtları')
            : 'Yaşanan bir olayı buradan raporlayın'}
        </p>
      </header>

      <div className="card p-3 flex items-start gap-2.5 border border-white/10">
        <Lock size={15} className="text-[#8E8E93] mt-0.5 shrink-0" />
        <p className="text-[13px] text-[#B0B0B5]">
          {isAdmin
            ? 'Olay kayıtları ve aksiyon raporları yalnızca yönetici (admin) ve süper yönetici tarafından görülebilir.'
            : 'Yazdığınız olay kaydını yalnızca yönetici ve süper yönetici görür. Bu sayfada yalnızca kendi kayıtlarınız listelenir; onaylandıktan sonra yazılan aksiyon raporları size gösterilmez.'}
        </p>
      </div>

      {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!formOpen && (
          <button onClick={() => { setFormOpen(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
            className="btn-primary">
            <Plus size={16} /> Yeni Olay Kaydı
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

      {/* tarih aralığı (liste + PDF) */}
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
          {filtered.length} kayıt — PDF bu listeyi yazdırır
        </span>
      </div>

      {/* ---- FORM ---- */}
      {formOpen && (
        <form
          ref={formRef}
          action={(fd) => start(async () => {
            setError(null); setOk(null);
            const r = await createIncident(fd);
            if (r?.error) setError(r.error);
            else {
              setOk('Olay kaydı gönderildi — yöneticilere bildirim gitti.');
              setFormOpen(false);
              router.refresh();
            }
          })}
          className="card p-4 space-y-4 border border-ios-blue/25"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
              <ShieldAlert size={15} /> Olay Raporu
            </h3>
            <button type="button" onClick={() => setFormOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
          </div>

          <div>
            <label className="label">Olay başlığı *</label>
            <input name="title" required minLength={3} className="input"
              placeholder="Örn. Depoda su kaçağı" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Olay tarihi ve saati</label>
              <input type="datetime-local" name="occurred_at" defaultValue={nowLocal} className="input" />
            </div>
            <div>
              <label className="label">Önem derecesi</label>
              <select name="severity" defaultValue="medium" className="input">
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
            </div>
            <div>
              <label className="label">Olay yeri</label>
              <input name="location" className="input" placeholder="Örn. Mutfak / Depo / Salon" />
            </div>
            <div>
              <label className="label">Departman</label>
              <select name="department_id" defaultValue="" className="input">
                <option value="">— Seçilmedi —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Olayın açıklaması *</label>
            <textarea name="body" required minLength={5} rows={5} className="input"
              placeholder="Ne oldu, kimler vardı, nasıl gelişti, hangi önlem alındı…" />
          </div>

          <div className="flex gap-2">
            <button disabled={pending} className="btn-primary">
              {pending ? 'Gönderiliyor…' : 'Olay Kaydını Gönder'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-outline">Vazgeç</button>
          </div>
        </form>
      )}

      {/* ---- LİSTE ---- */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-sm text-[#8E8E93]">
            Bu filtrede olay kaydı yok.
          </div>
        )}

        {filtered.map(r => {
          const open = expandId === r.id;
          const sev = SEVERITY[r.severity] ?? SEVERITY.medium;
          const st = STATUS[r.status] ?? STATUS.pending;
          return (
            <article key={r.id} className="card p-4">
              <button onClick={() => setExpandId(open ? null : r.id)}
                className="w-full text-left flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${sev.cls}`}><Flag size={11} /> {sev.label}</span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {r.actions.length > 0 && (
                      <span className="badge bg-indigo-500/20 text-indigo-300">
                        <ClipboardCheck size={11} /> {r.actions.length} aksiyon raporu
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold mt-1.5 truncate">{r.title}</h3>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">
                    {r.occurred}{r.location ? ` · ${r.location}` : ''} · {r.reporter}
                    {r.dept ? ` · ${r.dept}` : ''}
                  </p>
                </div>
                <ChevronDown size={18}
                  className={`text-[#8E8E93] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3">
                  <p className="text-sm text-[#D1D1D6] whitespace-pre-wrap">{r.body}</p>

                  {r.approver && (
                    <p className="text-[12px] text-[#8E8E93]">
                      Karar: {r.approver}{r.decisionNote ? ` · ${r.decisionNote}` : ''}
                    </p>
                  )}

                  {/* --- yönetici işlemleri --- */}
                  {isAdmin && r.status === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={pending}
                        onClick={() => run(() => decideIncident(r.id, true), 'Olay kaydı onaylandı — aksiyon raporu yazabilirsiniz.')}
                        className="btn-success text-sm">
                        <ThumbsUp size={15} /> Onayla
                      </button>
                      <button disabled={pending} onClick={() => setRejectId(rejectId === r.id ? null : r.id)}
                        className="btn-outline text-sm">
                        <ThumbsDown size={15} /> Reddet
                      </button>
                    </div>
                  )}

                  {isAdmin && rejectId === r.id && (
                    <form
                      action={(fd) => run(
                        () => decideIncident(r.id, false, String(fd.get('note') ?? '')),
                        'Olay kaydı reddedildi.'
                      )}
                      className="flex flex-wrap gap-2 items-end"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <label className="label">Red gerekçesi</label>
                        <input name="note" className="input !py-2" placeholder="Kısa açıklama" />
                      </div>
                      <button disabled={pending} className="btn-danger text-sm">Reddet</button>
                      <button type="button" onClick={() => setRejectId(null)} className="btn-ghost text-sm">Vazgeç</button>
                    </form>
                  )}

                  {/* --- AKSİYON RAPORLARI (yalnızca admin + süper yönetici) --- */}
                  {isAdmin && ['approved', 'closed'].includes(r.status) && (
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-3">
                      <h4 className="text-[13px] font-semibold flex items-center gap-2">
                        <ClipboardCheck size={14} /> Aksiyon Raporu
                        <span className="badge bg-white/10 text-[#8E8E93] font-normal">
                          <Lock size={10} /> yalnızca yönetim
                        </span>
                      </h4>

                      {r.actions.map(a => (
                        <div key={a.id} className="rounded-lg bg-white/[0.04] p-2.5">
                          {editId === a.id ? (
                            <div className="space-y-2">
                              <textarea value={editText} onChange={e => setEditText(e.target.value)}
                                rows={4} className="input" />
                              <div className="flex gap-2">
                                <button disabled={pending} className="btn-primary text-sm"
                                  onClick={() => run(async () => {
                                    const res = await updateIncidentAction(a.id, editText);
                                    if (!res?.error) setEditId(null);
                                    return res;
                                  }, 'Aksiyon raporu güncellendi.')}>Kaydet</button>
                                <button className="btn-ghost text-sm" onClick={() => setEditId(null)}>Vazgeç</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-[#D1D1D6] whitespace-pre-wrap">{a.body}</p>
                              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#8E8E93]">
                                <span>{a.author} · {a.date}</span>
                                {(a.authorId === meId || isSuper) && (
                                  <>
                                    <button className="hover:text-white flex items-center gap-1"
                                      onClick={() => { setEditId(a.id); setEditText(a.body); }}>
                                      <Pencil size={11} /> Düzenle
                                    </button>
                                    <button className="hover:text-rose-300 flex items-center gap-1"
                                      onClick={async () => {
                                        const yes = await confirmS({
                                          title: 'Aksiyon raporu silinsin mi?',
                                          message: 'Bu rapor kalıcı olarak silinecek.',
                                          okText: 'Sil', danger: true
                                        });
                                        if (yes) run(() => deleteIncidentAction(a.id), 'Rapor silindi.');
                                      }}>
                                      <Trash2 size={11} /> Sil
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      <div className="space-y-2">
                        <textarea
                          value={actionDraft[r.id] ?? ''}
                          onChange={e => setActionDraft(s => ({ ...s, [r.id]: e.target.value }))}
                          rows={3} className="input"
                          placeholder="Alınan aksiyon, sorumlu kişi, tamamlanma tarihi…" />
                        <div className="flex flex-wrap gap-2">
                          <button disabled={pending || !(actionDraft[r.id] ?? '').trim()}
                            className="btn-primary text-sm"
                            onClick={() => run(async () => {
                              const res = await addIncidentAction(r.id, actionDraft[r.id] ?? '');
                              if (!res?.error) setActionDraft(s => ({ ...s, [r.id]: '' }));
                              return res;
                            }, 'Aksiyon raporu eklendi.')}>
                            <Plus size={15} /> Aksiyon Raporu Ekle
                          </button>
                          {r.status === 'approved' && (
                            <button disabled={pending} className="btn-outline text-sm"
                              onClick={async () => {
                                const yes = await confirmS({
                                  title: 'Olay kaydı kapatılsın mı?',
                                  message: 'Aksiyonlar tamamlandıysa kayıt "kapatıldı" olarak işaretlenir.',
                                  okText: 'Kapat'
                                });
                                if (yes) run(() => closeIncident(r.id), 'Olay kaydı kapatıldı.');
                              }}>
                              🏁 İşlemi Bitir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isAdmin && (
                    <p className="text-[12px] text-[#8E8E93]">
                      Bu kaydın değerlendirmesi ve aksiyon raporu yönetim tarafından tutulur.
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
