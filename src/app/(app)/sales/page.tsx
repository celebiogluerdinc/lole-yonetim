import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import DayCockpit from '@/components/sales/DayCockpit';

export const dynamic = 'force-dynamic';

/**
 * "Bugün" sekmesi — saha temsilcisinin gün yönetimi.
 *
 * Veriyi burada topluyoruz; karar mantığı (saate göre birincil eylem,
 * kalan mesai, gecikmiş durak) istemci tarafında, çünkü saat ilerledikçe
 * ekranın söylediği şey değişiyor ve her dakika sunucuya gitmek gereksiz.
 */
export default async function SalesPanel() {
  const { supabase, profile, companyId } = await getCtx();

  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();

  // İlk render saatini sunucudan veriyoruz: istemci kendi saatiyle farklı
  // bir dakika hesaplarsa React hidrasyon uyuşmazlığı veriyor.
  const [hh, mm] = now.toLocaleTimeString('en-GB', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit'
  }).split(':').map(Number);
  const serverNowMin = (hh || 0) * 60 + (mm || 0);

  const { data: plan } = await supabase.from('route_plans')
    .select('id, plan_date, city, district, target_visits, closed_at')
    .eq('user_id', profile.id).eq('plan_date', today).maybeSingle();

  const [
    { data: stops }, { data: visits }, { data: followUps },
    { data: neglected }, { count: draftCount }, { count: outletCount }
  ] = await Promise.all([
    plan
      ? supabase.from('route_stops')
          .select('id, planned_time, outlet_id, outlet_label, purpose, status, result_note, position, outlets:outlet_id(id, name, district, segment)')
          .eq('route_plan_id', plan.id).order('position')
      : Promise.resolve({ data: [] } as any),
    supabase.from('visits')
      .select('id, outcome, overall_score, status, outlets:outlet_id(name)')
      .eq('visit_date', today).eq('user_id', profile.id).order('created_at'),
    supabase.from('follow_ups')
      .select('id, action, due_date, outlet_id, outlets:outlet_id(id, name)')
      .eq('status', 'acik').eq('owner_user_id', profile.id)
      .lte('due_date', today).order('due_date').limit(20),
    companyId
      ? supabase.from('outlets')
          .select('id, name, district, segment, last_visit_at')
          .eq('company_id', companyId).eq('is_active', true).in('segment', ['A', 'B'])
          .or(`last_visit_at.is.null,last_visit_at.lt.${since14}`)
          .order('last_visit_at', { ascending: true, nullsFirst: true })
          .limit(12)
      : Promise.resolve({ data: [] } as any),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('status', 'taslak'),
    companyId
      ? supabase.from('outlets').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('is_active', true)
      : Promise.resolve({ count: 0 } as any)
  ]);

  return (
    <DayCockpit
      today={today}
      serverNowMin={serverNowMin}
      plan={(plan ?? null) as any}
      stops={(stops ?? []) as any}
      visits={(visits ?? []) as any}
      followUps={(followUps ?? []) as any}
      neglected={(neglected ?? []) as any}
      draftCount={draftCount ?? 0}
      outletCount={outletCount ?? 0}
    />
  );
}
