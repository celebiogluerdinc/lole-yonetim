import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import RoutePlanner from '@/components/sales/RoutePlanner';

export const dynamic = 'force-dynamic';

export default async function RoutesPage({
  searchParams
}: { searchParams: { date?: string } }) {
  const { supabase, profile, companyId } = await getCtx();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '') ? searchParams.date! : today;

  const { data: plan } = await supabase.from('route_plans')
    .select('*').eq('user_id', profile.id).eq('plan_date', date).maybeSingle();

  const [{ data: stops }, { data: outlets }, { data: targets }, { data: lastPlan }] =
    await Promise.all([
      plan
        ? supabase.from('route_stops')
            .select('*, outlets:outlet_id(id, name, city, district)')
            .eq('route_plan_id', plan.id).order('position')
        : Promise.resolve({ data: [] } as any),
      supabase.from('outlets')
        .select('id, name, city, district, segment, last_visit_at')
        .eq('is_active', true).order('name').limit(1000),
      companyId
        ? supabase.from('sales_targets')
            .select('scope, scope_value, target_value')
            .eq('company_id', companyId).eq('period', 'gunluk').eq('metric', 'ziyaret')
        : Promise.resolve({ data: [] } as any),
      // Şehir ve ilçe elle yazılmasın: son rotadan devralınıyor.
      // Temsilci genelde aynı bölgede çalışıyor; her gün aynı şeyi
      // yazdırmak gereksiz bir adım.
      supabase.from('route_plans')
        .select('city, district').eq('user_id', profile.id)
        .lt('plan_date', date).not('city', 'is', null)
        .order('plan_date', { ascending: false }).limit(1).maybeSingle()
    ]);

  return (
    <RoutePlanner
      date={date}
      today={today}
      plan={(plan ?? null) as any}
      stops={(stops ?? []) as any}
      outlets={(outlets ?? []) as any}
      targets={(targets ?? []) as any}
      defaultCity={lastPlan?.city ?? null}
      defaultDistrict={lastPlan?.district ?? null}
    />
  );
}
