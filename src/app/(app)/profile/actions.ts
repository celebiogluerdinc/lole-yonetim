'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

/** User updates their own display name. */
export async function updateMyName(formData: FormData) {
  const name = z.string().min(2).max(120).safeParse(String(formData.get('full_name') ?? '').trim());
  if (!name.success) return { error: 'Ad Soyad en az 2 karakter olmalı.' };

  const { supabase, profile } = await getCtx();
  const { error } = await supabase.from('profiles')
    .update({ full_name: name.data }).eq('id', profile.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** User changes their OWN password (must know the current one). */
export async function changeMyPassword(formData: FormData) {
  const schema = z.object({
    current: z.string().min(1),
    next: z.string().min(8).max(72),
    next2: z.string().min(1)
  });
  const parsed = schema.safeParse({
    current: String(formData.get('current') ?? ''),
    next: String(formData.get('next') ?? ''),
    next2: String(formData.get('next2') ?? '')
  });
  if (!parsed.success) return { error: 'Yeni parola en az 8 karakter olmalı.' };
  const i = parsed.data;
  if (i.next !== i.next2) return { error: 'Yeni parolalar birbiriyle eşleşmiyor.' };
  if (i.next === i.current) return { error: 'Yeni parola mevcut parolayla aynı olamaz.' };

  const { supabase, profile } = await getCtx();

  // verify the current password before allowing the change
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: profile.email, password: i.current
  });
  if (authErr) return { error: 'Mevcut parolanız hatalı.' };

  const { error } = await supabase.auth.updateUser({ password: i.next });
  if (error) return { error: `Parola değiştirilemedi: ${error.message}` };
  return { ok: true };
}
