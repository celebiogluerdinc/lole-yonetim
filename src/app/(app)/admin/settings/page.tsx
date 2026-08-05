import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { fmtDate } from '@/lib/utils';
import SettingsForms from '@/components/SettingsForms';

export const dynamic = 'force-dynamic';

const ACTION_TR: Record<string, string> = {
  created: 'görev oluşturdu',
  completed: 'görevi tamamladı',
  submitted_for_review: 'görevi onaya gönderdi',
  approved: 'görevi onayladı',
  rejected: 'görevi reddetti',
  blocked: 'engel bildirdi',
  cancelled: 'görevi iptal etti',
  manager_completed: 'görevi bitirdi (yönetici)',
  uploaded: 'dosya yükledi',
  restored: 'yedek geri yükledi'
};

export default async function SettingsPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isSuper = profile.role === 'super_admin';

  const [{ data: appName }, companiesRes, { data: logs }] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'app_name').maybeSingle(),
    isSuper
      ? supabase.from('companies').select('id, name').eq('is_active', true).order('name')
      : supabase.from('companies').select('id, name').eq('id', companyId),
    supabase
      .from('activity_log')
      .select('id, action, entity_type, meta, created_at, profiles:actor_id(full_name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100)
  ]);

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Yönetim Paneli</h1>
        <p className="text-[14px] text-[#8E8E93]">Uygulama ayarları, olay kaydı ve veri yedekleme</p>
      </header>

      <SettingsForms
        isSuper={isSuper}
        appName={appName?.value ?? 'Lole Yönetim'}
        companies={(companiesRes?.data ?? []) as any}
      />

      {/* Olay Kaydı */}
      <section>
        <h2 className="section-title">Olay Kaydı (son 100 işlem)</h2>
        <div className="card divide-y divide-white/[0.08] overflow-hidden max-h-[480px] overflow-y-auto">
          {(logs ?? []).length === 0 && (
            <p className="p-8 text-center text-[14px] text-[#8E8E93]">Henüz kayıt yok.</p>
          )}
          {(logs ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 min-w-0">
                <p className="text-[14px] truncate">
                  <b>{l.profiles?.full_name ?? 'Sistem'}</b>{' '}
                  {ACTION_TR[l.action] ?? `${l.action} (${l.entity_type})`}
                  {l.meta?.title ? <span className="text-[#8E8E93]"> — {l.meta.title}</span> : null}
                  {l.meta?.reason ? <span className="text-[#8E8E93]"> — {l.meta.reason}</span> : null}
                  {l.meta?.file ? <span className="text-[#8E8E93]"> — {l.meta.file}</span> : null}
                </p>
              </span>
              <span className="text-[12px] text-[#8E8E93] shrink-0">{fmtDate(l.created_at)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
