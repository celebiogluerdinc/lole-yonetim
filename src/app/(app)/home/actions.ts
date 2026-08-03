'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

export async function addNote(formData: FormData) {
  const body = z.string().min(1).max(2000).parse(String(formData.get('body') ?? '').trim());
  const { supabase, profile, companyId } = await getCtx();
  await supabase.from('notes').insert({
    company_id: companyId ?? profile.company_id,
    author_id: profile.id,
    body
  });
  revalidatePath('/home');
}

export async function deleteNote(id: string) {
  const { supabase, profile } = await getCtx();
  await supabase.from('notes').delete().eq('id', id).eq('author_id', profile.id);
  revalidatePath('/home');
}
