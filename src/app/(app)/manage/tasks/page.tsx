import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import TaskBoard from '@/components/TaskBoard';

export const dynamic = 'force-dynamic';

/**
 * Manager command center: every task/checklist in scope, with status tracking.
 * RLS already scopes rows — admin sees the whole company, managers their
 * departments (+ their own assignments), staff are redirected away.
 */
export default async function TasksBoardPage({
  searchParams
}: { searchParams: { f?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  if (!isManager) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const [{ data: tasks }, { data: depts }] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        id, title, type, status, priority, due_at, completed_at, created_at,
        department_id, requires_photo, requires_approval, blocked_reason,
        checklist_items(is_done),
        task_assignees(profiles:user_id(full_name)),
        departments:department_id(name)
      `)
      .eq('company_id', companyId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(400),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name')
  ]);

  const rows = (tasks ?? []).map((t: any) => {
    const items: any[] = t.checklist_items ?? [];
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      due_at: t.due_at,
      department_id: t.department_id,
      department: t.departments?.name ?? null,
      assignees: (t.task_assignees ?? [])
        .map((a: any) => a.profiles?.full_name)
        .filter(Boolean),
      progress: items.length
        ? { done: items.filter((i: any) => i.is_done).length, total: items.length }
        : null,
      requires_photo: t.requires_photo,
      requires_approval: t.requires_approval,
      blocked_reason: t.blocked_reason
    };
  });

  return <TaskBoard rows={rows} departments={(depts ?? []) as any} initialFilter={searchParams.f} />;
}
