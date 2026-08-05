'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  let email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  // username support: "ayşe.yılmaz" → "ayse.yilmaz@lole.app"
  // (same Turkish-character slugification used when the account was created)
  if (email && !email.includes('@')) {
    const slug = email
      .replace(/[ışğüçö]/g, c => (({ 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ç': 'c', 'ö': 'o' }) as any)[c] ?? c)
      .replace(/[^a-z0-9._-]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
    email = `${slug}@lole.app`;
  }
  const supabase = supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=1');
  redirect('/home');
}

export async function logout() {
  const supabase = supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
