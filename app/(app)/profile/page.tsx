import { getCtx } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/utils';
import ProfileForms from '@/components/ProfileForms';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { supabase, profile, companyId } = await getCtx();

  const [{ data: company }, { data: myDepts }] = await Promise.all([
    companyId
      ? supabase.from('companies').select('name').eq('id', companyId).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from('department_members')
      .select('is_manager, departments:department_id(name)')
      .eq('user_id', profile.id)
  ]);

  const deptLabels = (myDepts ?? []).map((m: any) =>
    `${m.departments?.name ?? '—'}${m.is_manager ? ' (müdür)' : ''}`);

  return (
    <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Profilim</h1>
        <p className="text-[14px] text-[#8E8E93]">Hesap bilgileriniz ve parola değişikliği</p>
      </header>

      <section className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
          {(profile.full_name || profile.email)[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold truncate">{profile.full_name || '—'}</p>
          <p className="text-[13px] text-[#8E8E93] truncate">{profile.email}</p>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">
            {ROLE_LABEL[profile.role]}
            {company?.name ? ` · ${company.name}` : ''}
            {deptLabels.length ? ` · ${deptLabels.join(', ')}` : ''}
          </p>
        </div>
      </section>

      <ProfileForms currentName={profile.full_name ?? ''} />
    </main>
  );
}
