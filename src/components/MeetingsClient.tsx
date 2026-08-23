'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Users, CalendarDays, MapPin, ChevronDown, Trash2, Send,
  ClipboardCheck, FileText, UserPlus, Lock, CheckCircle2, Ban
} from 'lucide-react';
import {
  createMeeting, updateMeeting, saveMeetingOutcome, setMeetingStatus,
  inviteToMeeting, removeFromMeeting, addMeetingNote, deleteMeetingNote, deleteMeeting
} from '@/app/(app)/meetings/actions';
import PrintButton, { type PrintTable } from '@/components/PrintButton';
import { useConfirm } from '@/components/ConfirmProvider';

interface Part { id: string; name: string; organizer: boolean; }
interface Note { id: string; body: string; author: string; authorId: string; date: string | null; }
interface Meeting {
  id: string; title: string; description: string | null; outcome: string | null;
  location: string | null; status: string; when: string | null; whenInput: string;
  day: string; created: string | null; creator: string; creatorId: string;
  dept: string | null; participants: Part[]; notes: Note[]; amInvited: boolean;
}
interface User { id: string; full_name: string; role: string; }
interface Dept { id: string; name: string; }

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Planlandı', cls: 'bg-amber-500/20 text-amber-300' },
  done: { label: '✔ Tamamlandı', cls: 'bg-emerald-500/20 text-emerald-300' },
  cancelled: { label: 'İptal', cls: 'bg-white/10 text-[#8E8E93]' }
};

const FILTERS = [
  ['scheduled', 'Planlanan'], ['done', 'Tamamlanan'], ['cancelled', 'İptal'], ['all', 'Tümü']
] as const;

const TABS = [
  ['topic', 'Konu'], ['desc', 'Açıklama'], ['outcome', 'Değerlendirme Sonucu'],
  ['people', 'Katılımcılar'], ['notes', 'Notlar']
] as const;
type TabKey = typeof TABS[number][0];

