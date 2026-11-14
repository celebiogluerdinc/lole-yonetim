import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import OrderDetailActions from '@/components/sales/OrderDetailActions';
import PrintButton from '@/components/sales/PrintButton';
import { OrderDeleteButton } from '@/components/sales/DocDeleteButtons';
import { MapPin, Phone } from 'lucide-react';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, tl, casesOf, casePriceFromBottle, type OrderStatus
} from '@/lib/commerce-format';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: { id: string } }) {
  const { supabase, companyId } = await getCtx();

  // Noktanın adresi ve telefonu da geliyor: sipariş kartında adres
  // görünmediği için temsilci her teslimde nokta sekmesine gidiyordu.
  const { data: order } = await supabase.from('sales_orders')
    .select('*, outlets:outlet_id(id, name, district, city, address, phone), quotes:quote_id(id, quote_no, is_verbal, verbal_note)')
    .eq('id', params.id).maybeSingle();
  if (!order) notFound();

  /* Teslim adresi sipariş açılırken noktadan KOPYALANIYOR (belge kendi
     bilgisiyle kalsın diye). Kopyalanmadıysa veya nokta sonradan
     doldurulduysa noktanın güncel adresini gösteriyoruz. */
  const addr = order.delivery_address || order.outlets?.address || null;
  const addrFromOutlet = !order.delivery_address && !!order.outlets?.address;
  const tel = order.receiver_phone || order.outlets?.phone || null;
  const mapsHref = addr
    ? `https://maps.google.com/?q=${encodeURIComponent(
        [addr, order.outlets?.district, order.outlets?.city].filter(Boolean).join(' '))}`
    : null;

  const [{ data: items }, { data: people }, { data: names }, { data: visits }, { data: fups }] =
    await Promise.all([
      supabase.from('sales_order_items')
        .select('product_id, paid_bottles, free_bottles, unit_price, line_total, paid_cases, products:product_id(name), product_batches:batch_id(batch_no, expiry_date)')
        .eq('order_id', order.id).order('position'),
      companyId
        ? supabase.from('profiles').select('id, full_name')
            .eq('company_id', companyId).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] } as any),
      supabase.from('profiles').select('id, full_name')
        .in('id', [order.stock_confirmed_by, order.order_accepted_by, order.first_followup_owner]
          .filter(Boolean) as string[]),
      // aynı noktadaki, henüz siparişe bağlanmamış ziyaretler
      supabase.from('visits')
        .select('id, visit_date, outcome')
        .eq('outlet_id', order.outlet_id).is('sales_order_id', null)
        .order('visit_date', { ascending: false }).limit(10),
      supabase.from('follow_ups')
        .select('id, action, due_date, status, profiles:owner_user_id(full_name)')
        .eq('source_type', 'order').eq('source_id', order.id)
    ]);

  const nameOf = (id: string | null) =>
    id ? ((names ?? []).find((p: any) => p.id === id)?.full_name ?? null) : null;

  const status = order.status as OrderStatus;
  const freeTotal = (items ?? []).reduce((s: number, i: any) => s + (i.free_bottles ?? 0), 0);

  return (
    <main id="print-area" className="py-5 space-y-5">
      {/* Çıktı: müşteriye verilecek belge — yazdırma ekrandaki kartı
          olduğu gibi alıyor, ayrı bir PDF şablonu tutulmuyor. */}
      <div className="flex flex-wrap gap-2 px-1" data-noprint>
        <PrintButton label="Siparişi yazdır" />
        <OrderDeleteButton orderId={order.id} orderNo={order.order_no} />
      </div>

      <header className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">
              Sipariş{order.order_no ? ` #${order.order_no}` : ''}
            </h1>
            <Link href={`/sales/outlets/${order.outlets?.id}`}
              className="text-sm text-[#8E8E93] hover:underline">
              {order.outlets?.name}
              {order.outlets?.district ? ` · ${order.outlets.district}` : ''}
            </Link>
          </div>
          <span className={`badge shrink-0 ${ORDER_STATUS_COLOR[status]}`}>
            {ORDER_STATUS_LABEL[status]}
          </span>
        </div>

        {/* TESLİMAT — kartın en üstünde.
            Adres aşağıdaki koşullar bloğundaydı; temsilci her teslimde
            nokta sekmesine gidip adresi arıyordu. Adres haritaya,
            telefon aramaya bağlı: sahada en çok dokunulan iki şey. */}
        <div className="mt-4 rounded-xl bg-white/[0.04] px-3.5 py-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#8E8E93] font-bold">
            Teslimat
          </p>
          {addr ? (
            <a href={mapsHref!} target="_blank" rel="noreferrer"
              className="flex items-start gap-2 text-[14.5px] text-ios-blue">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              <span>{addr}</span>
            </a>
          ) : (
            <Link href={`/sales/outlets/${order.outlets?.id}#firma-bilgileri`}
              className="flex items-center gap-2 text-[14px] text-amber-300">
              <MapPin size={15} /> Adres yok — noktaya ekle
            </Link>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
            {tel && (
              <a href={`tel:${tel.replace(/\s/g, '')}`} className="flex items-center gap-1.5 text-ios-blue">
                <Phone size={13} />{tel}
              </a>
            )}
            {order.receiver_name && (
              <span className="text-[#AEAEB2]">Teslim alan: {order.receiver_name}</span>
            )}
            {order.delivery_date && (
              <span className="text-[#AEAEB2]">
                {fmtDate(order.delivery_date)}
                {order.delivery_time_window ? ` · ${order.delivery_time_window}` : ''}
              </span>
            )}
          </div>
          {addrFromOutlet && (
            <p className="text-[11.5px] text-[#8E8E93]">
              Noktanın kayıtlı adresi — siparişte ayrı adres girilmemiş.
            </p>
          )}
        </div>

        {/* Yalnız DOLU alanlar. Boş alanların "—" ile dizilmesi kartı
            uzatıyor, dolu olanı arattırıyordu. */}
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm empty:hidden">
          <Field label="Fatura ünvanı" value={order.invoice_title} />
          <Field label="Vergi dairesi / no"
            value={[order.tax_office, order.tax_number].filter(Boolean).join(' / ') || null} />
          <Field label="Ödeme şekli" value={order.payment_method} />
          <Field label="Tahsilat referansı" value={order.collection_ref} />
          <Field label="Müşteri onay tarihi" value={order.customer_approval_date ? fmtDate(order.customer_approval_date) : null} />
        </div>

        {/* ZİNCİR: ziyaret → teklif → sipariş. Belgeler arasında menüye
            dönmek gerekmiyor; her halka tek tıkla açılıyor. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {order.visit_id && (
            <Link href={`/sales/visits/${order.visit_id}`} className="text-ios-blue hover:underline">
              ← Bağlı ziyaret
            </Link>
          )}
          {/* Doğrudan satışın arkasındaki sözlü teklif kullanıcının yazdığı
              bir belge değil; bağlantı yerine ne olduğunu söylüyoruz. */}
          {order.quotes && !order.quotes.is_verbal && (
            <Link href={`/sales/orders/quotes/${order.quotes.id}`} className="text-ios-blue hover:underline">
              ← Kaynak teklif{order.quotes.quote_no ? ` #${order.quotes.quote_no}` : ''}
            </Link>
          )}
          {order.quotes?.is_verbal && (
            <span className="text-[#8E8E93]">
              Doğrudan satış{order.quotes.verbal_note ? ` · ${order.quotes.verbal_note}` : ''}
            </span>
          )}
          <Link href={`/sales/orders?outlet=${order.outlet_id}&tab=orders`}
            className="text-ios-blue hover:underline">
            Bu noktanın tüm belgeleri
          </Link>
        </div>
      </header>

      {/* "Sıradaki adım" kartı en üstte, kalemler onun altında: sipariş
          açan kişinin ilk sorusu "şimdi ne yapacağım", ikincisi "ne sattım". */}
      <OrderDetailActions
        order={{
          id: order.id,
          outlet_id: order.outlet_id,
          status,
          stock_confirmed_at: order.stock_confirmed_at,
          stock_confirmed_by_name: nameOf(order.stock_confirmed_by),
          order_accepted_at: order.order_accepted_at,
          order_accepted_by_name: nameOf(order.order_accepted_by),
          visit_id: order.visit_id,
          cancel_reason: order.cancel_reason
        }}
        people={(people ?? []) as any}
        linkableVisits={(visits ?? []) as any}
      >
        <section className="card p-5 space-y-3">
          <p className="section-title">Kalemler</p>
          {(items ?? []).length === 0 && <p className="text-[14px] text-[#8E8E93]">Kalem yok.</p>}
          {(items ?? []).map((i: any) => (
            <div key={i.product_id} className="flex items-center justify-between gap-3 text-sm border-b border-white/[0.06] pb-2 last:border-0">
              <div className="min-w-0">
                <p className="font-medium truncate">{i.products?.name ?? 'Ürün'}</p>
                <p className="text-[12px] text-[#8E8E93]">
                  {casesOf(i.paid_bottles)} koli × {tl(casePriceFromBottle(Number(i.unit_price)))}
                  <span className="text-[#AEAEB2]"> · {i.paid_bottles} şişe</span>
                  {i.free_bottles > 0 ? ` · ${casesOf(i.free_bottles)} bedelsiz koli` : ''}
                  {i.product_batches?.batch_no ? ` · parti ${i.product_batches.batch_no}` : ''}
                </p>
              </div>
              <span className="tabular-nums shrink-0">{tl(Number(i.line_total))}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[13px] text-[#8E8E93]">
              Toplam{freeTotal > 0 ? ` · ${casesOf(freeTotal)} bedelsiz koli (tutara girmez)` : ''}
              {order.vat_included ? ' · KDV dahil' : ' · KDV hariç'}
            </span>
            <span className="text-xl font-bold tabular-nums">{tl(Number(order.total_amount))}</span>
          </div>
        </section>

        {(order.training_appointment_at || order.first_followup_date) && (
          <section className="card p-5 space-y-2 text-sm">
            <p className="section-title">Sonraki halkalar</p>
            <Field label="Eğitim randevusu"
              value={order.training_appointment_at ? fmtDate(order.training_appointment_at) : null} />
            <Field label="İlk takip"
              value={order.first_followup_date
                ? `${fmtDate(order.first_followup_date)}${nameOf(order.first_followup_owner) ? ` · ${nameOf(order.first_followup_owner)}` : ''}`
                : null} />
          </section>
        )}
      </OrderDetailActions>

      {(fups ?? []).length > 0 && (
        <section className="card p-5 space-y-2">
          <p className="section-title">Takipler</p>
          {(fups ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{f.action}</p>
                <p className="text-[12px] text-[#8E8E93]">
                  {f.profiles?.full_name ?? '—'} · {fmtDate(f.due_date)}
                </p>
              </div>
              <span className={`badge shrink-0 ${
                f.status === 'kapandi' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                {f.status === 'kapandi' ? 'Kapandı' : 'Açık'}
              </span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="flex gap-2">
      <span className="text-[#8E8E93] shrink-0">{label}:</span>
      <span>{value}</span>
    </p>
  );
}
