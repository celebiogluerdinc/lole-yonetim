import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import {
  OUTLET_STATUS_LABEL, OUTLET_STATUS_COLOR, SEGMENT_COLOR,
  CONTACT_ROLE_LABEL, AUTHORITY_LABEL, OUTCOME_LABEL, OUTCOME_COLOR
} from '@/lib/sales-types';
import AssessmentForm from '@/components/sales/AssessmentForm';
import OutletContacts from '@/components/sales/OutletContacts';
import SupplySettings from '@/components/sales/SupplySettings';
import OutletEdit from '@/components/sales/OutletEdit';
import { ArrowRight, AlertTriangle, MapPin, Phone, Clock, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OutletPage({ params }: { params: { id: string } }) {
  const { supabase, companyId } = await getCtx();

  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', params.id).maybeSingle();
  if (!outlet) notFound();

  const [
    { data: contacts }, { data: assessments }, { data: visits },
    { data: criteria }, { data: type }, { count: quoteCount }, { count: orderCount }
  ] = await Promise.all([
    supabase.from('outlet_contacts').select('*').eq('outlet_id', outlet.id)
      .order('is_primary', { ascending: false }),
    supabase.from('outlet_assessments')
      .select('id, assessed_at, raw_total, max_total, answered_count, criteria_count, score_pct, priority')
      .eq('outlet_id', outlet.id).order('assessed_at', { ascending: false }).limit(10),
    supabase.from('visits')
      .select('id, visit_date, outcome, overall_score, status')
      .eq('outlet_id', outlet.id).order('visit_date', { ascending: false }).limit(20),
    companyId
      ? supabase.from('score_criteria')
          .select('id, label, scale_min, scale_max, sort_order')
          .eq('company_id', companyId).eq('form_code', 'F02').eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    outlet.type_id
      ? supabase.from('outlet_types').select('name, channel').eq('id', outlet.type_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('outlet_id', outlet.id),
    supabase.from('sales_orders').select('id', { count: 'exact', head: true }).eq('outlet_id', outlet.id)
  ]);

  const { data: allTypes } = companyId
    ? await supabase.from('outlet_types')
        .select('id, name, channel, is_quick_pick')
        .eq('company_id', companyId).eq('is_active', true).order('sort_order')
    : { data: [] as any[] };

  const roleContact = (role: string) => {
    const c = (contacts ?? []).find((x: any) => x.role === role);
    return c ? { full_name: c.full_name, phone: c.phone, email: c.email } : null;
  };
  /* Muhasebe ve satın alma kişisi ayrı tabloda ama firma bilgisinin parçası:
     nokta formu da bu iki kişiyi kendi alanlarından kaydediyor. */
  const roleContacts = {
    muhasebe: roleContact('muhasebe'),
    satin_alma: roleContact('satin_alma')
  };

  const missing: string[] = [];
  if (!outlet.tax_number) missing.push('vergi no');
  if (!roleContacts.muhasebe) missing.push('muhasebe iletişimi');
  if (!roleContacts.satin_alma) missing.push('satın alma iletişimi');

  const latest = (assessments ?? [])[0];
  const lastVisit = (visits ?? [])[0];

  /* İŞ AKIŞI: kart hangi adımda olduğunu kendisi söylüyor.
     Temsilci "şimdi ne yapmalıyım" diye düşünmesin — sıradaki adım en
     üstte tek buton. Sıra: değerlendirme → ziyaret → teklif → sipariş. */
  const next = (() => {
    if (!latest) return {
      title: 'Aday değerlendirmesi yap',
      note: 'Beş kriter, iki dakika. Noktanın önceliği (A/B/C) buradan çıkıyor.',
      href: `/sales/outlets/${outlet.id}#degerlendirme`,
      cta: 'Değerlendirmeye git'
    };
    if (!(visits ?? []).length) return {
      title: 'İlk ziyareti kaydet',
      note: `Öncelik ${latest.priority ?? '—'}. Ziyaretin formu sahada, nokta seçili olarak açılır.`,
      href: `/sales/visits/new?outlet=${outlet.id}`,
      cta: 'Ziyaret kaydet'
    };
    if (!(quoteCount ?? 0) && !(orderCount ?? 0)) return {
      title: 'Teklif oluştur',
      note: missing.length
        ? `Teklif için eksik: ${missing.join(', ')}.`
        : 'Ziyaret yapıldı, bilgiler tam. Koli fiyatı üzerinden teklif çıkarılabilir.',
      href: `/sales/orders/quotes/new?outlet=${outlet.id}`,
      cta: 'Teklif oluştur'
    };
    if (!(orderCount ?? 0)) return {
      title: 'Teklifi siparişe çevir',
      note: 'Teklif verildi, sipariş kaydı yok. Onay alındıysa siparişe dönüştürün.',
      href: `/sales/orders?outlet=${outlet.id}`,
      cta: 'Teklif & Siparişler'
    };
    return {
      title: 'Rutin ziyaret kaydet',
      note: lastVisit
        ? `Son ziyaret ${fmtDate(lastVisit.visit_date)}. Aktif müşteride rafı ve stoğu kontrol edin.`
        : 'Aktif müşteri. Rafı ve stoğu kontrol edin.',
      href: `/sales/visits/new?outlet=${outlet.id}`,
      cta: 'Ziyaret kaydet'
    };
  })();

  return (
    <main className="py-5 space-y-5">
      {/* ---------- KİMLİK ---------- */}
      <header className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{outlet.name}</h1>
            <p className="text-sm text-[#8E8E93] mt-1">
              {[type?.name, outlet.district, outlet.city].filter(Boolean).join(' · ') || '—'}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] text-[#AEAEB2]">
              {outlet.phone && (
                <span className="flex items-center gap-1.5"><Phone size={13} />{outlet.phone}</span>
              )}
              {outlet.preferred_contact_time && (
                <span className="flex items-center gap-1.5"><Clock size={13} />{outlet.preferred_contact_time}</span>
              )}
              {outlet.address && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <MapPin size={13} className="shrink-0" />
                  <span className="truncate">{outlet.address}</span>
                </span>
              )}
              <a href="#firma-bilgileri" className="flex items-center gap-1.5 text-ios-blue">
                <Pencil size={13} /> Bilgileri düzenle
              </a>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`badge ${OUTLET_STATUS_COLOR[outlet.status as keyof typeof OUTLET_STATUS_COLOR]}`}>
              {OUTLET_STATUS_LABEL[outlet.status as keyof typeof OUTLET_STATUS_LABEL]}
            </span>
            {outlet.segment && (
              <span className={`badge ${SEGMENT_COLOR[outlet.segment as 'A' | 'B' | 'C']}`}>
                {outlet.segment} segment{outlet.score_pct !== null ? ` · %${Math.round(outlet.score_pct)}` : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ---------- SIRADAKİ ADIM ---------- */}
      <section className="card p-5 border border-ios-blue/30 bg-ios-blue/[0.06]">
        <p className="section-title text-ios-blue">Sıradaki adım</p>
        <p className="text-[17px] font-semibold mt-1.5">{next.title}</p>
        <p className="text-[13px] text-[#AEAEB2] mt-1">{next.note}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={next.href} className="btn-primary">
            {next.cta} <ArrowRight size={16} />
          </Link>
          <Link href={`/sales/visits/new?outlet=${outlet.id}`} className="btn-ghost">Ziyaret</Link>
          <Link href={`/sales/orders?outlet=${outlet.id}`} className="btn-ghost">Teklif &amp; Sipariş</Link>
        </div>

        {missing.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-sm text-amber-300 flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p>Eksik bilgi: {missing.join(', ')}. Teklif ve sipariş için gerekli.</p>
              {/* Uyarı tek başına çıkmasın: alanın kendisine götüren bağlantı
                  olmadan temsilci nereye gireceğini bulamıyordu. */}
              <a href="#firma-bilgileri" className="underline font-semibold mt-1 inline-block">
                Firma bilgilerini tamamla
              </a>
            </div>
          </div>
        )}
      </section>

      {/* ---------- FİRMA BİLGİLERİ ----------
          Vergi no, fatura ünvanı ve iki muhatap burada hem görünüyor hem
          düzenleniyor. Eskiden en alttaki katlanmış blokta duruyordu ve
          "düzenleme yapamıyorum" geri bildirimi buradan geldi. */}
      <section id="firma-bilgileri" className="card p-5 space-y-4 scroll-mt-20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-title">Firma bilgileri</p>
            <p className="text-[13px] text-[#8E8E93]">
              Fatura ve sipariş için gereken kimlik bilgileri.
            </p>
          </div>
          {missing.length === 0 && (
            <span className="badge bg-emerald-500/20 text-emerald-300 shrink-0">tam</span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Fatura ünvanı" value={outlet.legal_name} />
          <Field label="Vergi dairesi / no"
            value={[outlet.tax_office, outlet.tax_number].filter(Boolean).join(' / ')} />
          <Field label="Muhasebe"
            value={roleContacts.muhasebe
              ? [roleContacts.muhasebe.full_name, roleContacts.muhasebe.phone].filter(Boolean).join(' · ')
              : null} />
          <Field label="Satın alma"
            value={roleContacts.satin_alma
              ? [roleContacts.satin_alma.full_name, roleContacts.satin_alma.phone].filter(Boolean).join(' · ')
              : null} />
          <Field label="Telefon" value={outlet.phone} />
          <Field label="E-posta" value={outlet.email} />
          <Field label="Uygun görüşme saati" value={outlet.preferred_contact_time} />
          <Field label="Mevcut tedarikçi" value={outlet.current_supplier} />
          <Field label="En çok satan içecek" value={outlet.top_selling_drink} />
          <Field label="Sözleşme bitişi"
            value={outlet.contract_end_date ? fmtDate(outlet.contract_end_date) : null} />
        </div>

        {/* Eksik bilgi varsa form açık geliyor: tek tık kazanıyoruz. */}
        <OutletEdit
          outlet={outlet as any}
          types={(allTypes ?? []) as any}
          contacts={roleContacts as any}
          defaultOpen={missing.length > 0}
          label={missing.length > 0 ? 'Eksik bilgileri tamamla' : 'Bilgileri düzenle'}
        />
      </section>

      {/* ---------- F02 — ADAY DEĞERLENDİRMESİ ---------- */}
      <section id="degerlendirme" className="card p-5 space-y-4 scroll-mt-20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-title">Aday değerlendirmesi</p>
            <p className="text-[13px] text-[#8E8E93]">
              Beş kriter, her biri 0–2. Bilinmiyorsa boş bırakın — boş kriter puanı düşürmez.
            </p>
          </div>
          {latest && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold tabular-nums">
                {latest.raw_total}<span className="text-[#8E8E93] text-base">/{latest.max_total}</span>
              </p>
              <span className={`badge ${latest.priority ? SEGMENT_COLOR[latest.priority as 'A'|'B'|'C'] : ''}`}>
                {latest.priority ? `Öncelik ${latest.priority}` : 'puanlanmadı'}
              </span>
            </div>
          )}
        </div>

        {(assessments ?? []).length > 1 && (
          <div className="text-[13px] text-[#8E8E93] space-y-1">
            {(assessments ?? []).slice(1).map((a: any) => (
              <p key={a.id}>
                {fmtDate(a.assessed_at)} · {a.raw_total}/{a.max_total}
                {a.priority ? ` · ${a.priority}` : ''}
                {a.answered_count < a.criteria_count ? ` · ${a.answered_count}/${a.criteria_count} kriter yanıtlandı` : ''}
              </p>
            ))}
          </div>
        )}

        <AssessmentForm
          outletId={outlet.id}
          criteria={(criteria ?? []) as any}
          defaults={{
            contact_name: null,
            preferred_contact_time: outlet.preferred_contact_time,
            customer_profile: outlet.top_selling_drink
          }}
        />
      </section>

      {/* ---------- ZİYARET GEÇMİŞİ ---------- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <p className="section-title">Ziyaret geçmişi</p>
          <Link href={`/sales/visits/new?outlet=${outlet.id}`} className="text-[13px] text-ios-blue">
            + Yeni
          </Link>
        </div>
        {(visits ?? []).length === 0 && (
          <p className="px-5 pb-5 text-[14px] text-[#8E8E93]">Bu noktaya henüz ziyaret kaydedilmedi.</p>
        )}
        <div className="divide-y divide-white/[0.08]">
          {(visits ?? []).map((v: any) => (
            <Link key={v.id} href={`/sales/visits/${v.id}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors">
              <span className="text-sm flex-1">{fmtDate(v.visit_date)}</span>
              {v.overall_score !== null && (
                <span className="text-[13px] text-[#8E8E93] tabular-nums">{v.overall_score}/5</span>
              )}
              <span className={`badge ${OUTCOME_COLOR[v.outcome as keyof typeof OUTCOME_COLOR]}`}>
                {OUTCOME_LABEL[v.outcome as keyof typeof OUTCOME_LABEL]}
              </span>
              {v.status === 'taslak' && <span className="badge bg-white/10 text-[#8E8E93]">taslak</span>}
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- İLETİŞİM KİŞİLERİ ---------- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">İletişim kişileri</p>
        {(contacts ?? []).length === 0 && (
          <p className="text-[14px] text-[#8E8E93]">
            Henüz kişi eklenmedi. Muhasebe ve satın alma kişisi olmadan sipariş kesilemiyor.
          </p>
        )}
        {(contacts ?? []).map((c: any) => (
          <div key={c.id} className="flex items-center justify-between gap-3 text-sm border-b border-white/[0.06] pb-2 last:border-0">
            <div className="min-w-0">
              <p className="font-medium truncate">
                {c.full_name}
                {c.is_primary && <span className="badge bg-ios-blue/20 text-ios-blue ml-2">ana muhatap</span>}
              </p>
              <p className="text-[13px] text-[#8E8E93]">
                {CONTACT_ROLE_LABEL[c.role as keyof typeof CONTACT_ROLE_LABEL]}
                {c.decision_authority ? ` · ${AUTHORITY_LABEL[c.decision_authority as keyof typeof AUTHORITY_LABEL]}` : ''}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.preferred_contact_time ? ` · ${c.preferred_contact_time}` : ''}
              </p>
            </div>
          </div>
        ))}
        <OutletContacts outletId={outlet.id} />
      </section>

      {/* ---------- TEDARİK AYARLARI ----------
          Günlük akışta gerekmeyen tek blok: en sonda ve katlanmış. */}
      <section className="card p-5">
        <details>
          <summary className="section-title cursor-pointer list-none flex items-center justify-between">
            Tedarik ayarları
            <span className="text-[12px] text-[#8E8E93] font-normal">aç / kapat</span>
          </summary>

          <p className="text-[13px] text-[#8E8E93] mt-3">
            Son ziyaret: {outlet.last_visit_at ? fmtDate(outlet.last_visit_at) : 'Hiç'}
          </p>

          <div className="mt-4">
            <SupplySettings
              outletId={outlet.id}
              leadDays={outlet.lead_days ?? 2}
              safetyStockDays={outlet.safety_stock_days ?? 3}
              isDefault={(outlet.lead_days ?? 2) === 2 && (outlet.safety_stock_days ?? 3) === 3}
            />
          </div>
        </details>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p className="flex gap-2">
      <span className="text-[#8E8E93] shrink-0">{label}:</span>
      <span className={value ? '' : 'text-[#48484A]'}>{value || '—'}</span>
    </p>
  );
}
