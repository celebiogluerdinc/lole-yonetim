import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import FollowUpList from '@/components/sales/FollowUpList';

export const dynamic = 'force-dynamic';

export default async function FollowUpsPage() {
  const { supabase } = await getCtx();

  // Kapsamı RLS belirliyor: temsilci kendi takiplerini, müdür ekibininkini,
  // admin hepsini görür. Burada ek filtre gereksiz.
  const { data: rows } = await supabase.from('follow_ups')
    .select('id, action, due_date, status, source_type, closure_evidence, verified_at, outlet_id, outlets:outlet_id(id, name), profiles:owner_user_id(full_name)')
    .order('due_date')
    .limit(300);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  return <FollowUpList rows={(rows ?? []) as any} today={today} />;
}
