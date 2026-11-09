import { getCtx } from '@/lib/auth';
import VisitsClient from '@/components/sales/VisitsClient';

export const dynamic = 'force-dynamic';

export default async function VisitsPage() {
  const { supabase } = await getCtx();

  // RLS zaten kapsamı belirliyor: temsilci kendi ziyaretlerini,
  // müdür ekibininkini, admin hepsini görür. Burada ek filtre gereksiz.
  const { data: visits } = await supabase.from('visits')
    .select('id, visit_date, outcome, overall_score, status, outlets:outlet_id(name, city, district), profiles:user_id(full_name)')
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  // Arama, süzme, çıktı ve silme istemcide: liste zaten burada,
  // her filtre için sunucuya gitmek gereksiz bir ağ turu olurdu.
  return <VisitsClient visits={(visits ?? []) as any} />;
}
