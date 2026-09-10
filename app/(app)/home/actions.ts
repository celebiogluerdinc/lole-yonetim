'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

export async function addNote(formData: FormData) {
  const parsed = z.string().min(1).max(2000).safeParse(String(formData.get('body') ?? '').trim());
  if (!parsed.success) return { error: 'Not boş olamaz (en fazla 2000 karakter).' };
  const { supabase, profile, companyId } = await getCtx();
  const { error } = await supabase.from('notes').insert({
    company_id: companyId ?? profile.company_id,
    author_id: profile.id,
    body: parsed.data
  });
  if (error) return { error: error.message };
  revalidatePath('/home');
  return { ok: true };
}

export async function deleteNote(id: string) {
  const { supabase, profile } = await getCtx();
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('author_id', profile.id);
  if (error) return { error: error.message };
  revalidatePath('/home');
  return { ok: true };
}
