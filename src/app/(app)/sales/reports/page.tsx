import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import { isSalesManager } from '@/lib/sales-badges';
import { addDays } from '@/lib/sales-metrics';
import SalesReports from '@/components/sales/SalesReports';

export const dynamic = 'force-dynamic';

/** En uzun dönem 90 gün + karşılaştırma için bir önceki 90 gün. */
const WINDOW_DAYS = 185;

/**
 * PostgREST tek istekte en çok 1000 satır döndürür; `.limit(5000)` bunu
 * aşmaz. Satır sayısı sınırı geçtiğinde rapor sessizce eksik toplam
 * gösterirdi — sayfa sayfa çekip tamamını alıyoruz (üst sınır 15.000).
 */
async function fetchAll<T = any>(
  build: (from: number, to: number) => any
): Promise<{ rows: T[]; error: string | null; capped: boolean }> {
  const size = 1000, maxPages = 15;
  const rows: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await build(p * size, p * size + size - 1);
    if (error) return { rows, error: error.message, capped: false };
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < size) return { rows, error: null, capped: false };
  }
  return { rows, error: null, capped: true };
}

/**
 * RAPORLAR
 *
 * Sunucu ham satırları bir kez çeker; dönem ve temsilci değişince
 * istemci aynı satırlardan yeniden hesaplar (lib/sales-metrics) —
 * her filtre değişiminde sunucuya gidilmez.
 *
 * Kapsamı RLS belirler: temsilci kendi verisini, müdür ekibini, admin
 * şirketi görür. Buradaki sorgularda ayrıca kişi filtresi yok.
 */
export default async function ReportsPage() {
  const { supabase, companyId, profile, managedDepartmentIds } = await getCtx();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const since = addDays(today, -WINDOW_DAYS);
  const none = Promise.resolve({ data: [] } as any);

  const [lines, visits, funnel, followUps, small] = await Promise.all([
    fetchAll((a, b) => supabase.from('v_order_lines')
      .select('order_id, order_no, status, order_date, created_by, outlet_id, outlet_name, channel, product_id, product_name, paid_cases, free_cases, case_price, list_case_price, line_total, free_value, is_verbal')
      .gte('order_date', since).order('order_date').order('line_id').range(a, b)),
    fetchAll((a, b) => supabase.from('visits')
      .select(`id, visit_date, outcome, status, user_id, outlet_id, visit_type, met_decision_authority,
               objection_stated_id, objection_real_id,
               outlets:outlet_id(name, potential_monthly_volume),
               visit_tastings(product_id, bottles_opened, bottles_left_sealed)`)
      .gte('visit_date', since).order('visit_date').order('id').range(a, b)),
    fetchAll((a, b) => supabase.from('v_outlet_funnel')
      .select('outlet_id, name, stage, assigned_user_id, order_count, order_total, first_order_at, last_order_at, days_since_order, cycle_days, district, city')
      .order('outlet_id').range(a, b)),
    fetchAll((a, b) => supabase.from('follow_ups')
      .select('id, status, due_date, owner_user_id, result, lost_reason_id, outlet_id, created_at, outlets:outlet_id(name, potential_monthly_volume)')
      .or(`status.eq.acik,created_at.gte.${since}`).order('created_at').order('id').range(a, b)),
    Promise.all([
      supabase.from('route_plans').select('plan_date, user_id, target_visits').gte('plan_date', since).limit(1000),
      companyId ? supabase.from('no_order_reasons').select('id, label').eq('company_id', companyId) : none,
      companyId ? supabase.from('profiles').select('id, full_name').eq('company_id', companyId).order('full_name') : none,
      // Silme kaydını yalnız admin ve müdür görür (RLS); temsilcide boş gelir.
      supabase.from('sales_deletions').select('id, entity, label, reason, deleted_at, deleted_by')
        .gte('deleted_at', since).order('deleted_at', { ascending: false }).limit(200),
      companyId
        ? supabase.from('price_lists').select('id, price_list_items(unit_price)')
            .eq('company_id', companyId).eq('is_active', true)
            .order('valid_from', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null } as any)
    ])
  ]);

  const [plans, reasons, people, deletions, priceList] = small;

  // Liste fiyatı (şişe): itiraz ağırlığı ve numune maliyeti bununla çarpılır.
  const listPrices = (((priceList as any)?.data?.price_list_items ?? []) as any[])
    .map(i => Number(i.unit_price)).filter(n => n > 0);
  const bottleListPrice = listPrices.length
    ? listPrices.reduce((a, b) => a + b, 0) / listPrices.length : 56;

  const loadError = [lines.error, visits.error, funnel.error, followUps.error].find(Boolean) ?? null;

  return (
    <SalesReports
      lines={lines.rows as any}
      visits={visits.rows as any}
      funnel={funnel.rows as any}
      followUps={followUps.rows as any}
      plans={(plans.data ?? []) as any}
      reasons={(reasons.data ?? []) as any}
      people={(people.data ?? []) as any}
      deletions={(deletions.data ?? []) as any}
      bottleListPrice={bottleListPrice}
      today={today}
      isManager={isSalesManager(profile.role, managedDepartmentIds)}
      loadError={loadError}
      capped={lines.capped || visits.capped}
    />
  );
}
