import { getCtx } from '@/lib/auth';
import OutletsClient from '@/components/sales/OutletsClient';

export const dynamic = 'force-dynamic';

export default async function OutletsPage() {
  const { supabase, companyId } = await getCtx();

  const [{ data: outletRows, error }, { data: types }, { data: funnel }] = await Promise.all([
    supabase.from('outlets')
      .select('id, name, code, city, district, status, segment, score_pct, last_visit_at, phone, type_id, tax_number, open_balance, overdue_days')
      .eq('is_active', true)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(500),
    companyId
      ? supabase.from('outlet_types')
          .select('id, name, channel, is_quick_pick, sort_order')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    // Huni aşaması veriden hesaplanır (ziyaret, tadım, sipariş). Liste
    // "aktif müşteri hangisi, hangisi durdu" sorusuna elle seçilen
    // durumdan değil gerçek sipariş kaydından cevap veriyor.
    supabase.from('v_outlet_funnel')
      .select('outlet_id, stage, order_count, days_since_order').limit(1000)
  ]);

  const stageOf = new Map<string, any>(((funnel ?? []) as any[]).map(f => [f.outlet_id, f]));
  const outlets = ((outletRows ?? []) as any[]).map(o => {
    const f = stageOf.get(o.id);
    return {
      ...o,
      stage: f?.stage ?? null,
      order_count: f?.order_count ?? 0,
      days_since_order: f?.days_since_order ?? null
    };
  });

  return (
    <OutletsClient outlets={outlets as any} types={(types ?? []) as any}
      loadError={error?.message ?? null} />
  );
}
