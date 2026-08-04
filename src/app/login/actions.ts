'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  let email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  // username support: "ayse.yilmaz" → "ayse.yilmaz@lole.app"
  if (email && !email.includes('@')) email = `${email}@lole.app`;
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
