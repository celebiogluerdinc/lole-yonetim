import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import PaymentsClient from '@/components/PaymentsClient';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
  searchParams
}: { searchParams: { tab?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const tab = searchParams.tab === 'templates' ? 'templates' : 'requests';
  const isDecider = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;

  const [reqRes, tplRes, deptRes] = await Promise.all([
    supabase.from('payment_requests')
      .select('*, requester:requester_id(full_name), decider:decided_by(full_name), departments:department_id(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('payment_templates')
      .select('*, creator:created_by(full_name), departments:department_id(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name')
  ]);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric'
  });
  const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(iso));
  const amt = (n: number | null) => n == null ? null
    : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const requests = (reqRes.data ?? []).map((r: any) => ({
    id: r.id,
    workTitle: r.work_title,
    workDetail: r.work_detail,
    firm: r.firm_name,
    taxNo: r.tax_no,
    iban: r.iban,
    amount: amt(r.amount),
    note: r.note,
    status: r.status,
    date: fmt(r.created_at),
    day: dayKey(r.created_at),
    requester: r.requester?.full_name ?? '—',
    requesterId: r.requester_id,
    dept: r.departments?.name ?? null,
    decider: r.decider?.full_name ?? null,
    decisionNote: r.decision_note
  }));

  const templates = (tplRes.data ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    workTitle: t.work_title,
    workDetail: t.work_detail,
    firm: t.firm_name,
    taxNo: t.tax_no,
    iban: t.iban,
    amount: amt(t.amount),
    note: t.note,
    creator: t.creator?.full_name ?? '—',
    creatorId: t.created_by,
    dept: t.departments?.name ?? null,
    deptId: t.department_id
  }));

  return (
    <PaymentsClient
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
