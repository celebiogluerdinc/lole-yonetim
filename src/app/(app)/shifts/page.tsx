import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import ShiftAdmin from '@/components/ShiftAdmin';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ShiftsPage({
  searchParams
}: { searchParams: { w?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const weekStart = searchParams.w ? mondayOf(new Date(searchParams.w)) : mondayOf(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const prev = iso(new Date(weekStart.getTime() - 7 * 86400000));
  const next = iso(new Date(weekStart.getTime() + 7 * 86400000));

  const [{ data: shifts }, { data: depts }, { data: people }, { data: memberships }] = await Promise.all([
    supabase.from('shifts')
      .select('*, profiles:user_id(full_name), departments:department_id(name)')
      .eq('company_id', companyId)
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString())
      .order('starts_at'),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name'),
    supabase.from('profiles').select('id, full_name').eq('company_id', companyId).eq('is_active', true).order('full_name'),
    supabase.from('department_members').select('department_id, user_id')
  ]);

  const manageableDepts = (depts ?? []).filter(d =>
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.includes(d.id));

  // group by day
  const byDay: Record<string, any[]> = {};
  for (const s of shifts ?? []) {
    const key = new Date(s.starts_at).toLocaleDateString('tr-TR', {
      timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long'
    });
    (byDay[key] ??= []).push(s);
  }

  const weekLabel = `${weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Vardiyalar</h1>
          <p className="text-[14px] text-[#8E8E93]">{isManager ? 'Ekip vardiya planı' : 'Vardiya programınız'}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/shifts?w=${prev}`} className="btn-ghost !px-2"><ChevronLeft size={18} /></Link>
          <span className="text-sm font-medium min-w-[110px] text-center">{weekLabel}</span>
          <Link href={`/shifts?w=${next}`} className="btn-ghost !px-2"><ChevronRight size={18} /></Link>
        </div>
      </header>

      {isManager && manageableDepts.length > 0 && (
        <ShiftAdmin
          departments={manageableDepts as any}
          people={(people ?? []) as any}
          memberships={(memberships ?? []) as any}
          defaultDate={iso(weekStart)}
        />
      )}

      {Object.keys(byDay).length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🗓</p>
          <p className="text-[15px] text-[#8E8E93]">Bu hafta için planlanmış vardiya yok.</p>
        </div>
      )}

      {Object.entries(byDay).map(([day, list]) => (
        <section key={day}>
          <h2 className="section-title capitalize">{day}</h2>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {list.map((s: any) => {
              const t = (x: string) => new Date(x).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
              const mine = s.user_id === profile.id;
              return (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${mine ? 'bg-ios-blue/[0.04]' : ''}`}>
                  <span className="text-[13px] font-semibold text-ios-blue w-24 shrink-0">
                    {t(s.starts_at)}–{t(s.ends_at)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">
                      {s.profiles?.full_name}{mine ? ' (siz)' : ''}
                    </p>
                    <p className="text-[12px] text-[#8E8E93] truncate">
                      {s.departments?.name}{s.note ? ` · ${s.note}` : ''}
                    </p>
                  </span>
                  {isManager && <ShiftAdmin.Delete id={s.id} />}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
