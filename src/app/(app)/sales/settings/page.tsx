import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import SalesSettings from '@/components/sales/SalesSettings';

export const dynamic = 'force-dynamic';

export default async function SalesSettingsPage() {
  const { supabase, profile, companyId } = await getCtx();

  // Menüyü gizlemek güvenlik değildir — adres elle yazılsa da engellenir.
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/sales');

  const [
    { data: products }, { data: priceList }, { data: steps },
    { data: departments }, { data: criteria }, { data: reasons },
    { data: targets }, { data: types }
  ] = await Promise.all([
    companyId
      ? supabase.from('products').select('id, name, taste_reference, sort_order')
          .eq('company_id', companyId).eq('is_active', true).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('price_lists')
          .select('id, version, valid_from, is_active, price_list_items(product_id, unit_price)')
          .eq('company_id', companyId).eq('is_active', true)
          .order('valid_from', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null } as any),
    companyId
      ? supabase.from('approval_steps')
          .select('id, step_code, label, open_to_all, department_id, sort_order')
          .eq('company_id', companyId).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('departments').select('id, name').eq('company_id', companyId).order('name')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('score_criteria')
          .select('id, label, grp, weight, applies_to, form_code, scale_min, scale_max, is_active, sort_order')
          .eq('company_id', companyId).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('no_order_reasons').select('id, label, is_active, sort_order')
          .eq('company_id', companyId).order('sort_order')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('sales_targets')
          .select('id, scope, scope_value, target_value')
          .eq('company_id', companyId).eq('metric', 'ziyaret').eq('period', 'gunluk')
      : Promise.resolve({ data: [] } as any),
    companyId
      ? supabase.from('outlet_types').select('id, name, channel, is_quick_pick, is_active')
          .eq('company_id', companyId).order('sort_order')
      : Promise.resolve({ data: [] } as any)
  ]);

  return (
    <SalesSettings
      products={(products ?? []) as any}
      priceList={priceList as any}
      steps={(steps ?? []) as any}
      departments={(departments ?? []) as any}
      criteria={(criteria ?? []) as any}
      reasons={(reasons ?? []) as any}
      targets={(targets ?? []) as any}
      types={(types ?? []) as any}
    />
  );
}
