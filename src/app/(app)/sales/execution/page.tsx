import { getCtx } from '@/lib/auth';
import ExecutionClient from '@/components/sales/ExecutionClient';

export const dynamic = 'force-dynamic';

export default async function ExecutionPage({
  searchParams
}: { searchParams: { t?: string } }) {
  const { supabase, companyId } = await getCtx();
  const tab = searchParams.t === 'egitim' ? 'egitim' : 'acilis';

  const [{ data: openings }, { data: trainings }, { data: outlets }, { data: checkItems }, { data: people }] =
    await Promise.all([
      supabase.from('outlet_openings')
        .select('id, checked_at, result, outlets:outlet_id(id, name), profiles:checked_by(full_name)')
        .order('checked_at', { ascending: false }).limit(100),
      supabase.from('outlet_trainings')
        .select('id, trained_at, missing_topics, retrain_date, outlets:outlet_id(id, name), training_participants(passed)')
        .order('trained_at', { ascending: false }).limit(100),
      supabase.from('outlets')
        .select('id, name, city, district')
        .eq('is_active', true).in('status', ['aktif', 'aday']).order('name').limit(1000),
      companyId
        ? supabase.from('opening_check_items')
            .select('id, label, is_critical')
            .eq('company_id', companyId).eq('is_active', true).order('sort_order')
        : Promise.resolve({ data: [] } as any),
      companyId
        ? supabase.from('profiles').select('id, full_name')
            .eq('company_id', companyId).eq('is_active', true).order('full_name')
        : Promise.resolve({ data: [] } as any)
    ]);

  return (
    <ExecutionClient
      tab={tab}
      openings={(openings ?? []) as any}
      trainings={(trainings ?? []) as any}
      outlets={(outlets ?? []) as any}
      checkItems={(checkItems ?? []) as any}
      people={(people ?? []) as any}
    />
  );
}
