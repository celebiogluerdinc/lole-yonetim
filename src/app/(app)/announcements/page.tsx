import { getCtx } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fmtDate } from '@/lib/utils';
import AnnouncementComposer from '@/components/AnnouncementComposer';
import AnnouncementActions from '@/components/AnnouncementActions';
import AnnouncementComments, { type AnnComment } from '@/components/AnnouncementComments';
import MarkRead from '@/components/MarkRead';
import { Pin } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const canPost = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;

  const [{ data: anns }, { data: myReads }, { data: depts }, { data: allComments }] = await Promise.all([
    supabase.from('announcements').select('*, profiles:author_id(full_name)')
      .eq('company_id', companyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('announcement_reads').select('announcement_id').eq('user_id', profile.id),
    supabase.from('departments').select('id, name').eq('company_id', companyId),
    supabase.from('announcement_comments')
      .select('*, profiles:author_id(full_name)')
      .eq('company_id', companyId)
      .order('created_at')
      .limit(500)
  ]);

  const commentsByAnn: Record<string, AnnComment[]> = {};
  for (const c of allComments ?? []) (commentsByAnn[c.announcement_id] ??= []).push(c as any);

  const readSet = new Set((myReads ?? []).map((r: any) => r.announcement_id));
  const deptName: Record<string, string> = {};
  for (const d of depts ?? []) deptName[d.id] = d.name;

  // read counts for authors/admins
  let readCounts: Record<string, number> = {};
  if (canPost && (anns ?? []).length) {
    const { data: allReads } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .in('announcement_id', (anns ?? []).map(a => a.id));
    for (const r of allReads ?? []) readCounts[r.announcement_id] = (readCounts[r.announcement_id] ?? 0) + 1;
  }

  const unreadIds = (anns ?? []).filter(a => !readSet.has(a.id)).map(a => a.id);

  const postableDepts = ['super_admin', 'admin'].includes(profile.role)
    ? (depts ?? [])
    : (depts ?? []).filter(d => managedDepartmentIds.includes(d.id));

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-6">📌 Pano &amp; Duyurular</h1>

      <MarkRead ids={unreadIds} />

      {canPost && (
        <AnnouncementComposer
          departments={postableDepts as any}
          companyWide={['super_admin', 'admin'].includes(profile.role)}
          aiAvailable={!!process.env.ANTHROPIC_API_KEY}
        />
      )}

      <div className="space-y-4 mt-6">
        {(anns ?? []).length === 0 && (
          <div className="card p-10 text-center text-sm text-[#8E8E93]">Henüz duyuru yok.</div>
        )}
        {(anns ?? []).map(a => (
          <article key={a.id} className={`card p-5 ${a.is_pinned ? 'border-brand-500/30 bg-brand-500/10' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold flex items-center gap-2">
                {a.is_pinned && <Pin size={15} className="text-brand-500" />}
                {a.title}
              </h2>
              <span className="flex items-center gap-2 shrink-0">
                {!readSet.has(a.id) && (
                  <span className="badge bg-brand-100 text-brand-700">Yeni</span>
                )}
                {(['super_admin', 'admin'].includes(profile.role) ||
                  (a.department_id && managedDepartmentIds.includes(a.department_id))) && (
                  <AnnouncementActions id={a.id} pinned={a.is_pinned} />
                )}
              </span>
            </div>
            <p className="text-sm text-[#B0B0B5] mt-2 whitespace-pre-wrap">{a.body}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-[#AEAEB2]">
              <span>{a.profiles?.full_name ?? 'Yönetim'}</span>
              <span>·</span>
              <span>{fmtDate(a.created_at)}</span>
              <span>·</span>
              <span>{a.department_id ? `📍 ${deptName[a.department_id] ?? 'Departman'}` : '🏢 Tüm şirket'}</span>
              {canPost && (
                <>
                  <span>·</span>
                  <span>👁 {readCounts[a.id] ?? 0} kişi okudu</span>
                </>
              )}
            </div>
            <AnnouncementComments
              annId={a.id}
              comments={commentsByAnn[a.id] ?? []}
              meId={profile.id}
              isAdmin={['super_admin', 'admin'].includes(profile.role)}
            />
          </article>
        ))}
      </div>
    </main>
  );
}
