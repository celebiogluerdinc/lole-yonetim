'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ILLER, ilcelerOf } from '@/lib/tr-iller';
import {
  OUTLET_STATUS_LABEL, CHANNEL_LABEL,
  type OutletStatus, type OutletChannel
} from '@/lib/sales-types';

export interface OutletTypeRow {
  id: string; name: string; channel: OutletChannel; is_quick_pick: boolean;
}

/**
 * Fatura/sipariş muhatapları. Veritabanında ayrı tabloda (outlet_contacts)
 * duruyor ama saha açısından firma bilgisinin parçası: nokta kartı bunlar
 * yoksa "eksik bilgi" uyarısı veriyor. Bu yüzden aynı formdan giriliyor.
 */
export interface OutletRoleContacts {
  muhasebe?: { full_name?: string | null; phone?: string | null; email?: string | null } | null;
  satin_alma?: { full_name?: string | null; phone?: string | null; email?: string | null } | null;
}

export interface OutletFormValues {
  name?: string | null; legal_name?: string | null; type_id?: string | null;
  city?: string | null; district?: string | null; address?: string | null;
  phone?: string | null; email?: string | null;
  tax_office?: string | null; tax_number?: string | null;
  current_supplier?: string | null; top_selling_drink?: string | null;
  preferred_contact_time?: string | null;
  chain_decision?: string | null; status?: OutletStatus | null;
  /** Aylık potansiyel — KOLİ (itiraz ve kayıp analizinin TL ağırlığı) */
  potential_monthly_volume?: number | null;
}

/**
 * NOKTA ALAN SETİ — oluşturma ve düzenlemede tek bileşen.
 *
 * Önceden iki ayrı form vardı ve alan sıraları farklıydı; temsilci
 * düzenlemeye girdiğinde aradığı alanı bulamıyordu. Tek kaynak olduğu için
 * sıra artık her yerde aynı:
 *   1 Kim & Nerede → 2 Koşullar & fatura → 3 Ne satılıyor → 4 Durum & karar
 * Aynı sıra teklif ve sipariş formlarında da kullanılıyor.
 *
 * OLUŞTURMADA yalnız dört şey görünür: ad (tek zorunlu), tip, konum,
 * telefon. Geri kalan on beş alan "Diğer bilgiler" altında katlı —
 * sahada kapı önünde nokta açan temsilci yirmi bir alanlık form
 * görünce ya yarım bırakıyor ya da hiç açmıyordu. Katlı alanlar da
 * forma dahildir; doldurulursa kaydedilir. Düzenlemede hepsi açık.
 *
 * Bileşen <form> açmaz: üst bileşen kendi action'ını ve butonlarını yönetir.
 */
