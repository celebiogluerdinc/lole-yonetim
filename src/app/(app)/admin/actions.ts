'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

function requireAdmin(role: string) {
  if (!['super_admin', 'admin'].includes(role)) throw new Error('Yetkisiz.');
}

/** Turkish-safe slug for usernames → login e-mail. */
function usernameToEmail(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.includes('@')) return t; // already an e-mail
  const slug = t
    .replace(/[ışğüçö]/g, c => (({ 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ç': 'c', 'ö': 'o' }) as any)[c] ?? c)
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return slug ? `${slug}@lole.app` : null;
}

/**
 * Admin creates a user (unlimited) directly from the panel:
 * username OR e-mail + password + role + (super admin: company) + departments.
 */
export async function createUser(formData: FormData) {
  const schema = z.object({
    full_name: z.string().min(2).max(120),
    identifier: z.string().min(2).max(120),
    password: z.string().min(8).max(72),
    role: z.enum(['admin', 'manager', 'staff']),
    company_id: z.string().uuid().optional().nullable(),
    departments: z.array(z.string().uuid()).default([]),
    manager_departments: z.array(z.string().uuid()).default([])
  });
  const parsed = schema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    identifier: String(formData.get('identifier') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    role: String(formData.get('role') ?? 'staff'),
    company_id: String(formData.get('company_id') ?? '') || null,
    departments: formData.getAll('departments').map(String),
    manager_departments: formData.getAll('manager_departments').map(String)
  });
  if (!parsed.success) return { error: 'Ad, kullanıcı adı ve en az 8 karakterli parola gerekli.' };
  const input = parsed.data;

  const email = usernameToEmail(input.identifier);
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: 'Geçersiz kullanıcı adı. Harf, rakam, nokta ve tire kullanın.' };
  }

  const { profile, companyId: actingCompany } = await getCtx();
  requireAdmin(profile.role);

  // super admin may create into ANY company; company admin only into their own
  const companyId = profile.role === 'super_admin'
    ? (input.company_id ?? actingCompany)
    : actingCompany;
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const admin = supabaseAdmin();

  // guard: only departments of the target company are honored
  const { data: validDepts } = await admin
    .from('departments').select('id').eq('company_id', companyId);
  const valid = new Set((validDepts ?? []).map((d: any) => d.id));

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, role: input.role, company_id: companyId }
  });
  if (error) {
    const msg = String(error.message).includes('already been registered')
      ? 'Bu kullanıcı adı/e-posta zaten kayıtlı.'
      : error.message;
    return { error: `Kullanıcı oluşturulamadı: ${msg}` };
  }

  await admin.from('profiles').update({
    full_name: input.full_name, role: input.role, company_id: companyId, email
  }).eq('id', data.user.id);

  const memberships = new Map<string, boolean>();
  for (const d of input.departments) if (valid.has(d)) memberships.set(d, false);
  for (const d of input.manager_departments) if (valid.has(d)) memberships.set(d, true);
  if (memberships.size) {
    await admin.from('department_members').upsert(
      Array.from(memberships.entries()).map(([department_id, is_manager]) => ({
        department_id, user_id: data.user.id, is_manager
      })),
      { onConflict: 'department_id,user_id' }
    );
  }

  revalidatePath('/admin/users');
  return { ok: true, login: email };
}

export async function toggleUserActive(userId: string, active: boolean) {
  const { supabase, profile } = await getCtx();
  requireAdmin(profile.role);
  await supabase.from('profiles').update({ is_active: active }).eq('id', userId);
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function createDepartment(formData: FormData) {
  const name = z.string().min(2).max(100).safeParse(String(formData.get('name') ?? '').trim());
  if (!name.success) return { error: 'Departman adı gerekli.' };

  const { supabase, profile, companyId } = await getCtx();
  requireAdmin(profile.role);
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { error } = await supabase.from('departments').insert({
    company_id: companyId, name: name.data
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/departments');
  return { ok: true };
}

/** Super admin creates a new company (preset departments auto-created by trigger). */
export async function createCompany(formData: FormData) {
  const schema = z.object({
    name: z.string().min(2).max(120),
    accent_color: z.string().optional().default('#ff5a1f')
  });
  const parsed = schema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    accent_color: String(formData.get('accent_color') ?? '#ff5a1f')
  });
  if (!parsed.success) return { error: 'Şirket adı gerekli.' };

  const { supabase, profile } = await getCtx();
  if (profile.role !== 'super_admin') return { error: 'Yalnızca süper admin şirket ekleyebilir.' };

  const slug = parsed.data.name.toLowerCase()
    .replace(/[ışğüçö]/g, c => (({ 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ç': 'c', 'ö': 'o' }) as any)[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { error } = await supabase.from('companies').insert({
    name: parsed.data.name, slug, accent_color: parsed.data.accent_color
  });
  if (error) return { error: error.message };
  revalidatePath('/super/companies');
  return { ok: true };
}
