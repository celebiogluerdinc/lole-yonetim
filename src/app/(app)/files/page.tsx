import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import FilesClient from '@/components/FilesClient';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  const canUpload = isAdmin || managedDepartmentIds.length > 0;

  const [{ data: docs }, { data: depts }] = await Promise.all([
    supabase.from('documents')
      .select('*, uploader:uploaded_by(full_name), departments:department_id(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name')
  ]);

  // indirilebilir imzalı bağlantılar (1 saat) — tek toplu istek
  const signed: Record<string, string> = {};
  if (docs?.length) {
    const { data: urls } = await supabase.storage
      .from('attachments')
      .createSignedUrls(docs.map((d: any) => d.storage_path), 3600);
    (urls ?? []).forEach((u: any, i: number) => {
      if (u?.signedUrl) signed[docs[i].id] = u.signedUrl;
    });
  }

  const rows = (docs ?? []).map((d: any) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    fileName: d.file_name,
    mime: d.mime_type,
    url: signed[d.id] ?? null,
    dept: d.departments?.name ?? null,
    uploader: d.uploader?.full_name ?? '—',
    uploaderId: d.uploaded_by,
    validUntil: d.valid_until ?? null,
    date: new Date(d.created_at).toLocaleDateString('tr-TR', {
      timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric'
    })
  }));

  const manageableDepts = isAdmin
    ? (depts ?? [])
    : (depts ?? []).filter((d: any) => managedDepartmentIds.includes(d.id));

  return (
    <FilesClient
      docs={rows}
      departments={manageableDepts as any}
      canUpload={canUpload}
      isAdmin={isAdmin}
      meId={profile.id}
    />
  );
}
