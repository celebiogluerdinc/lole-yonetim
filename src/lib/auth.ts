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
  const { data: { user } } = await supabase.auth.getUser();
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

  let companyId: string | null = profile.company_id;
  if (profile.role === 'super_admin') {
    const c = cookies().get('active_company')?.value;
    companyId = c || null;
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
