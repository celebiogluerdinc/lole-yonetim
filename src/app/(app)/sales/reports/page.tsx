import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import SalesReports from '@/components/sales/SalesReports';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const { supabase, companyId } = await getCtx();

  // En geniş pencere aylık rapor için: son 60 gün yeterli
  // (önceki ayla karşılaştırma dahil). Hacim küçük, canlı sorgu uygun.
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

  const [
    { data: visits }, { data: reasons }, { data: outlets },
    { data: people }, { data: targets }, { data: orders }
  ] = await Promise.all([
    supabase.from('visits')
      .select(`id, visit_date, outcome, status, user_id, outlet_id,
               objection_stated_id, objection_real_id,
               outlets:outlet_id(name, city, status, outlet_types:type_id(channel)),
               profiles:user_id(full_name),
               visit_tastings(product_id)`)
      .gte('visit_date', since)
      .order('visit_date', { ascending: false })
      .limit(5000),
    companyId
      ? supabase.from('no_order_reasons').select('id, label').eq('company_id', companyId)
      : Promise.resolve({ data: [] } as any),
    supabase.from('outlets').select('id, status, segment, last_visit_at, city')
      .eq('is_active', true).limit(3000),
    companyId
      ? supabase.from('profiles').select('id, full_name').eq('company_id', companyId)
          .eq('is_active', true)
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('sales_targets').select('scope, scope_value, period, metric, target_value')
          .eq('company_id', companyId).eq('metric', 'ziyaret').eq('period', 'gunluk')
      : Promise.resolve({ data: [] } as any),
    supabase.from('sales_orders')
      .select('id, created_at, total_amount, outlet_id, status')
      .gte('created_at', since).limit(3000)
  ]);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return (
    <SalesReports
      visits={(visits ?? []) as any}
      reasons={(reasons ?? []) as any}
      outlets={(outlets ?? []) as any}
      people={(people ?? []) as any}
      targets={(targets ?? []) as any}
      orders={(orders ?? []) as any}
      today={today}
    />
  );
}
