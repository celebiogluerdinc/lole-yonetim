'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Tag, ShieldCheck, Sliders, Target, MessageSquareX, Store } from 'lucide-react';
import {
  upsertPriceList, updateApprovalStep, updateCriterion, upsertTarget,
  addNoOrderReason, toggleNoOrderReason
} from '@/app/(app)/sales/settings/actions';
import { CHANNEL_LABEL, type OutletChannel } from '@/lib/sales-types';

interface Product { id: string; name: string; taste_reference: string | null }
interface Step { id: string; step_code: string; label: string; open_to_all: boolean; department_id: string | null }
interface Dept { id: string; name: string }
interface Criterion {
  id: string; label: string; grp: string; weight: number; applies_to: string;
  form_code: string; scale_min: number; scale_max: number; is_active: boolean;
}
interface Reason { id: string; label: string; is_active: boolean }
interface Target { id: string; scope: string; scope_value: string | null; target_value: number }
interface OType { id: string; name: string; channel: OutletChannel; is_quick_pick: boolean; is_active: boolean }

const GRP_LABEL: Record<string, string> = {
  aday: 'Aday değerlendirmesi (F02)',
  potansiyel: 'Nokta potansiyeli',
  gorusme: 'Görüşme kalitesi',
  icra: 'Saha icra',
  genel: 'Genel'
};
const TABS = [
  { k: 'fiyat', l: 'Fiyat', Icon: Tag },
  { k: 'onay', l: 'Onay adımları', Icon: ShieldCheck },
  { k: 'kriter', l: 'Puanlama', Icon: Sliders },
  { k: 'hedef', l: 'Hedefler', Icon: Target },
  { k: 'itiraz', l: 'İtiraz nedenleri', Icon: MessageSquareX },
  { k: 'tip', l: 'Nokta tipleri', Icon: Store }
] as const;

