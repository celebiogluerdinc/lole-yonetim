import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import OrdersClient from '@/components/sales/OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const { supabase } = await getCtx();

  // RLS kapsamı belirliyor: temsilci kendi belgelerini, müdür ekibininkini,
  // admin hepsini görür. Burada ek filtre gereksiz.
  const [{ data: quotes }, { data: orders }] = await Promise.all([
    supabase.from('quotes')
      .select('id, quote_no, status, total_incl_vat, valid_until, created_at, finance_checked_at, sales_checked_at, outlets:outlet_id(name, district)')
      .order('created_at', { ascending: false }).limit(200),
    supabase.from('sales_orders')
      .select('id, order_no, status, total_amount, delivery_date, created_at, stock_confirmed_at, outlets:outlet_id(name, district)')
      .order('created_at', { ascending: false }).limit(200)
  ]);

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <OrdersClient
      quotes={(quotes ?? []) as any}
      orders={(orders ?? []) as any}
      todayIso={todayIso}
    />
  );
}
