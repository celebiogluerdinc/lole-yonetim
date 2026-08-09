'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';

export async function switchCompany(companyId: string) {
  const { supabase, profile } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) return { error: 'Yetkisiz.' };
  // çerez değeri doğrulanır: gerçekten var olan bir şirket olmalı
  const { data: company } = await supabase
    .from('companies').select('id').eq('id', companyId).maybeSingle();
  if (!company) return { error: 'Şirket bulunamadı.' };
  cookies().set('active_company', company.id, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect('/home');
}
