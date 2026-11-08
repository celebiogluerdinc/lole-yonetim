import { getCtx } from '@/lib/auth';
import OutletsClient from '@/components/sales/OutletsClient';

export const dynamic = 'force-dynamic';

export default async function OutletsPage() {
  const { supabase, companyId } = await getCtx();

  const [{ data: outlets }, { data: types }] = await Promise.all([
    supabase.from('outlets')
      .select('id, name, code, city, district, status, segment, score_pct, last_visit_at, phone, type_id, tax_number')
      .eq('is_active', true)
      .order('last_visit_at', { ascending: false, nullsFirst: false })
      .limit(500),
    companyId
      ? supabase.from('outlet_types')
          .select('id, name, channel, is_quick_pick, sort_order')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any)
  ]);

  return <OutletsClient outlets={(outlets ?? []) as any} types={(types ?? []) as any} />;
}