export default function SalesSettings({
  products, priceList, steps, departments, criteria, reasons, targets, types
}: {
  products: Product[]; priceList: any; steps: Step[]; departments: Dept[];
  criteria: Criterion[]; reasons: Reason[]; targets: Target[]; types: OType[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [tab, setTab] = useState<string>('fiyat');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function run(fn: (fd: FormData) => Promise<any>, fd: FormData, msg = 'Kaydedildi.') {
    setErr(null); setOk(null);
    start(async () => {
      const r = await fn(fd);
      if (r?.error) { setErr(r.error); return; }
      setOk(msg); router.refresh();
    });
  }

  const priceOf = (pid: string) =>
    (priceList?.price_list_items ?? []).find((i: any) => i.product_id === pid)?.unit_price ?? '';

  const grouped = criteria.reduce((acc: Record<string, Criterion[]>, c) => {
    (acc[c.grp] ??= []).push(c); return acc;
  }, {});

  return (
    <main className="py-5 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Saha Satış Ayarları</h1>
        <p className="text-[14px] text-[#8E8E93]">Yalnızca yönetici değiştirebilir.</p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map(({ k, l, Icon }) => (
          <button key={k} onClick={() => { setTab(k); setErr(null); setOk(null); }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
              tab === k ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'
            }`}>
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>

      {err && <p className="alert-error">{err}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">{ok}</p>}

      {/* ---------------- FİYAT ---------------- */}
      {tab === 'fiyat' && (
        <form action={(fd) => run(upsertPriceList, fd, 'Fiyat listesi güncellendi.')}
          className="card p-5 space-y-4">
          <p className="section-title">Liste fiyatı</p>
          <p className="text-[13px] text-[#8E8E93]">
            KDV hariç, şişe başına. Noktayla ayrı fiyat anlaşıldıysa o geçerli olur —
            nokta anlaşmaları nokta kartından girilir.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Liste sürümü *</label>
              <input name="version" required className="input"
                defaultValue={priceList?.version ?? new Date().toISOString().slice(0, 7)} />
            </div>
            <div>
              <label className="label">Geçerlilik başlangıcı</label>
              <input type="date" name="valid_from" className="input"
                defaultValue={priceList?.valid_from ?? new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          {products.map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.name}</p>
                {p.taste_reference && (
                  <p className="text-[12px] text-[#8E8E93] truncate">{p.taste_reference}</p>
                )}
              </div>
              <div className="w-32 shrink-0">
                <input type="number" min={0} step="0.01" name={`price_${p.id}`}
                  className="input !py-2 text-right" defaultValue={priceOf(p.id)} placeholder="₺" />
              </div>
            </div>
          ))}

          <button type="submit" className="btn-primary">Fiyatları kaydet</button>
        </form>
      )}

      {/* ---------------- ONAY ADIMLARI ---------------- */}
      {tab === 'onay' && (
        <section className="card p-5 space-y-4">
          <p className="section-title">Onay adımları</p>
          <p className="text-[13px] text-[#8E8E93]">
            Adımlar kişiye değil göreve bağlıdır. Şu an hepsi tüm departmanlara açık —
            bu bilinçli bir ayardır. Bir adımı tek departmana kilitlemek için kutucuğu kaldırın.
          </p>

          {steps.map(s => (
            <form key={s.id} action={(fd) => run(updateApprovalStep, fd, `${s.label} güncellendi.`)}
              className="rounded-xl bg-white/[0.03] p-3 space-y-2">
              <input type="hidden" name="step_id" value={s.id} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium">{s.label}</p>
                <span className={`badge ${s.open_to_all ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {s.open_to_all ? 'tüm departmanlar' : 'kısıtlı'}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="open_to_all" defaultChecked={s.open_to_all} />
                Tüm departmanlar onaylayabilir
              </label>
              <div>
                <label className="label">Kısıtlıysa hangi departman</label>
                <select name="department_id" className="input" defaultValue={s.department_id ?? ''}>
                  <option value="">—</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-ghost text-sm">Kaydet</button>
            </form>
          ))}
        </section>
      )}

      {/* ---------------- PUANLAMA ---------------- */}
      {tab === 'kriter' && (
        <section className="card p-5 space-y-4">
          <p className="section-title">Puanlama kriterleri</p>
          <p className="text-[13px] text-[#8E8E93]">
            Tüm formlarda ortak ölçek: <strong>1–5</strong>. Boş bırakmak "bilinmiyor" demektir
            ve puanı düşürmez. Ağırlık yalnızca ziyaret puanlamasında (F03) kullanılır.
          </p>

          {Object.entries(grouped).map(([grp, list]) => (
            <div key={grp} className="space-y-2">
              <p className="text-[13px] font-medium text-[#AEAEB2]">{GRP_LABEL[grp] ?? grp}</p>
              {list.map(c => (
                <form key={c.id} action={(fd) => run(updateCriterion, fd, 'Kriter güncellendi.')}
                  className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                  <input type="hidden" name="criterion_id" value={c.id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.label}</p>
                    <p className="text-[12px] text-[#8E8E93]">
                      {c.form_code} · {c.scale_min}–{c.scale_max}
                      {c.applies_to !== 'hepsi' ? ` · ${c.applies_to === 'aday' ? 'aday' : 'müşteri'}` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-[12px] text-[#8E8E93]">
                    ağırlık
                    <input type="number" min={1} max={5} name="weight" defaultValue={c.weight}
                      className="input !py-1 !px-2 w-14 text-center" />
                  </label>
                  <label className="flex items-center gap-1 text-[12px]">
                    <input type="checkbox" name="is_active" defaultChecked={c.is_active} /> aktif
                  </label>
                  <button type="submit" className="btn-ghost !px-2 text-[12px]">Kaydet</button>
                </form>
              ))}
            </div>
          ))}
        </section>
      )}

      {/* ---------------- HEDEFLER ---------------- */}
      {tab === 'hedef' && (
        <section className="card p-5 space-y-4">
          <p className="section-title">Günlük ziyaret hedefi</p>
          <p className="text-[13px] text-[#8E8E93]">Kişi/ekip başına günlük görüşme hedefi.</p>

          <div className="space-y-1.5">
            {targets.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm rounded-xl bg-white/[0.03] px-3 py-2">
                <span>{t.scope === 'sehir' ? t.scope_value : 'Varsayılan (diğer şehirler)'}</span>
                <span className="tabular-nums font-medium">{Number(t.target_value)} ziyaret</span>
              </div>
            ))}
            {targets.length === 0 && <p className="text-[13px] text-[#8E8E93]">Hedef tanımlı değil.</p>}
          </div>

          <form action={(fd) => run(upsertTarget, fd, 'Hedef kaydedildi.')} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Kapsam</label>
                <select name="scope" className="input" defaultValue="sehir">
                  <option value="sehir">Şehir</option>
                  <option value="varsayilan">Varsayılan</option>
                </select>
              </div>
              <div>
                <label className="label">Şehir</label>
                <input name="scope_value" className="input" placeholder="İstanbul" />
              </div>
              <div>
                <label className="label">Günlük hedef</label>
                <input type="number" min={0} max={100} name="target_value" required className="input" />
              </div>
            </div>
            <button type="submit" className="btn-primary">Hedefi kaydet</button>
          </form>
        </section>
      )}

      {/* ---------------- İTİRAZ NEDENLERİ ---------------- */}
      {tab === 'itiraz' && (
        <section className="card p-5 space-y-4">
          <p className="section-title">İtiraz nedenleri</p>
          <p className="text-[13px] text-[#8E8E93]">
            Sabit liste olmasının sebebi: serbest metin raporlanamaz. Aynı tema çeyrekte
            5+ kez "diğer" olarak girildiyse buraya yeni madde ekleyin.
          </p>

          <div className="space-y-1.5">
            {reasons.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm rounded-xl bg-white/[0.03] px-3 py-2">
                <span className={r.is_active ? '' : 'text-[#8E8E93] line-through'}>{r.label}</span>
                <button
                  onClick={() => start(async () => {
                    const res = await toggleNoOrderReason(r.id, !r.is_active);
                    if (res?.error) setErr(res.error); else router.refresh();
                  })}
                  className="btn-ghost !px-2 text-[12px] shrink-0">
                  {r.is_active ? 'Kapat' : 'Aç'}
                </button>
              </div>
            ))}
          </div>

          <form action={(fd) => run(addNoOrderReason, fd, 'Neden eklendi.')} className="flex gap-2">
            <input name="label" required className="input" placeholder="Yeni itiraz nedeni…" />
            <button type="submit" className="btn-primary shrink-0"><Plus size={16} /> Ekle</button>
          </form>
        </section>
      )}

      {/* ---------------- NOKTA TİPLERİ ---------------- */}
      {tab === 'tip' && (
        <section className="card p-5 space-y-3">
          <p className="section-title">Nokta tipleri</p>
          <p className="text-[13px] text-[#8E8E93]">
            "Hızlı seçim" işaretli olanlar saha formunda büyük buton olarak en üstte çıkar —
            sahada uzun liste okunmaz.
          </p>
          {Object.entries(
            types.reduce((acc: Record<string, OType[]>, t) => {
              (acc[t.channel] ??= []).push(t); return acc;
            }, {})
          ).map(([ch, list]) => (
            <div key={ch} className="space-y-1">
              <p className="text-[13px] font-medium text-[#AEAEB2]">
                {CHANNEL_LABEL[ch as OutletChannel] ?? ch}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map(t => (
                  <span key={t.id}
                    className={`badge ${t.is_quick_pick ? 'bg-ios-blue/20 text-ios-blue' : 'bg-white/[0.07] text-[#D1D1D6]'}`}>
                    {t.name}{t.is_quick_pick ? ' ★' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
