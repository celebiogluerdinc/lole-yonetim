import { NextResponse } from 'next/server';
import { getCtx } from '@/lib/auth';
import { chunkedIn, selectAll } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Downloads a JSON backup of the ACTIVE company's operational data (files/photos excluded). */
export async function GET() {
  const { supabase, profile, companyId } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role) || !companyId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  // her tablo sayfa sayfa okunur — 1000 satır sınırı yüzünden yedek EKSİK çıkmasın
  const byCompany = (t: string) => selectAll<any>(() =>
    supabase.from(t).select('*').eq('company_id', companyId).order('id', { ascending: true }));

  const [
    { data: company }, departments, templates, tasks,
    announcements, notes, shifts,
    leave_requests, time_entries, people
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
    byCompany('departments'), byCompany('templates'), byCompany('tasks'),
    byCompany('announcements'), byCompany('notes'), byCompany('shifts'),
    byCompany('leave_requests'), byCompany('time_entries'),
    selectAll<any>(() => supabase.from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('company_id', companyId).order('id', { ascending: true }))
  ]);

  const templateIds = (templates ?? []).map((t: any) => t.id);
  const taskIds = (tasks ?? []).map((t: any) => t.id);

  // DİKKAT: görev sayısı yüzleri geçtiğinde tek istekte gönderilemez —
  // yedek sessizce EKSİK çıkardı. Parçalı + sayfalı okunur.
  const [template_items, task_assignees, checklist_items] = await Promise.all([
    chunkedIn<any>(ids => supabase.from('template_items').select('*').in('template_id', ids), templateIds),
    chunkedIn<any>(ids => supabase.from('task_assignees').select('*').in('task_id', ids), taskIds),
    chunkedIn<any>(ids => supabase.from('checklist_items').select('*').in('task_id', ids), taskIds)
  ]);

  const payload = {
    meta: {
      app: 'lole-yonetim',
      version: 1,
      company_id: companyId,
      company_name: company?.name ?? '',
      exported_at: new Date().toISOString(),
      note: 'Fotoğraf/dosya ekleri bu yedeğe dahil değildir (Supabase Storage içinde saklanır).'
    },
    company,
    users_reference: people, // bilgi amaçlı — geri yüklemede kullanılmaz (hesaplar auth sisteminde)
    departments, templates, template_items,
    tasks, task_assignees, checklist_items,
    announcements, notes, shifts, leave_requests, time_entries
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (company?.name ?? 'sirket').toLowerCase()
    .replace(/[ışğüçö]/g, (c: string) => (({ 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ç': 'c', 'ö': 'o' }) as any)[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-');

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lole-yedek-${slug}-${stamp}.json"`
    }
  });
}
