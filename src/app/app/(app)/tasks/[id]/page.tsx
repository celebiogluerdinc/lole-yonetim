import { notFound } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { fmtDate, TZ, STATUS_LABEL, STATUS_COLOR, PRIORITY_LABEL, PRIORITY_COLOR } from '@/lib/utils';
import TaskDetailClient from '@/components/TaskDetailClient';
import TaskEdit from '@/components/TaskEdit';
import TaskMessageButton from '@/components/TaskMessageButton';
import { Camera, Repeat, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TaskPage({ params }: { params: { id: string } }) {
  const { supabase, profile, managedDepartmentIds } = await getCtx();

  const { data: task } = await supabase.from('tasks').select('*').eq('id', params.id).maybeSingle();
  if (!task) notFound();

  const [{ data: items }, { data: attachments }, { data: notes }, { data: assignees }, { data: dept }, { data: creator }] =
    await Promise.all([
      supabase.from('checklist_items')
        .select('*, doneBy:done_by(full_name)')
        .eq('task_id', task.id).order('position'),
      supabase.from('attachments').select('*').eq('task_id', task.id).order('created_at'),
      supabase.from('notes').select('*, profiles:author_id(full_name)').eq('task_id', task.id).order('created_at'),
      supabase.from('task_assignees').select('user_id, profiles:user_id(full_name)').eq('task_id', task.id),
      task.department_id
        ? supabase.from('departments').select('name').eq('id', task.department_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      task.created_by
        ? supabase.from('profiles').select('id, full_name').eq('id', task.created_by).maybeSingle()
        : Promise.resolve({ data: null } as any)
    ]);

  // signed URLs for attachments (1 hour) — single bulk request
  const signed: Record<string, string> = {};
  if ((attachments ?? []).length) {
    const paths = (attachments ?? []).map((a: any) => a.storage_path);
    const { data: urls } = await supabase.storage.from('attachments').createSignedUrls(paths, 3600);
    (urls ?? []).forEach((u: any, i: number) => {
      if (u?.signedUrl) signed[(attachments as any)[i].id] = u.signedUrl;
    });
  }

  const isAssignee = (assignees ?? []).some((a: any) => a.user_id === profile.id);
  const canReview =
    profile.role === 'super_admin' ||
    profile.role === 'admin' ||
    (task.department_id && managedDepartmentIds.includes(task.department_id));

  // editor data (managers only): people list + due date in Istanbul local format
  const canEdit = !!canReview && !['completed', 'cancelled'].includes(task.status);
  let people: any[] = [];
  if (canEdit) {
    const { data } = await supabase.from('profiles')
      .select('id, full_name').eq('company_id', task.company_id)
      .eq('is_active', true).order('full_name');
    people = data ?? [];
  }
  const dueLocal = task.due_at
    ? new Date(task.due_at).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16).replace(' ', 'T')
    : '';

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{task.title}</h1>
            {task.description && <p className="text-sm text-[#B0B0B5] mt-1.5 whitespace-pre-wrap">{task.description}</p>}
          </div>
          <span className={`badge shrink-0 ${STATUS_COLOR[task.status as keyof typeof STATUS_COLOR]}`}>
            {STATUS_LABEL[task.status as keyof typeof STATUS_LABEL]}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
          <span className="text-[#8E8E93]">📅 {fmtDate(task.due_at)}</span>
          <span className={PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR]}>
            ⚑ {PRIORITY_LABEL[task.priority as keyof typeof PRIORITY_LABEL]}
          </span>
          {dept?.name && <span className="text-[#8E8E93]">🏷 {dept.name}</span>}
          {task.requires_photo && (
            <span className="text-amber-300 flex items-center gap-1"><Camera size={14} /> Fotoğraf zorunlu</span>
          )}
          {task.requires_approval && (
            <span className="text-blue-700 flex items-center gap-1"><ShieldCheck size={14} /> Yönetici onaylı</span>
          )}
          {task.recurrence_rule && (
            <span className="text-[#8E8E93] flex items-center gap-1"><Repeat size={14} /> Tekrarlı</span>
          )}
        </div>

        {(assignees ?? []).length > 0 && (
          <p className="text-xs text-[#AEAEB2] mt-3">
            Atanan: {(assignees ?? []).map((a: any) => a.profiles?.full_name).filter(Boolean).join(', ')}
            {creator?.full_name ? ` · Veren: ${creator.full_name}` : ''}
          </p>
        )}

        {/* görev katılımcılarıyla direkt mesajlaşma */}
        <div className="mt-3">
          <TaskMessageButton
            people={[
              ...(creator && creator.id !== profile.id
                ? [{ id: creator.id, name: creator.full_name ?? 'Görev sahibi', tag: 'Görevi veren' }]
                : []),
              ...(assignees ?? [])
                .filter((a: any) => a.user_id !== profile.id && a.user_id !== creator?.id)
                .map((a: any) => ({ id: a.user_id, name: a.profiles?.full_name ?? 'Personel', tag: 'Atanan' }))
            ]}
          />
        </div>

        {task.status === 'blocked' && task.blocked_reason && (
          <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-300">
            🚧 Engel: {task.blocked_reason}
          </div>
        )}
        {task.rejection_note && task.status === 'open' && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-300">
            ↩️ Reddedildi: {task.rejection_note}
          </div>
        )}
      </header>

      {canEdit && (
        <TaskEdit
          task={task}
          dueLocal={dueLocal}
          items={(items ?? []) as any}
          people={people}
          assigneeIds={(assignees ?? []).map((a: any) => a.user_id)}
        />
      )}

      <TaskDetailClient
        task={task}
        items={(items ?? []) as any}
        attachments={(attachments ?? []).map((a: any) => ({ ...a, url: signed[a.id] }))}
        notes={(notes ?? []) as any}
        isAssignee={isAssignee}
        canReview={!!canReview}
        meId={profile.id}
      />
    </main>
  );
}
