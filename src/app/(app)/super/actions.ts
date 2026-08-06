'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';

export async function switchCompany(companyId: string) {
  const { profile } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) return { error: 'Yetkisiz.' };
  cookies().set('active_company', companyId, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect('/home');
}
