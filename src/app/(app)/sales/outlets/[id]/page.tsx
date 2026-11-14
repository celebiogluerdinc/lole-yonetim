import { notFound } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { fmtDate, TZ } from '@/lib/utils';
import { CONTACT_ROLE_LABEL, AUTHORITY_LABEL } from '@/lib/sales-types';
import OutletWorkspace from '@/components/sales/OutletWorkspace';
import OutletContacts from '@/components/sales/OutletContacts';
import SupplySettings from '@/components/sales/SupplySettings';
import OutletEdit from '@/components/sales/OutletEdit';
import OutletDangerZone from '@/components/sales/OutletDangerZone';
import { Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * NOKTA KARTI
 *
 * Bu sayfa modülün çalışma alanı: ziyaret, doğrudan satış ve teklif
 * kartın içinde açılıyor (OutletWorkspace). Eskiden
 * her biri ayrı sayfaydı ve aralarında gezinmek "sayfalar arası
 * kargaşa" şikâyetinin kaynağıydı.
 *
 * Sunucu tarafında tek tur: panellerin ihtiyaç duyduğu ürün, kriter,
 * neden, kişi ve fiyat listesi önden geliyor — panel açılınca ikinci
 * bir bekleme olmuyor.
 */
export default async function OutletPage({ params }: { params: { id: string } }) {
  const { supabase, companyId } = await getCtx();

  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', params.id).maybeSingle();
  if (!outlet) notFound();

  const empty = Promise.resolve({ data: [] } as any);

  // Tek tur, on bir sorgu. Kriterler (F02+F03) tek sorguda geliyor ve
  // noktanın türü zaten çekilen tür listesinden bulunuyor — eskiden bu
  // ikisi için dört ayrı gidiş-dönüş vardı.
  const [
    contactsR, assessmentsR, visitsR, quotesR, ordersR,
    criteriaR, reasonsR, peopleR, productsR, typesR, pricesR, funnelR
  ] = await Promise.all([
    supabase.from('outlet_contacts').select('*').eq('outlet_id', outlet.id)
      .order('is_primary', { ascending: false }),
    supabase.from('outlet_assessments')
      .select('id, assessed_at, raw_total, max_total, answered_count, criteria_count, score_pct, priority')
      .eq('outlet_id', outlet.id).order('assessed_at', { ascending: false }).limit(5),
    supabase.from('visits')
      .select('id, visit_date, outcome, overall_score, status')
      .eq('outlet_id', outlet.id).order('visit_date', { ascending: false }).limit(15),
    // Sözlü teklif (doğrudan satışın arka plan kaydı) burada gösterilmez:
    // kullanıcı yazmadığı bir "teklif"i geçmişte görünce ne olduğunu anlamıyordu.
    supabase.from('quotes')
      .select('id, quote_no, status, total_incl_vat, created_at')
      .eq('outlet_id', outlet.id).eq('is_verbal', false)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('sales_orders')
      .select('id, order_no, status, total_amount, delivery_date, created_at, quote_id')
      .eq('outlet_id', outlet.id).order('created_at', { ascending: false }).limit(10),
    companyId
      ? supabase.from('score_criteria')
          .select('id, label, grp, applies_to, scale_min, scale_max, sort_order, form_code')
          .eq('company_id', companyId).in('form_code', ['F02', 'F03']).eq('is_active', true).order('sort_order')
      : empty,
    companyId
      ? supabase.from('no_order_reasons').select('id, label, requires_note')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : empty,
    companyId
      ? supabase.from('profiles').select('id, full_name')
          .eq('company_id', companyId).eq('is_active', true).order('full_name')
      : empty,
    companyId
      ? supabase.from('products').select('id, name, taste_reference')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : empty,
    companyId
      ? supabase.from('outlet_types').select('id, name, channel, is_quick_pick, is_active')
          .eq('company_id', companyId).order('sort_order')
      : empty,
    // Fiyatlar tek çağrıda: paneller açılınca beklemesin
    supabase.rpc('fn_prices_for_outlet', { oid: outlet.id }),
    supabase.from('v_outlet_funnel')
      .select('stage, order_count, last_order_at, days_since_order, cycle_days, order_total')
      .eq('outlet_id', outlet.id).maybeSingle()
  ]);

  const contacts = contactsR.data, assessments = assessmentsR.data, visits = visitsR.data;
  const quotes = quotesR.data, orders = ordersR.data;
  const reasons = reasonsR.data, people = peopleR.data, products = productsR.data;
  const priceRows = pricesR.data;
  const funnel = (funnelR.data ?? null) as null | {
    stage: string; order_count: number; last_order_at: string | null;
    days_since_order: number | null; cycle_days: number | null; order_total: number | null;
  };
  const criteriaF02 = ((criteriaR.data ?? []) as any[]).filter(c => c.form_code === 'F02');
  const criteriaF03 = ((criteriaR.data ?? []) as any[]).filter(c => c.form_code === 'F03');
  const type = ((typesR.data ?? []) as any[]).find(t => t.id === outlet.type_id) ?? null;
  const allTypes = ((typesR.data ?? []) as any[]);

  // Sessiz boş ekran yerine görünür uyarı: sorgulardan biri düştüyse
  // kullanıcı "kayıt yok" sanmasın.
  const loadError = [contactsR, visitsR, quotesR, ordersR, productsR, pricesR]
    .map(r => (r as any).error?.message).find(Boolean) ?? null;

  const prices: Record<string, number | null> = {};
  for (const r of (priceRows ?? []) as any[]) {
    prices[r.product_id] = r.price === null || r.price === undefined ? null : Number(r.price);
  }

  const roleContact = (role: string) => {
    const c = (contacts ?? []).find((x: any) => x.role === role);
    return c ? { full_name: c.full_name, phone: c.phone, email: c.email } : null;
  };
  const roleContacts = {
    muhasebe: roleContact('muhasebe'),
    satin_alma: roleContact('satin_alma')
  };

  /* Eksikler UYARI, engel değil: sahada nokta açmak için yalnızca ad
     gerekiyor. Burada yazılanlar fatura kesmek için gerekli olanlar. */
  const missing: string[] = [];
  if (!outlet.tax_number) missing.push('vergi no');
  if (!roleContacts.muhasebe) missing.push('muhasebe kişisi');
  if (!roleContacts.satin_alma) missing.push('satın alma kişisi');
  if (!outlet.address) missing.push('adres');

  const hasVisit = (visits ?? []).length > 0;
  const lastVisit = (visits ?? [])[0];
  const stage = funnel?.stage ?? null;
  const pendingOrder = ((orders ?? []) as any[]).find(o => ['taslak', 'onay_bekliyor'].includes(o.status));
  const shippingOrder = ((orders ?? []) as any[]).find(o => ['onayli', 'sevk_edildi'].includes(o.status));
  const orderQuoteIds = new Set(((orders ?? []) as any[]).map(o => o.quote_id).filter(Boolean));
  const openQuote = ((quotes ?? []) as any[]).find(q =>
    ['onayli', 'sunuldu', 'kabul'].includes(q.status) && !orderQuoteIds.has(q.id));
  const draftQuote = ((quotes ?? []) as any[]).find(q => ['taslak', 'kontrolde'].includes(q.status));

  /* SIRADAKİ ADIM — kart hangi aşamada olduğunu kendisi söylüyor.
     Sıra, işin aciliyetine göre: önce yarım kalan belge (bekleyen
     sipariş, onaylanmamış/çevrilmemiş teklif), sonra müşterinin huni
     aşaması. Aday değerlendirmesi artık ilk adım değil: sahada önce
     kapıdan girilir, puanlama sonra yapılır. */
  const next = (() => {
    if (pendingOrder) return {
      title: 'Bekleyen siparişi onayla',
      note: `Sipariş${pendingOrder.order_no ? ` #${pendingOrder.order_no}` : ''} onay bekliyor — tek dokunuş.`,
      panel: null, href: `/sales/orders/${pendingOrder.id}`, cta: 'Siparişi aç'
    };
    if (openQuote) return {
      title: 'Teklifi siparişe çevir',
      note: `Teklif${openQuote.quote_no ? ` #${openQuote.quote_no}` : ''} onaylı. Müşteri kabul ettiyse siparişe dönüştürün.`,
      panel: null, href: `/sales/orders/quotes/${openQuote.id}`, cta: 'Teklifi aç'
    };
    if (draftQuote) return {
      title: 'Teklifi onayla',
      note: `Teklif${draftQuote.quote_no ? ` #${draftQuote.quote_no}` : ''} taslakta bekliyor.`,
      panel: null, href: `/sales/orders/quotes/${draftQuote.id}`, cta: 'Teklifi aç'
    };
    if (shippingOrder) return {
      title: shippingOrder.status === 'onayli' ? 'Siparişi sevk et' : 'Teslimi teyit et',
      note: `Sipariş${shippingOrder.order_no ? ` #${shippingOrder.order_no}` : ''} yolda.`,
      panel: null, href: `/sales/orders/${shippingOrder.id}`, cta: 'Siparişi aç'
    };
    if (stage === 'donuk') return {
      title: 'Müşteri durdu — tekrar sipariş al',
      note: `Son sipariş ${funnel?.days_since_order ?? '?'} gün önce`
        + (funnel?.cycle_days ? ` (olağan döngü ${funnel.cycle_days} gün)` : '') + '. Arayın ya da uğrayın.',
      panel: 'satis' as const, cta: 'Doğrudan satış'
    };
    if (stage === 'ilk_siparis') return {
      title: 'İkinci siparişi al',
      note: 'Tek sipariş deneme sayılır; müşteri ikinci siparişte kazanılır. Rafı kontrol edin.',
      panel: 'satis' as const, cta: 'Doğrudan satış'
    };
    if (stage === 'aktif') return {
      title: 'Rutin ziyaret veya tekrar sipariş',
      note: lastVisit
        ? `Son ziyaret ${fmtDate(lastVisit.visit_date)}`
          + (funnel?.days_since_order != null ? ` · son sipariş ${funnel.days_since_order} gün önce` : '') + '.'
        : 'Aktif müşteri. Rafı ve stoğu kontrol edin.',
      panel: 'ziyaret' as const, cta: 'Ziyaret kaydet'
    };
    if (!hasVisit) return {
      title: 'İlk ziyareti kaydet',
      note: 'Form tek sayfa; zorunlu olan yalnızca sonuç.',
      panel: 'ziyaret' as const, cta: 'Ziyaret kaydet'
    };
    return {
      title: 'Satışı kapat',
      note: 'Fiyat konuşulduysa doğrudan satış; yazılı belge isteniyorsa teklif.',
      panel: 'satis' as const, cta: 'Doğrudan satış'
    };
  })();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <OutletWorkspace
      outlet={outlet as any}
      typeName={type?.name ?? null}
      missing={missing}
      next={next as any}
      visits={(visits ?? []) as any}
      quotes={(quotes ?? []) as any}
      orders={(orders ?? []) as any}
      assessments={(assessments ?? []) as any}
      products={(products ?? []) as any}
      prices={prices}
      criteriaF02={(criteriaF02 ?? []) as any}
      criteriaF03={(criteriaF03 ?? []) as any}
      reasons={(reasons ?? []) as any}
      people={(people ?? []) as any}
      today={today}
      funnel={funnel}
      loadError={loadError}
      balance={{
        open_balance: outlet.open_balance ?? null,
        overdue_days: outlet.overdue_days ?? null,
        balance_note: outlet.balance_note ?? null,
        balance_updated_at: outlet.balance_updated_at ?? null
      }}
    >
      {/* ---------- FİRMA BİLGİLERİ ---------- */}
      <section id="firma-bilgileri" className="card p-4 space-y-3 scroll-mt-24">
        <div className="flex items-start justify-between gap-3">
          <p className="section-title !mb-0">Firma bilgileri</p>
          {missing.length === 0 && (
            <span className="badge bg-emerald-500/20 text-emerald-300 shrink-0">tam</span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13.5px]">
          <Field label="Fatura ünvanı" value={outlet.legal_name} />
          <Field label="Vergi dairesi / no"
            value={[outlet.tax_office, outlet.tax_number].filter(Boolean).join(' / ')} />
          <Field label="Adres" value={outlet.address} />
          <Field label="Telefon" value={outlet.phone} />
          <Field label="Muhasebe"
            value={roleContacts.muhasebe
              ? [roleContacts.muhasebe.full_name, roleContacts.muhasebe.phone].filter(Boolean).join(' · ')
              : null} />
          <Field label="Satın alma"
            value={roleContacts.satin_alma
              ? [roleContacts.satin_alma.full_name, roleContacts.satin_alma.phone].filter(Boolean).join(' · ')
              : null} />
          <Field label="Mevcut tedarikçi" value={outlet.current_supplier} />
          <Field label="En çok satan" value={outlet.top_selling_drink} />
        </div>

        <OutletEdit
          outlet={outlet as any}
          types={allTypes.filter((t: any) => t.is_active !== false) as any}
          contacts={roleContacts as any}
          defaultOpen={missing.length > 0}
          label={missing.length > 0 ? 'Eksik bilgileri tamamla' : 'Bilgileri düzenle'}
        />
      </section>

      {/* ---------- KİŞİLER & AYARLAR ---------- */}
      <section className="card p-4">
        <details>
          <summary className="section-title cursor-pointer list-none flex items-center justify-between">
            Kişiler, tedarik ayarları ve silme
            <span className="text-[12px] text-[#8E8E93] font-normal">aç / kapat</span>
          </summary>

          <div className="mt-4 space-y-2">
            {(contacts ?? []).map((c: any) => (
              <div key={c.id} className="text-[13.5px] border-b border-white/[0.06] pb-2 last:border-0">
                <p className="font-medium">
                  {c.full_name}
                  {c.is_primary && <span className="badge bg-ios-blue/20 text-ios-blue ml-2">ana muhatap</span>}
                </p>
                <p className="text-[12.5px] text-[#8E8E93]">
                  {CONTACT_ROLE_LABEL[c.role as keyof typeof CONTACT_ROLE_LABEL]}
                  {c.decision_authority
                    ? ` · ${AUTHORITY_LABEL[c.decision_authority as keyof typeof AUTHORITY_LABEL]}` : ''}
                  {c.phone ? ` · ${c.phone}` : ''}
                </p>
              </div>
            ))}
            <OutletContacts outletId={outlet.id} />
          </div>

          <div className="mt-4">
            <SupplySettings
              outletId={outlet.id}
              leadDays={outlet.lead_days ?? 2}
              safetyStockDays={outlet.safety_stock_days ?? 3}
              isDefault={(outlet.lead_days ?? 2) === 2 && (outlet.safety_stock_days ?? 3) === 3}
            />
          </div>

          <p className="text-[12.5px] text-[#8E8E93] mt-4">
            Son ziyaret: {outlet.last_visit_at ? fmtDate(outlet.last_visit_at) : 'Hiç'}
          </p>

          <div className="mt-4">
            <OutletDangerZone
              outletId={outlet.id}
              name={outlet.name}
              isActive={outlet.is_active !== false}
            />
          </div>
        </details>
      </section>
    </OutletWorkspace>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p className="flex gap-2">
      <span className="text-[#8E8E93] shrink-0">{label}:</span>
      <span className={value ? 'min-w-0 truncate' : 'text-[#AEAEB2]'}>{value || '—'}</span>
    </p>
  );
}
