import { cache } from 'react';
import { supabaseServer } from './supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Profile } from './types';

export interface Ctx {
  supabase: ReturnType<typeof supabaseServer>;
  profile: Profile;
  /** company the user is acting in (super admin can switch via cookie) */
  companyId: string | null;
  isManagerAnywhere: boolean;
  managedDepartmentIds: string[];
}

/**
 * Loads the signed-in user's profile + acting company.
 * Wrapped in React cache() so layout + page share ONE lookup per request
 * instead of hitting the database twice.
 */
export const getCtx = cache(async (): Promise<Ctx> => {
  const supabase = supabaseServer();
  // Middleware already validated & refreshed the token with auth.getUser() on
  // this request — here we read the session locally from the cookie (no network
  // round-trip), which shaves a full auth call off every page render.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect('/login');

  // profile + managed departments in parallel (one round trip of latency, not two)
  const [{ data: profile }, { data: managed }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('department_members')
      .select('department_id')
      .eq('user_id', user.id)
      .eq('is_manager', true)
  ]);
  if (!profile) redirect('/login');
  if (profile.is_active === false) {
    // deactivated accounts lose access immediately
    await supabase.auth.signOut();
    redirect('/login?error=1');
  }

  let companyId: string | null = profile.company_id;
  if (profile.role === 'super_admin') {
    const c = cookies().get('active_company')?.value;
    companyId = c || null;
  } else if (profile.role === 'admin') {
    // adminler tam yetkili: şirketler arasında geçiş yapabilir,
    // seçim yoksa kendi şirketlerinde çalışırlar
    const c = cookies().get('active_company')?.value;
    companyId = c || profile.company_id;
  }

  const managedDepartmentIds = (managed ?? []).map((m: any) => m.department_id);

  return {
    supabase,
    profile: profile as Profile,
    companyId,
    isManagerAnywhere: managedDepartmentIds.length > 0,
    managedDepartmentIds
  };
});

export function canManage(p: Profile, managerAnywhere: boolean): boolean {
  return p.role === 'super_admin' || p.role === 'admin' || p.role === 'manager' || managerAnywhere;
}
