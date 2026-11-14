import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import OrdersClient from '@/components/sales/OrdersClient';

export const dynamic = 'force-dynamic';

/**
 * Teklif ve sipariş listesi.
 *
 * `?outlet=<id>` ile nokta kartından gelindiğinde liste o noktaya
 * daraltılıyor ve "Yeni Teklif" de aynı noktaya kilitli açılıyor —
 * nokta kartından çıkıp yeniden nokta seçmek zorunda kalmamak için.
 * Varsayılan sekme SİPARİŞLER: sahadaki asıl iş bekleyen siparişi
 * onaylamak. `?tab=quotes` teklif sekmesini açar.
 *
 * Sözlü teklifler (doğrudan satışın arka planda açtığı kayıt) teklif
 * listesinde gösterilmiyor — kullanıcının hiç yazmadığı bir belgeyi
 * listede görmesi "bu ne" sorusundan başka bir şey üretmiyordu.
 */
export default async function OrdersPage({
  searchParams
}: { searchParams: { outlet?: string; tab?: string } }) {
  const { supabase } = await getCtx();

  const outletId = searchParams.outlet;

  // RLS kapsamı belirliyor: temsilci kendi belgelerini, müdür ekibininkini,
  // admin hepsini görür. Burada ek filtre gereksiz.
  let qSel = supabase.from('quotes')
    .select('id, quote_no, status, total_incl_vat, valid_until, created_at, finance_checked_at, sales_checked_at, outlets:outlet_id(name, district)')
    .eq('is_verbal', false)
    .order('created_at', { ascending: false }).limit(200);
  let oSel = supabase.from('sales_orders')
    .select('id, order_no, status, total_amount, delivery_date, created_at, stock_confirmed_at, outlets:outlet_id(name, district), quotes:quote_id(is_verbal)')
    .order('created_at', { ascending: false }).limit(200);

  if (outletId) {
    qSel = qSel.eq('outlet_id', outletId);
    oSel = oSel.eq('outlet_id', outletId);
  }

  const [{ data: quotes }, { data: orders }, { data: outlet }] = await Promise.all([
    qSel,
    oSel,
    outletId
      ? supabase.from('outlets').select('name').eq('id', outletId).maybeSingle()
      : Promise.resolve({ data: null } as any)
  ]);

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <OrdersClient
      quotes={(quotes ?? []) as any}
      orders={(orders ?? []) as any}
      todayIso={todayIso}
      outletId={outletId}
      outletName={outlet?.name ?? null}
      initialTab={searchParams.tab === 'quotes' ? 'quotes' : 'orders'}
    />
  );
}