export default function MeetingsClient({
  meetings, users, departments, meId, isAdmin
}: {
  meetings: Meeting[]; users: User[]; departments: Dept[]; meId: string; isAdmin: boolean;
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('topic');
  const [editMode, setEditMode] = useState(false);
  const [outcomeDraft, setOutcomeDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [inviteSel, setInviteSel] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<any>, okText?: string) => start(async () => {
    setError(null); setOk(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else { if (okText) setOk(okText); router.refresh(); }
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: meetings.length };
    for (const m of meetings) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [meetings]);

  const filtered = useMemo(() => meetings.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (fromDate && m.day < fromDate) return false;
    if (toDate && m.day > toDate) return false;
    return true;
  }), [meetings, filter, fromDate, toDate]);

  const fmtTr = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const printTable: PrintTable = useMemo(() => ({
    title: 'Toplantılar',
    subtitle: [
      FILTERS.find(f => f[0] === filter)?.[1] ?? 'Tümü',
      (fromDate || toDate) ? `${fmtTr(fromDate) || '…'} – ${fmtTr(toDate) || '…'}` : ''
    ].filter(Boolean).join(' · '),
    landscape: true,
    headers: ['Tarih', 'Konu', 'Açıklama', 'Değerlendirme Sonucu', 'Katılımcılar', 'Açan', 'Durum'],
    rows: filtered.map(m => [
      m.when ?? '—', m.title, m.description ?? '—', m.outcome ?? '—',
      m.participants.map(p => p.name).join(', ') || '—',
      m.creator, STATUS[m.status]?.label ?? m.status
    ])
  }), [filtered, filter, fromDate, toDate]);

  const nowLocal = useMemo(() => {
    const p = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    return p.replace(' ', 'T').slice(0, 16);
  }, []);

  function openRoom(m: Meeting) {
    const next = openId === m.id ? null : m.id;
    setOpenId(next);
    setTab('topic');
    setEditMode(false);
    setInviteSel([]);
    if (next) setOutcomeDraft(s => ({ ...s, [m.id]: m.outcome ?? '' }));
  }

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">🗓️ Toplantılar</h1>
        <p className="text-[14px] text-[#8E8E93]">
          Toplantı odasını yalnızca davetliler görür{isAdmin ? ' — yöneticiler iş takibi için tümünü görür.' : '.'}
        </p>
      </header>

      <div className="card p-3 flex items-start gap-2.5 border border-white/10">
        <Lock size={15} className="text-[#8E8E93] mt-0.5 shrink-0" />
        <p className="text-[13px] text-[#B0B0B5]">
          {isAdmin
            ? 'Yönetici olarak şirketteki tüm toplantıları ve içeriklerini görüntüleyebilirsiniz.'
            : 'Burada yalnızca davet edildiğiniz veya açtığınız toplantılar listelenir.'}
        </p>
      </div>

      {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!formOpen && (
          <button onClick={() => { setFormOpen(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
            className="btn-primary">
            <Plus size={16} /> Yeni Toplantı Aç
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
          {filtered.length} toplantı — PDF bu listeyi yazdırır
        </span>
      </div>

      {/* ---- YENİ TOPLANTI ---- */}
      {formOpen && (
        <form
          ref={formRef}
          action={(fd) => start(async () => {
            setError(null); setOk(null);
            const r = await createMeeting(fd);
            if (r?.error) setError(r.error);
            else {
              setOk('Toplantı açıldı — davetlilere bildirim gitti.');
              setFormOpen(false);
              router.refresh();
            }
          })}
          className="card p-4 space-y-4 border border-ios-blue/25"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
              <CalendarDays size={15} /> Yeni Toplantı
            </h3>
            <button type="button" onClick={() => setFormOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
          </div>

          <div>
            <label className="label">Toplantı konusu *</label>
            <input name="title" required minLength={3} className="input" placeholder="Örn. Haftalık mutfak değerlendirmesi" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Tarih ve saat</label>
              <input type="datetime-local" name="meeting_at" defaultValue={nowLocal} className="input" />
            </div>
            <div>
              <label className="label">Yer</label>
              <input name="location" className="input" placeholder="Örn. Toplantı odası / Online" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Departman</label>
              <select name="department_id" defaultValue="" className="input">
                <option value="">— Seçilmedi —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Açıklama</label>
            <textarea name="description" rows={4} className="input"
              placeholder="Gündem maddeleri, hazırlık notları…" />
          </div>

          <div>
            <label className="label">Toplantı odasına davet edilecekler</label>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
              {users.filter(u => u.id !== meId).map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.04]">
                  <input type="checkbox" name="participants" value={u.id} className="tick" />
                  <span>{u.full_name}</span>
                </label>
              ))}
              {users.filter(u => u.id !== meId).length === 0 && (
                <p className="px-3 py-3 text-sm text-[#8E8E93]">Davet edilecek başka kullanıcı yok.</p>
              )}
            </div>
            <p className="text-[12px] text-[#8E8E93] mt-1.5">
              Yalnızca seçtiğiniz kişiler bu toplantıyı görebilir. (Yöneticiler iş takibi için tüm toplantıları görür.)
            </p>
          </div>

          <div className="flex gap-2">
            <button disabled={pending} className="btn-primary">
              {pending ? 'Açılıyor…' : 'Toplantıyı Aç'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-outline">Vazgeç</button>
          </div>
        </form>
      )}

      {/* ---- LİSTE ---- */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-sm text-[#8E8E93]">
            Bu filtrede toplantı yok.
          </div>
        )}

        {filtered.map(m => {
          const open = openId === m.id;
          const st = STATUS[m.status] ?? STATUS.scheduled;
          const canEdit = isAdmin || m.creatorId === meId;
          const canWrite = canEdit || m.amInvited;
          return (
            <article key={m.id} className="card p-4">
              <button onClick={() => openRoom(m)} className="w-full text-left flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    <span className="badge bg-white/10 text-[#C7C7CC]">
                      <Users size={11} /> {m.participants.length} kişi
                    </span>
                    {m.outcome && (
                      <span className="badge bg-indigo-500/20 text-indigo-300">
                        <ClipboardCheck size={11} /> Değerlendirildi
                      </span>
                    )}
                    {!m.amInvited && isAdmin && (
                      <span className="badge bg-white/10 text-[#8E8E93]">yönetim görünümü</span>
                    )}
                  </div>
                  <h3 className="font-semibold mt-1.5 truncate">{m.title}</h3>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">
                    {m.when ?? 'Tarih belirtilmedi'}{m.location ? ` · ${m.location}` : ''} · {m.creator}
                  </p>
                </div>
                <ChevronDown size={18}
                  className={`text-[#8E8E93] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3">
                  {/* ---- SEKMELER ---- */}
                  <div className="segment overflow-x-auto">
                    {TABS.map(([k, l]) => (
                      <button key={k} onClick={() => setTab(k)}
                        className={`segment-item whitespace-nowrap ${tab === k ? 'segment-item-active' : ''}`}>
                        {l}
                        {k === 'people' ? ` (${m.participants.length})` : ''}
                        {k === 'notes' ? ` (${m.notes.length})` : ''}
                      </button>
                    ))}
                  </div>

                  {/* ---- KONU ---- */}
                  {tab === 'topic' && (
                    <div className="space-y-3">
                      {!editMode ? (
                        <>
                          <h4 className="text-[17px] font-semibold">{m.title}</h4>
                          <div className="grid sm:grid-cols-2 gap-2 text-[13px] text-[#B0B0B5]">
                            <p className="flex items-center gap-2"><CalendarDays size={14} /> {m.when ?? 'Tarih belirtilmedi'}</p>
                            <p className="flex items-center gap-2"><MapPin size={14} /> {m.location ?? 'Yer belirtilmedi'}</p>
                            <p className="flex items-center gap-2"><Users size={14} /> Açan: {m.creator}</p>
                            <p className="flex items-center gap-2"><FileText size={14} /> {m.dept ?? 'Departman seçilmedi'}</p>
                          </div>
                          {canEdit && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button className="btn-outline text-sm" onClick={() => setEditMode(true)}>
                                Düzenle
                              </button>
                              {m.status !== 'done' && (
                                <button disabled={pending} className="btn-success text-sm"
                                  onClick={() => run(() => setMeetingStatus(m.id, 'done'), 'Toplantı tamamlandı olarak işaretlendi.')}>
                                  <CheckCircle2 size={15} /> Toplantıyı Bitir
                                </button>
                              )}
                              {m.status !== 'cancelled' && (
                                <button disabled={pending} className="btn-outline text-sm"
                                  onClick={async () => {
                                    const yes = await confirmS({
                                      title: 'Toplantı iptal edilsin mi?',
                                      message: 'Kayıt silinmez, "iptal" olarak işaretlenir.',
                                      okText: 'İptal Et', danger: true
                                    });
                                    if (yes) run(() => setMeetingStatus(m.id, 'cancelled'), 'Toplantı iptal edildi.');
                                  }}>
                                  <Ban size={15} /> İptal Et
                                </button>
                              )}
                              <button disabled={pending} className="btn-danger text-sm"
                                onClick={async () => {
                                  const yes = await confirmS({
                                    title: 'Toplantı silinsin mi?',
                                    message: 'Toplantı, katılımcıları ve notları kalıcı olarak silinir.',
                                    okText: 'Sil', danger: true
                                  });
                                  if (yes) run(() => deleteMeeting(m.id), 'Toplantı silindi.');
                                }}>
                                <Trash2 size={15} /> Sil
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <form
                          action={(fd) => run(async () => {
                            const res = await updateMeeting(m.id, fd);
                            if (!res?.error) setEditMode(false);
                            return res;
                          }, 'Toplantı güncellendi.')}
                          className="space-y-3"
                        >
                          <div>
                            <label className="label">Konu *</label>
                            <input name="title" required minLength={3} defaultValue={m.title} className="input" />
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label">Tarih ve saat</label>
                              <input type="datetime-local" name="meeting_at" defaultValue={m.whenInput} className="input" />
                            </div>
                            <div>
                              <label className="label">Yer</label>
                              <input name="location" defaultValue={m.location ?? ''} className="input" />
                            </div>
                          </div>
                          <div>
                            <label className="label">Açıklama</label>
                            <textarea name="description" rows={4} defaultValue={m.description ?? ''} className="input" />
                          </div>
                          <div>
                            <label className="label">Değerlendirme sonucu</label>
                            <textarea name="outcome" rows={4} defaultValue={m.outcome ?? ''} className="input" />
                          </div>
                          <div className="flex gap-2">
                            <button disabled={pending} className="btn-primary text-sm">Kaydet</button>
                            <button type="button" className="btn-ghost text-sm" onClick={() => setEditMode(false)}>Vazgeç</button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* ---- AÇIKLAMA ---- */}
                  {tab === 'desc' && (
                    <div>
                      {m.description
                        ? <p className="text-sm text-[#D1D1D6] whitespace-pre-wrap">{m.description}</p>
                        : <p className="text-sm text-[#8E8E93]">Açıklama girilmemiş.</p>}
                      {canEdit && (
                        <button className="btn-outline text-sm mt-3" onClick={() => { setTab('topic'); setEditMode(true); }}>
                          Açıklamayı Düzenle
                        </button>
                      )}
                    </div>
                  )}

                  {/* ---- DEĞERLENDİRME SONUCU ---- */}
                  {tab === 'outcome' && (
                    <div className="space-y-2">
                      {canEdit ? (
                        <>
                          <label className="label">Değerlendirme sonucu</label>
                          <textarea
                            value={outcomeDraft[m.id] ?? m.outcome ?? ''}
                            onChange={e => setOutcomeDraft(s => ({ ...s, [m.id]: e.target.value }))}
                            rows={6} className="input"
                            placeholder="Alınan kararlar, sorumlular, takip edilecek maddeler…" />
                          <button disabled={pending} className="btn-primary text-sm"
                            onClick={() => run(() => saveMeetingOutcome(m.id, outcomeDraft[m.id] ?? ''), 'Değerlendirme sonucu kaydedildi.')}>
                            <ClipboardCheck size={15} /> Kaydet
                          </button>
                        </>
                      ) : (
                        m.outcome
                          ? <p className="text-sm text-[#D1D1D6] whitespace-pre-wrap">{m.outcome}</p>
                          : <p className="text-sm text-[#8E8E93]">Henüz değerlendirme sonucu yazılmamış.</p>
                      )}
                    </div>
                  )}

                  {/* ---- KATILIMCILAR ---- */}
                  {tab === 'people' && (
                    <div className="space-y-3">
                      <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                        {m.participants.map(p => (
                          <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="flex items-center gap-2">
                              {p.name}
                              {p.organizer && <span className="badge bg-brand-100 text-brand-700">Toplantıyı açan</span>}
                              {p.id === meId && <span className="badge bg-white/10 text-[#8E8E93]">siz</span>}
                            </span>
                            {canEdit && !p.organizer && (
                              <button className="text-[12px] text-[#8E8E93] hover:text-rose-300 flex items-center gap-1"
                                onClick={async () => {
                                  const yes = await confirmS({
                                    title: 'Katılımcı çıkarılsın mı?',
                                    message: `${p.name} artık bu toplantıyı göremeyecek.`,
                                    okText: 'Çıkar', danger: true
                                  });
                                  if (yes) run(() => removeFromMeeting(m.id, p.id), 'Katılımcı çıkarıldı.');
                                }}>
                                <X size={12} /> Çıkar
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>

                      {canEdit && (
                        <div className="space-y-2">
                          <label className="label">Odaya davet et</label>
                          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
                            {users
                              .filter(u => !m.participants.some(p => p.id === u.id))
                              .map(u => (
                                <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.04]">
                                  <input type="checkbox" className="tick"
                                    checked={inviteSel.includes(u.id)}
                                    onChange={e => setInviteSel(s =>
                                      e.target.checked ? [...s, u.id] : s.filter(x => x !== u.id))} />
                                  <span>{u.full_name}</span>
                                </label>
                              ))}
                            {users.filter(u => !m.participants.some(p => p.id === u.id)).length === 0 && (
                              <p className="px-3 py-3 text-sm text-[#8E8E93]">Davet edilecek başka kullanıcı yok.</p>
                            )}
                          </div>
                          <button disabled={pending || !inviteSel.length} className="btn-primary text-sm"
                            onClick={() => run(async () => {
                              const res = await inviteToMeeting(m.id, inviteSel);
                              if (!res?.error) setInviteSel([]);
                              return res;
                            }, 'Davetler gönderildi.')}>
                            <UserPlus size={15} /> Davet Et ({inviteSel.length})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- NOTLAR ---- */}
                  {tab === 'notes' && (
                    <div className="space-y-3">
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {m.notes.length === 0 && (
                          <p className="text-sm text-[#8E8E93]">Henüz toplantı notu yok.</p>
                        )}
                        {m.notes.map(n => (
                          <div key={n.id} className="rounded-xl bg-white/[0.04] p-2.5">
                            <p className="text-sm text-[#D1D1D6] whitespace-pre-wrap">{n.body}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#8E8E93]">
                              <span>{n.author} · {n.date}</span>
                              {(n.authorId === meId || isAdmin) && (
                                <button className="hover:text-rose-300 flex items-center gap-1"
                                  onClick={async () => {
                                    const yes = await confirmS({
                                      title: 'Not silinsin mi?', message: 'Bu not kalıcı olarak silinecek.',
                                      okText: 'Sil', danger: true
                                    });
                                    if (yes) run(() => deleteMeetingNote(n.id), 'Not silindi.');
                                  }}>
                                  <Trash2 size={11} /> Sil
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {canWrite && (
                        <div className="flex gap-2 items-end">
                          <textarea
                            value={noteDraft[m.id] ?? ''}
                            onChange={e => setNoteDraft(s => ({ ...s, [m.id]: e.target.value }))}
                            rows={2} className="input flex-1" placeholder="Toplantı notu yazın…" />
                          <button disabled={pending || !(noteDraft[m.id] ?? '').trim()} className="btn-primary"
                            onClick={() => run(async () => {
                              const res = await addMeetingNote(m.id, noteDraft[m.id] ?? '');
                              if (!res?.error) setNoteDraft(s => ({ ...s, [m.id]: '' }));
                              return res;
                            })}>
                            <Send size={16} />
                          </button>
                        </div>
                      )}
                    </div>
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
