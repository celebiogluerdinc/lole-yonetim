import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import IncidentsClient from '@/components/IncidentsClient';

export const dynamic = 'force-dynamic';

// VERİ POLİTİKASI: olay kayıtları silinmez / gizlenmez — tamamı listelenir.
const PAGE_SIZE = 1000;

export default async function IncidentsPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  // RLS güvencesi: personel yalnızca KENDİ kaydını görür, aksiyon raporlarını göremez.
  const { data: rows } = await supabase
    .from('incidents')
    .select('*, reporter:reporter_id(full_name), approver:approved_by(full_name), departments:department_id(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  const ids = (rows ?? []).map((r: any) => r.id);
  let actions: any[] = [];
  if (isAdmin && ids.length) {
    const { data } = await supabase
      .from('incident_actions')
      .select('*, author:author_id(full_name)')
      .in('incident_id', ids)
      .order('created_at', { ascending: true })
      .limit(5000);
    actions = data ?? [];
  }

  const { data: depts } = await supabase
    .from('departments').select('id, name').eq('company_id', companyId).order('name');

  const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(iso));

  const actionsByInc: Record<string, any[]> = {};
  for (const a of actions) {
    (actionsByInc[a.incident_id] ??= []).push({
      id: a.id,
      body: a.body,
      author: a.author?.full_name ?? '—',
      authorId: a.author_id,
      date: fmt(a.created_at)
    });
  }

  const incidents = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    location: r.location,
    severity: r.severity,
    status: r.status,
    occurred: fmt(r.occurred_at),
    day: dayKey(r.occurred_at),
    created: fmt(r.created_at),
    reporter: r.reporter?.full_name ?? '—',
    reporterId: r.reporter_id,
    dept: r.departments?.name ?? null,
    approver: r.approver?.full_name ?? null,
    decisionNote: r.decision_note,
    actions: actionsByInc[r.id] ?? []
  }));

  return (
    <IncidentsClient
      incidents={incidents}
      departments={(depts ?? []) as any}
      meId={profile.id}
      isAdmin={isAdmin}
      isSuper={profile.role === 'super_admin'}
    />
  );
}
