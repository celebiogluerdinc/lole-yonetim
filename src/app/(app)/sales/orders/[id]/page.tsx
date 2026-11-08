import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import OrderDetailActions from '@/components/sales/OrderDetailActions';
import { SalesStep } from '@/components/sales/OrdersClient';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, tl, casesOf, type OrderStatus
} from '@/lib/commerce-format';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: { id: string } }) {
  const { supabase, companyId } = await getCtx();

  const { data: order } = await supabase.from('sales_orders')
    .select('*, outlets:outlet_id(id, name, district, city), quotes:quote_id(id, quote_no)')
    .eq('id', params.id).maybeSingle();
  if (!order) notFound();

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
    <main className="py-5 space-y-5">
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

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
          <Field label="Fatura ünvanı" value={order.invoice_title} />
          <Field label="Vergi dairesi / no"
            value={[order.tax_office, order.tax_number].filter(Boolean).join(' / ') || null} />
          <Field label="Ödeme şekli" value={order.payment_method} />
          <Field label="Tahsilat referansı" value={order.collection_ref} />
          <Field label="Müşteri onay tarihi" value={order.customer_approval_date ? fmtDate(order.customer_approval_date) : null} />
          <Field label="Teslimat tarihi" value={order.delivery_date ? fmtDate(order.delivery_date) : null} />
        </div>

        {/* ZİNCİR: ziyaret → teklif → sipariş. Belgeler arasında menüye
            dönmek gerekmiyor; her halka tek tıkla açılıyor. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {order.visit_id && (
            <Link href={`/sales/visits/${order.visit_id}`} className="text-ios-blue hover:underline">
              ← Bağlı ziyaret
            </Link>
          )}
          {order.quotes && (
            <Link href={`/sales/orders/quotes/${order.quotes.id}`} className="text-ios-blue hover:underline">
              ← Kaynak teklif{order.quotes.quote_no ? ` #${order.quotes.quote_no}` : ''}
            </Link>
          )}
          <Link href={`/sales/orders?outlet=${order.outlet_id}&tab=orders`}
            className="text-ios-blue hover:underline">
            Bu noktanın tüm belgeleri
          </Link>
        </div>
      </header>

      <section className="card p-5 space-y-3">
        <SalesStep n={2} title="Ne" sub="Siparişin kalemleri" />
        {(items ?? []).length === 0 && <p className="text-[14px] text-[#8E8E93]">Kalem yok.</p>}
        {(items ?? []).map((i: any) => (
          <div key={i.product_id} className="flex items-center justify-between gap-3 text-sm border-b border-white/[0.06] pb-2 last:border-0">
            <div className="min-w-0">
              <p className="font-medium truncate">{i.products?.name ?? 'Ürün'}</p>
              <p className="text-[12px] text-[#8E8E93]">
                {casesOf(i.paid_bottles)} ücretli koli ({i.paid_bottles} şişe) × {tl(Number(i.unit_price))}
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

      <section className="card p-5 space-y-2 text-sm">
        <SalesStep n={4} title="Koşullar" sub="Teslimat bilgisi" />
        <Field label="Adres" value={order.delivery_address} />
        <Field label="Teslim alan" value={order.receiver_name} />
        <Field label="Telefon" value={order.receiver_phone} />
        <Field label="Saat aralığı" value={order.delivery_time_window} />
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
      />

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
  return (
    <p className="flex gap-2">
      <span className="text-[#8E8E93] shrink-0">{label}:</span>
      <span className={value ? '' : 'text-[#48484A]'}>{value || '—'}</span>
    </p>
  );
}
