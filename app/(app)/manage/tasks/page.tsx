import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import TaskBoard from '@/components/TaskBoard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000; // PostgREST tek istekte en fazla bu kadar satır döndürür

/**
 * Manager command center: every task/checklist in scope, with status tracking.
 * RLS already scopes rows — admin sees the whole company, managers their
 * departments (+ their own assignments), staff are redirected away.
 *
 * VERİ POLİTİKASI: hiçbir görev kaydı gizlenmez veya silinmez.
 * • Aktif görevler HER ZAMAN tam olarak yüklenir (kesilmez).
 * • Kapanmış görevler en yeniden eskiye doğru yüklenir; sayfa dolarsa
 *   "Daha eskiyi yükle" ile veya tarih aralığı seçilerek geçmişin tamamına ulaşılır.
 */
export default async function TasksBoardPage({
  searchParams
}: { searchParams: { f?: string; from?: string; to?: string; sayfa?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  if (!isManager) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const SELECT = `
    id, title, type, status, priority, due_at, completed_at, created_at,
    department_id, requires_photo, requires_approval, blocked_reason,
    checklist_items(is_done),
    task_assignees(profiles:user_id(full_name)),
    departments:department_id(name)
  `;

  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = isDate(searchParams.from) ? searchParams.from! : null;
  const to = isDate(searchParams.to) ? searchParams.to! : null;
  // "sayfa": kapanmış görevlerde kaç sayfa geçmiş yüklensin (1 = son 1000 kayıt)
  const pages = Math.min(Math.max(Number(searchParams.sayfa ?? 1) || 1, 1), 10);

  // İstanbul gün sınırları (tarih aralığı filtresi için)
  const fromIso = from ? new Date(`${from}T00:00:00+03:00`).toISOString() : null;
  const toIso = to ? new Date(new Date(`${to}T00:00:00+03:00`).getTime() + 86400000).toISOString() : null;

  let tasks: any[] = [];
  let closedTotal = 0;
  let closedLoaded = 0;
  let depts: any[] | null = null;

  const deptQ = supabase.from('departments').select('id, name').eq('company_id', companyId).order('name');

  if (from || to) {
    // ---- TARİH ARALIĞI: o dönemin TÜM görevleri (aktif + kapanmış) ----
    let q = supabase.from('tasks').select(SELECT)
      .eq('company_id', companyId)
      .order('due_at', { ascending: false })
      .limit(PAGE_SIZE * pages);
    if (fromIso) q = q.gte('due_at', fromIso);
    if (toIso) q = q.lt('due_at', toIso);

    let cq = supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    if (fromIso) cq = cq.gte('due_at', fromIso);
    if (toIso) cq = cq.lt('due_at', toIso);

    const [res, countRes, deptRes] = await Promise.all([q, cq, deptQ]);
    tasks = res.data ?? [];
    closedTotal = countRes.count ?? tasks.length;
    closedLoaded = tasks.length;
    depts = deptRes.data;
  } else {
    // ---- VARSAYILAN: tüm aktifler + en yeni kapanmışlar ----
    const [activeRes, closedRes, closedCountRes, deptRes] = await Promise.all([
      supabase.from('tasks').select(SELECT)
        .eq('company_id', companyId)
        .not('status', 'in', '("completed","cancelled")')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(PAGE_SIZE),
      supabase.from('tasks').select(SELECT)
        .eq('company_id', companyId)
        .in('status', ['completed', 'cancelled'])
        .order('due_at', { ascending: false, nullsFirst: false })
        .limit(PAGE_SIZE * pages),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('status', ['completed', 'cancelled']),
      deptQ
    ]);
    tasks = [...(activeRes.data ?? []), ...(closedRes.data ?? [])];
    closedLoaded = (closedRes.data ?? []).length;
    closedTotal = closedCountRes.count ?? closedLoaded;
    depts = deptRes.data;
  }

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
      blocked_reason: t.blocked_reason,
      completed_at: t.completed_at ?? null
    };
  });

  return (
    <TaskBoard
      rows={rows}
      departments={(depts ?? []) as any}
      initialFilter={searchParams.f}
      from={from}
      to={to}
      pages={pages}
      hasMoreHistory={closedLoaded < closedTotal}
      historyTotal={closedTotal}
    />
  );
}