export default function OutletForm({
  types, values, mode, onNameChange, contacts
}: {
  types: OutletTypeRow[];
  values?: OutletFormValues;
  mode: 'create' | 'edit';
  onNameChange?: (v: string) => void;
  contacts?: OutletRoleContacts;
}) {
  const v = values ?? {};
  const acct = contacts?.muhasebe ?? null;
  const purch = contacts?.satin_alma ?? null;
  const [name, setName] = useState(v.name ?? '');
  const [typeId, setTypeId] = useState(v.type_id ?? '');
  const [il, setIl] = useState(v.city ?? '');
  const [ilce, setIlce] = useState(v.district ?? '');

  // Callback ref: üst bileşen satır içi fonksiyon geçerse effect her
  // render'da tetiklenmesin.
  const cb = useRef(onNameChange);
  cb.current = onNameChange;
  useEffect(() => { cb.current?.(name); }, [name]);

  const quick = useMemo(() => types.filter(t => t.is_quick_pick), [types]);
  const other = useMemo(() => types.filter(t => !t.is_quick_pick), [types]);
  const selectedType = types.find(t => t.id === typeId);

  return (
    <div className="space-y-6">
      <input type="hidden" name="type_id" value={typeId} />

      {/* ---------- 1 · KİM & NEREDE ---------- */}
      <section className="space-y-3">
        <FormStep n={1} title="Kim & Nerede"
          sub={mode === 'create'
            ? 'Yalnızca nokta adı zorunlu — gerisi sonradan tamamlanabilir'
            : 'Nokta kimliği, tipi ve konumu'} />

        <div>
          <label className="label">Nokta adı *</label>
          <input name="name" required value={name} onChange={e => setName(e.target.value)}
            className="input" placeholder="Shell Çayırova Market" />
        </div>

        {/* Sahada uzun açılır liste okunmuyor: en sık kullanılan beş tip
            doğrudan buton, gerisi katlanmış listede. */}
        <div>
          <label className="label">Tip{selectedType ? `: ${selectedType.name}` : ''}</label>
          <div className="flex flex-wrap gap-2">
            {quick.map(t => (
              <button key={t.id} type="button" onClick={() => setTypeId(t.id)}
                className={`min-h-[44px] rounded-lg px-4 text-[14px] font-semibold transition-colors ${
                  typeId === t.id ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6] hover:bg-white/[0.12]'
                }`}>
                {t.name}
              </button>
            ))}
          </div>
          {other.length > 0 && (
            <details className="mt-2" open={!!typeId && other.some(t => t.id === typeId)}>
              <summary className="text-[13px] text-[#8E8E93] cursor-pointer py-2">Diğer tipler</summary>
              <div className="flex flex-wrap gap-2 mt-2">
                {other.map(t => (
                  <button key={t.id} type="button" onClick={() => setTypeId(t.id)}
                    className={`min-h-[44px] rounded-lg px-4 text-[14px] transition-colors ${
                      typeId === t.id ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6] hover:bg-white/[0.12]'
                    }`}>
                    {t.name} <span className="opacity-50">· {CHANNEL_LABEL[t.channel]}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* İl/ilçe listeden: serbest metinde "İstanbul / istanbul / İST"
            varyantları oluşuyor ve raporlar bölünüyor. */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Şehir</label>
            <select name="city" className="input" value={il}
              onChange={e => { setIl(e.target.value); setIlce(''); }}>
              <option value="">Seçiniz…</option>
              {ILLER.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label className="label">İlçe</label>
            <select name="district" className="input" value={ilce} disabled={!il}
              onChange={e => setIlce(e.target.value)}>
              <option value="">{il ? 'Seçiniz…' : 'Önce şehir seçin'}</option>
              {ilcelerOf(il).map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Telefon</label>
            <input name="phone" type="tel" inputMode="tel" defaultValue={v.phone ?? ''} className="input" />
          </div>
          <div>
            <label className="label">Aylık potansiyel (koli)</label>
            <input name="potential_monthly_cases" inputMode="decimal" className="input tabular-nums"
              defaultValue={v.potential_monthly_volume ?? ''} placeholder="Tahmini — örn. 10" />
          </div>
        </div>
      </section>

      <Rest fold={mode === 'create'}>
      <section className="space-y-3">
        <div>
          <label className="label">Adres</label>
          <input name="address" defaultValue={v.address ?? ''} className="input" />
        </div>
        <div>
          <label className="label">E-posta</label>
          <input name="email" type="email" defaultValue={v.email ?? ''} className="input" />
        </div>
      </section>

      {/* ---------- 2 · KOŞULLAR & FATURA ---------- */}
      <section className="space-y-3">
        <FormStep n={2} title="Koşullar & fatura" sub="Görüşme saati ve fatura bilgisi" />

        <div>
          <label className="label">Uygun görüşme saati</label>
          <input name="preferred_contact_time" defaultValue={v.preferred_contact_time ?? ''}
            className="input" placeholder="Sabah 08:00–10:00" />
        </div>

        <div>
          <label className="label">Fatura ünvanı</label>
          <input name="legal_name" defaultValue={v.legal_name ?? ''} className="input" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Vergi dairesi</label>
            <input name="tax_office" defaultValue={v.tax_office ?? ''} className="input" />
          </div>
          <div>
            <label className="label">Vergi / TC no</label>
            <input name="tax_number" inputMode="numeric" defaultValue={v.tax_number ?? ''} className="input" />
          </div>
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Vergi no fatura için gerekli; satışa engel değil. İlk ziyarette alınamadıysa
          sonradan nokta kartından tamamlanır.
        </p>
      </section>

      {/* ---------- 3 · FATURA & SİPARİŞ MUHATAPLARI ----------
          Bu iki kişi nokta kartındaki "eksik bilgi" uyarısının kaynağı.
          Eskiden yalnızca kartın altındaki "Kişi ekle" ile girilebiliyordu;
          nokta açan temsilci uyarıyı görüp nereye gireceğini bulamıyordu. */}
      <section className="space-y-3">
        <FormStep n={3} title="Fatura & sipariş muhatabı"
          sub="Muhasebe ve satın alma kişisi — teklif/sipariş için gerekli" />

        <RoleContact
          title="Muhasebe" prefix="acct"
          hint="Faturayı kim alıyor, kim ödüyor"
          value={acct}
        />
        <RoleContact
          title="Satın alma" prefix="purch"
          hint="Siparişi kim veriyor"
          value={purch}
        />
        <p className="text-[12px] text-[#8E8E93]">
          Boş bırakılabilir; nokta kartı eksik olanı hatırlatır. Aynı kişi her iki
          görevi yapıyorsa adını iki alana da yazın.
        </p>
      </section>

      {/* ---------- 4 · NE SATILIYOR ---------- */}
      <section className="space-y-3">
        <FormStep n={4} title="Ne satılıyor" sub="Noktada şu an ne var, kimden alıyor" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Mevcut tedarikçi</label>
            <input name="current_supplier" defaultValue={v.current_supplier ?? ''} className="input" />
          </div>
          <div>
            <label className="label">En çok satan içecek</label>
            <input name="top_selling_drink" defaultValue={v.top_selling_drink ?? ''} className="input" />
          </div>
        </div>
      </section>

      {/* ---------- 5 · DURUM & KARAR ---------- */}
      <section className="space-y-3">
        <FormStep n={5} title="Durum & karar" sub="Noktanın durumu ve kararın nerede verildiği" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Durum</label>
            <select name="status" className="input" defaultValue={v.status ?? 'aday'}>
              {Object.entries(OUTLET_STATUS_LABEL).map(([val, l]) => (
                <option key={val} value={val}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Karar yeri</label>
            <select name="chain_decision" className="input" defaultValue={v.chain_decision ?? 'sube_karar'}>
              <option value="sube_karar">Şube karar verir</option>
              <option value="merkez_karar">Merkez karar verir</option>
              <option value="karma">Karma</option>
            </select>
          </div>
        </div>
      </section>
      </Rest>

      {mode === 'create' && (
        <p className="text-[13px] text-[#8E8E93]">
          Kaydedince noktanın kartı açılır; ziyaret, doğrudan satış ve teklif aynı karttan yürür.
        </p>
      )}
    </div>
  );
}

/**
 * Oluşturmada isteğe bağlı alanları katlar; düzenlemede olduğu gibi gösterir.
 * Katlı <details> içindeki alanlar da forma dahildir — kapalı olması
 * gönderilmesini engellemez.
 */
function Rest({ fold, children }: { fold: boolean; children: React.ReactNode }) {
  if (!fold) return <>{children}</>;
  return (
    <details className="rounded-xl border border-white/10 px-3.5 py-2">
      <summary className="cursor-pointer list-none min-h-[44px] flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold">Diğer bilgiler</span>
        <span className="text-[12px] text-[#8E8E93]">adres, fatura, muhatap — isteğe bağlı</span>
      </summary>
      <div className="space-y-6 pt-3 pb-2">{children}</div>
    </details>
  );
}

/** Tek rolün kişi bilgisi — ad/telefon/e-posta. Adı boşsa kayıt açılmaz. */
function RoleContact({
  title, prefix, hint, value
}: {
  title: string; prefix: string; hint: string;
  value?: { full_name?: string | null; phone?: string | null; email?: string | null } | null;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12px] text-[#8E8E93]">{hint}</p>
      </div>
      <div>
        <label className="label">Ad soyad</label>
        <input name={`${prefix}_name`} defaultValue={value?.full_name ?? ''} className="input" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Telefon</label>
          <input name={`${prefix}_phone`} type="tel" inputMode="tel"
            defaultValue={value?.phone ?? ''} className="input" />
        </div>
        <div>
          <label className="label">E-posta</label>
          <input name={`${prefix}_email`} type="email"
            defaultValue={value?.email ?? ''} className="input" />
        </div>
      </div>
    </div>
  );
}

/**
 * Ortak form dili. Nokta, ziyaret, teklif ve sipariş formları aynı numaralı
 * başlık biçimini kullanıyor — temsilci her formda aynı yerde aynı şeyi arıyor.
 */
export function FormStep({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-ios-blue/20 text-ios-blue text-[12px] font-bold flex items-center justify-center tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-tight">{title}</p>
        <p className="text-[12px] text-[#8E8E93] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
