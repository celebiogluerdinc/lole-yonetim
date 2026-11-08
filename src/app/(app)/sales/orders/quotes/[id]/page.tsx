import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import QuoteDetail from '@/components/sales/QuoteDetail';
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_COLOR, type QuoteStatus } from '@/components/sales/OrdersClient';

export const dynamic = 'force-dynamic';

export default async function QuotePage({ params }: { params: { id: string } }) {
  const { supabase, companyId } = await getCtx();

  const { data: quote } = await supabase.from('quotes')
    .select('*, outlets:outlet_id(id, name, district, city, address, phone)')
    .eq('id', params.id).maybeSingle();
  if (!quote) notFound();

  const [{ data: items }, { data: people }, { data: batches }, { data: checkers }, { data: order }] =
    await Promise.all([
      supabase.from('quote_items')
        .select('product_id, bottles, unit_price, discount, net_line, products:product_id(name)')
        .eq('quote_id', quote.id).order('position'),
      companyId
        ? supabase.from('profiles').select('id, full_name')
            .eq('company_id', companyId).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] } as any),
      companyId
        ? supabase.from('product_batches').select('id, product_id, batch_no, expiry_date')
            .eq('company_id', companyId).eq('is_active', true).order('expiry_date')
        : Promise.resolve({ data: [] } as any),
      supabase.from('profiles').select('id, full_name')
        .in('id', [quote.finance_checked_by, quote.sales_checked_by].filter(Boolean) as string[]),
      supabase.from('sales_orders').select('id, order_no').eq('quote_id', quote.id).maybeSingle()
    ]);

  const nameOf = (id: string | null) =>
    id ? ((checkers ?? []).find((p: any) => p.id === id)?.full_name ?? null) : null;

  const lines = (items ?? []).map((i: any) => ({
    product_id: i.product_id,
    product_name: i.products?.name ?? 'Ürün',
    bottles: i.bottles,
    unit_price: Number(i.unit_price),
    discount: Number(i.discount),
    net_line: Number(i.net_line)
  }));

  const status = quote.status as QuoteStatus;
  const canConvert = ['onayli', 'sunuldu'].includes(status) && !order;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">
              Teklif{quote.quote_no ? ` #${quote.quote_no}` : ''}
            </h1>
            <Link href={`/sales/outlets/${quote.outlets?.id}`}
              className="text-sm text-[#8E8E93] hover:underline">
              {quote.outlets?.name}
              {quote.outlets?.district ? ` · ${quote.outlets.district}` : ''}
            </Link>
          </div>
          <span className={`badge shrink-0 ${QUOTE_STATUS_COLOR[status]}`}>
            {QUOTE_STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-[13px] text-[#8E8E93] mt-3">
          Oluşturma {fmtDate(quote.created_at)}
          {quote.valid_until ? ` · geçerlilik ${fmtDate(quote.valid_until)}` : ''}
        </p>
        {order && (
          <Link href={`/sales/orders/${order.id}`}
            className="mt-3 inline-block text-[13px] text-ios-blue hover:underline">
            Bu tekliften sipariş oluşturuldu{order.order_no ? ` (#${order.order_no})` : ''} →
          </Link>
        )}
      </header>

      <QuoteDetail
        quote={{
          id: quote.id,
          quote_no: quote.quote_no,
          status,
          outlet_id: quote.outlet_id,
          outlet_name: quote.outlets?.name ?? 'Nokta',
          valid_until: quote.valid_until,
          price_list_version: quote.price_list_version,
          subtotal_excl_vat: Number(quote.subtotal_excl_vat),
          vat_rate: Number(quote.vat_rate),
          vat_amount: Number(quote.vat_amount),
          total_incl_vat: Number(quote.total_incl_vat),
          payment_method: quote.payment_method,
          approved_term_days: quote.approved_term_days,
          delivery_fee_included: quote.delivery_fee_included,
          delivery_date: quote.delivery_date,
          campaign_note: quote.campaign_note,
          written_approval_ref: quote.written_approval_ref,
          finance_checked_at: quote.finance_checked_at,
          sales_checked_at: quote.sales_checked_at,
          reject_reason: quote.reject_reason
        }}
        lines={lines}
        people={(people ?? []) as any}
        financeName={nameOf(quote.finance_checked_by)}
        salesName={nameOf(quote.sales_checked_by)}
        canConvert={canConvert}
        orderProps={{
          batches: (batches ?? []) as any,
          defaults: {
            delivery_address: quote.outlets?.address ?? null,
            receiver_phone: quote.outlets?.phone ?? null,
            payment_method: quote.payment_method,
            delivery_date: quote.delivery_date
          }
        }}
      />
    </main>
  );
}
