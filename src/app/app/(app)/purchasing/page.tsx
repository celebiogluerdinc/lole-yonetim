import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import PurchasingClient from '@/components/PurchasingClient';

export const dynamic = 'force-dynamic';

export default async function PurchasingPage({
  searchParams
}: { searchParams: { tab?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const tab = searchParams.tab === 'templates' ? 'templates' : 'requests';
  const isDecider = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;

  // kalemler embed ile tek istekte gelir (filtresiz ayrı sorgular kaldırıldı)
  const [reqRes, tplRes, deptRes] = await Promise.all([
    supabase.from('purchase_requests')
      .select('*, requester:requester_id(full_name), decider:decided_by(full_name), departments:department_id(name), purchase_items(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('purchase_templates')
      .select('*, creator:created_by(full_name), departments:department_id(name), purchase_template_items(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name')
  ]);

  const byPos = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);
  const itemsByReq: Record<string, any[]> = {};
  for (const r of reqRes.data ?? []) itemsByReq[r.id] = (r.purchase_items ?? []).sort(byPos);
  const itemsByTpl: Record<string, any[]> = {};
  for (const t of tplRes.data ?? []) itemsByTpl[t.id] = (t.purchase_template_items ?? []).sort(byPos);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric'
  });
  const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(iso));

  const requests = (reqRes.data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    note: r.note,
    status: r.status,
    date: fmt(r.created_at),
    day: dayKey(r.created_at),
    requester: r.requester?.full_name ?? '—',
    requesterId: r.requester_id,
    dept: r.departments?.name ?? null,
    decider: r.decider?.full_name ?? null,
    decisionNote: r.decision_note,
    items: (itemsByReq[r.id] ?? []).map((it: any) => ({
      product: it.product, quantity: it.quantity, unit: it.unit, brand: it.brand, spec: it.spec
    }))
  }));

  const templates = (tplRes.data ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    note: t.note,
    creator: t.creator?.full_name ?? '—',
    creatorId: t.created_by,
    dept: t.departments?.name ?? null,
    deptId: t.department_id,
    items: (itemsByTpl[t.id] ?? []).map((it: any) => ({
      product: it.product, quantity: it.quantity, unit: it.unit, brand: it.brand, spec: it.spec
    }))
  }));

  return (
    <PurchasingClient
      tab={tab}
      requests={requests}
      templates={templates}
      departments={(deptRes.data ?? []) as any}
      meId={profile.id}
      isAdmin={['super_admin', 'admin'].includes(profile.role)}
      isDecider={isDecider}
    />
  );
}
