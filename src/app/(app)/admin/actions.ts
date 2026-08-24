'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { chunkedIn } from '@/lib/db';

/** Returns a Turkish error string when the caller is not an admin, else null. */
function requireAdmin(role: string): string | null {
  return ['super_admin', 'admin'].includes(role) ? null : 'Bu işlem için yönetici yetkisi gerekir.';
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
    manager_departments: z.array(z.string().uuid()).default([]),
    // Lole Sipariş Hattı: müşteri hesabı mı?
    is_customer: z.boolean().default(false),
    customer_name: z.string().max(150).optional().default('')
  });
  const parsed = schema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    identifier: String(formData.get('identifier') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    role: String(formData.get('role') ?? 'staff'),
    company_id: String(formData.get('company_id') ?? '') || null,
    departments: formData.getAll('departments').map(String),
    manager_departments: formData.getAll('manager_departments').map(String),
    is_customer: formData.get('is_customer') === 'on',
    customer_name: String(formData.get('customer_name') ?? '').trim()
  });
  if (!parsed.success) return { error: 'Ad, kullanıcı adı ve en az 8 karakterli parola gerekli.' };
  const input = parsed.data;

  const email = usernameToEmail(input.identifier);
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: 'Geçersiz kullanıcı adı. Harf, rakam, nokta ve tire kullanın.' };
  }

  const { profile, companyId: actingCompany } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };

  // güvenlik zinciri: YENİ admin hesabını yalnızca Süper Admin oluşturabilir
  if (input.role === 'admin' && profile.role !== 'super_admin') {
    return { error: 'Yeni Admin hesabını yalnızca Süper Admin oluşturabilir. Müdür veya Personel ekleyebilirsiniz.' };
  }

  // admin ve süper admin İSTEDİĞİ şirkete kullanıcı ekleyebilir
  const companyId = ['super_admin', 'admin'].includes(profile.role)
    ? (input.company_id ?? actingCompany)
    : actingCompany;
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const admin = supabaseAdmin();

  // ---- MÜŞTERİ HESABI DOĞRULAMASI (Lole Sipariş Hattı) ----
  const { data: targetCompany } = await admin
    .from('companies').select('id, kind').eq('id', companyId).maybeSingle();
  const isOrderLineCompany = (targetCompany as any)?.kind === 'order_line';
  if (input.is_customer && !isOrderLineCompany) {
    return { error: 'Müşteri hesabı yalnızca bir Sipariş Hattı şirketinde açılabilir.' };
  }
  // müşteri hesabı daima personel yetkisindedir (yönetim yetkisi alamaz)
  const effectiveRole = input.is_customer ? 'staff' : input.role;

  // Sipariş hattında siparişleri YALNIZCA yönetici ve müdürler görür.
  // Yetkisiz "personel" hesabı açmak anlamsızdır — sipariş sorumlusu müdür rolündedir.
  if (!input.is_customer && isOrderLineCompany && !['admin', 'manager'].includes(effectiveRole)) {
    return { error: 'Sipariş hattında personel hesabı açılamaz. Sipariş Sorumlusu (Müdür) veya Admin seçin — siparişleri yalnızca bu hesaplar görebilir.' };
  }

  // sipariş hattında ilk hesap müşteri olamaz: siparişleri karşılayacak
  // en az bir sorumlu (müdür ya da admin) bulunmalı, aksi halde bildirim kimseye gitmez
  if (input.is_customer && isOrderLineCompany) {
    const { count: staffCount } = await admin.from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('is_customer', false)
      .in('role', ['admin', 'manager']);
    if (!staffCount) {
      return { error: 'Önce bu sipariş hattına en az bir Sipariş Sorumlusu (Müdür) hesabı açın. Aksi halde siparişleri kimse göremez.' };
    }
  }

  // guard: only departments of the target company are honored
  const { data: validDepts } = await admin
    .from('departments').select('id').eq('company_id', companyId);
  const valid = new Set((validDepts ?? []).map((d: any) => d.id));

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, role: effectiveRole, company_id: companyId }
  });
  if (error) {
    const msg = String(error.message).includes('already been registered')
      ? 'Bu kullanıcı adı/e-posta zaten kayıtlı.'
      : error.message;
    return { error: `Kullanıcı oluşturulamadı: ${msg}` };
  }

  await admin.from('profiles').update({
    full_name: input.full_name, role: effectiveRole, company_id: companyId, email,
    is_customer: input.is_customer,
    customer_name: input.is_customer ? (input.customer_name || input.full_name) : null
  }).eq('id', data.user.id);

  const memberships = new Map<string, boolean>();
  // müşteri hesabı hiçbir departmana eklenmez
  if (!input.is_customer) {
    for (const d of input.departments) if (valid.has(d)) memberships.set(d, false);
    for (const d of input.manager_departments) if (valid.has(d)) memberships.set(d, true);
  }
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

/**
 * Admin edits an existing user: name, role, departments and (optionally) sets a NEW password.
 * Existing passwords can never be displayed — they are stored irreversibly hashed.
 */
export async function updateUser(formData: FormData) {
  const schema = z.object({
    user_id: z.string().uuid(),
    full_name: z.string().min(2).max(120),
    role: z.enum(['super_admin', 'admin', 'manager', 'staff']),
    new_password: z.string().max(72).optional().default(''),
    leave_allowance: z.coerce.number().min(0).max(90).default(14),
    departments: z.array(z.string().uuid()).default([]),
    manager_departments: z.array(z.string().uuid()).default([]),
    is_customer: z.boolean().default(false),
    customer_name: z.string().max(150).optional().default('')
  });
  const parsed = schema.safeParse({
    user_id: String(formData.get('user_id') ?? ''),
    full_name: String(formData.get('full_name') ?? '').trim(),
    role: String(formData.get('role') ?? 'staff'),
    new_password: String(formData.get('new_password') ?? '').trim(),
    leave_allowance: formData.get('leave_allowance') || 14,
    departments: formData.getAll('departments').map(String),
    manager_departments: formData.getAll('manager_departments').map(String),
    is_customer: formData.get('is_customer') === 'on',
    customer_name: String(formData.get('customer_name') ?? '').trim()
  });
  if (!parsed.success) return { error: 'Ad en az 2 karakter olmalı.' };
  const input = parsed.data;
  if (input.new_password && input.new_password.length < 8) {
    return { error: 'Yeni parola en az 8 karakter olmalı.' };
  }

  const { profile, companyId } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };

  const admin = supabaseAdmin();
  const { data: target } = await admin
    .from('profiles').select('id, company_id, role').eq('id', input.user_id).maybeSingle();
  if (!target) return { error: 'Kullanıcı bulunamadı.' };
  if (profile.role !== 'super_admin' && target.company_id !== companyId) {
    return { error: 'Bu kullanıcı sizin şirketinizde değil.' };
  }
  // Süper Admin yetkisi yalnızca süper adminler tarafından verilebilir/alınabilir
  if (profile.role !== 'super_admin' && (input.role === 'super_admin' || target.role === 'super_admin')) {
    return { error: 'Süper Admin yetkisini yalnızca bir Süper Admin değiştirebilir.' };
  }
  // Admin yetkisi verme/alma da yalnızca Süper Admin'e aittir (yetki zinciri koruması)
  if (profile.role !== 'super_admin' && input.role !== target.role &&
      (input.role === 'admin' || target.role === 'admin')) {
    return { error: 'Admin yetkisini yalnızca Süper Admin verebilir veya alabilir.' };
  }
  // ---- MÜŞTERİ HESABI (Lole Sipariş Hattı) ----
  const { data: targetCompany } = await admin
    .from('companies').select('kind').eq('id', target.company_id ?? '').maybeSingle();
  const isOrderLineCompany = (targetCompany as any)?.kind === 'order_line';
  if (input.is_customer && !isOrderLineCompany) {
    return { error: 'Müşteri hesabı yalnızca bir Sipariş Hattı şirketinde olabilir.' };
  }

  // kendi rolünü düşürmesin
  let roleToSet = input.user_id === profile.id ? target.role : input.role;
  // müşteri hesabına asla yönetim yetkisi verilemez
  if (input.is_customer) roleToSet = 'staff';

  const ops: any[] = [
    admin.from('profiles').update({
      full_name: input.full_name, role: roleToSet, leave_allowance: input.leave_allowance,
      is_customer: input.is_customer,
      customer_name: input.is_customer ? (input.customer_name || input.full_name) : null,
      customer_account_id: input.is_customer ? undefined : null
    }).eq('id', input.user_id)
  ];
  if (input.new_password) {
    ops.push(admin.auth.admin.updateUserById(input.user_id, { password: input.new_password }));
  }
  const results = await Promise.all(ops);
  const failed = results.find((r: any) => r?.error);
  if (failed?.error) return { error: failed.error.message };

  // departman üyeliklerini yeniden kur (yalnızca hedef şirketin departmanları)
  const { data: validDepts } = await admin
    .from('departments').select('id').eq('company_id', target.company_id);
  const valid = new Set((validDepts ?? []).map((d: any) => d.id));

  await admin.from('department_members')
    .delete().eq('user_id', input.user_id)
    .in('department_id', Array.from(valid));

  const memberships = new Map<string, boolean>();
  // müşteri hesabı hiçbir departmana üye olamaz
  if (!input.is_customer) {
    for (const d of input.departments) if (valid.has(d)) memberships.set(d, false);
    for (const d of input.manager_departments) if (valid.has(d)) memberships.set(d, true);
  }
  if (memberships.size) {
    await admin.from('department_members').insert(
      Array.from(memberships.entries()).map(([department_id, is_manager]) => ({
        department_id, user_id: input.user_id, is_manager
      }))
    );
  }

  revalidatePath('/admin/users');
  return { ok: true, password_changed: !!input.new_password };
}

export async function toggleUserActive(userId: string, active: boolean) {
  if (!z.string().uuid().safeParse(userId).success) return { error: 'Geçersiz kullanıcı.' };
  const { profile, companyId } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };
  if (userId === profile.id) return { error: 'Kendi hesabınızı pasifleştiremezsiniz.' };

  const admin = supabaseAdmin();
  const { data: target } = await admin
    .from('profiles').select('company_id').eq('id', userId).maybeSingle();
  if (!target) return { error: 'Kullanıcı bulunamadı.' };
  if (profile.role !== 'super_admin' && target.company_id !== companyId) {
    return { error: 'Bu kullanıcı sizin şirketinizde değil.' };
  }

  const { error } = await admin.from('profiles').update({ is_active: active }).eq('id', userId);
  if (error) return { error: error.message };
  // block/unblock sign-in too — deactivation must actually lock the account
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876000h'
  } as any).catch(() => {});

  revalidatePath('/admin/users');
  return { ok: true };
}

/** Rename a department — admin of the company (or super admin). */
export async function renameDepartment(formData: FormData) {
  const schema = z.object({ department_id: z.string().uuid(), name: z.string().min(2).max(100) });
  const parsed = schema.safeParse({
    department_id: String(formData.get('department_id') ?? ''),
    name: String(formData.get('name') ?? '').trim()
  });
  if (!parsed.success) return { error: 'Departman adı en az 2 karakter olmalı.' };

  const { supabase, profile, companyId } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { error } = await supabase.from('departments')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.department_id)
    .eq('company_id', companyId);
  if (error) return { error: error.message };
  revalidatePath('/admin/departments');
  return { ok: true };
}

export async function createDepartment(formData: FormData) {
  const name = z.string().min(2).max(100).safeParse(String(formData.get('name') ?? '').trim());
  if (!name.success) return { error: 'Departman adı gerekli.' };

  const { supabase, profile, companyId } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { error } = await supabase.from('departments').insert({
    company_id: companyId, name: name.data
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/departments');
  return { ok: true };
}

/** Rename a company — admin (own) or super admin (any). */
export async function renameCompany(formData: FormData) {
  const schema = z.object({ company_id: z.string().uuid(), name: z.string().min(2).max(120) });
  const parsed = schema.safeParse({
    company_id: String(formData.get('company_id') ?? ''),
    name: String(formData.get('name') ?? '').trim()
  });
  if (!parsed.success) return { error: 'Şirket adı en az 2 karakter olmalı.' };

  const { supabase, profile, companyId } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };
  if (profile.role !== 'super_admin' && parsed.data.company_id !== companyId) {
    return { error: 'Yalnızca kendi şirketinizin adını değiştirebilirsiniz.' };
  }
  const { error } = await supabase.from('companies')
    .update({ name: parsed.data.name }).eq('id', parsed.data.company_id);
  if (error) return { error: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Super admin sets the platform brand name shown across the app. */
export async function setAppName(formData: FormData) {
  const name = z.string().min(2).max(60).safeParse(String(formData.get('app_name') ?? '').trim());
  if (!name.success) return { error: 'Uygulama adı en az 2 karakter olmalı.' };

  const { supabase, profile } = await getCtx();
  if (profile.role !== 'super_admin') return { error: 'Yalnızca süper admin uygulama adını değiştirebilir.' };

  const { error } = await supabase.from('app_settings')
    .upsert({ key: 'app_name', value: name.data, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return { ok: true };
}

/** Restore a JSON backup into the ACTIVE company (upsert by id). Photos/files are not included. */
export async function restoreBackup(formData: FormData) {
  const { profile, companyId } = await getCtx();
  const authErr = requireAdmin(profile.role);
  if (authErr) return { error: authErr };
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const file = formData.get('file') as File | null;
  if (!file) return { error: 'Yedek dosyası seçilmedi.' };
  if (file.size > 15 * 1024 * 1024) return { error: 'Yedek dosyası 15MB sınırını aşıyor.' };

  let payload: any;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return { error: 'Dosya okunamadı — geçerli bir yedek JSON dosyası seçin.' };
  }
  if (payload?.meta?.company_id !== companyId) {
    return { error: 'Bu yedek başka bir şirkete ait. Önce o şirkete geçin (Şirketler sayfası).' };
  }

  const admin = supabaseAdmin();
  const counts: Record<string, number> = {};

  // Child tables have no company_id — restrict them to parents that belong to
  // this company (from the backup itself or already in the database).
  const ownRows = (rows: any) => (Array.isArray(rows) ? rows : [])
    .filter((r: any) => r && typeof r === 'object' && r.company_id === companyId);
  const [{ data: dbTpls }, { data: dbTasks }] = await Promise.all([
    admin.from('templates').select('id').eq('company_id', companyId),
    admin.from('tasks').select('id').eq('company_id', companyId)
  ]);
  const tplIds = new Set<string>([
    ...ownRows(payload.templates).map((r: any) => r.id),
    ...(dbTpls ?? []).map((r: any) => r.id)
  ]);
  const taskIds = new Set<string>([
    ...ownRows(payload.tasks).map((r: any) => r.id),
    ...(dbTasks ?? []).map((r: any) => r.id)
  ]);

  // parent → child order; rows are upserted by primary key (id)
  const order: [string, any[]][] = [
    ['departments', ownRows(payload.departments)],
    ['templates', ownRows(payload.templates)],
    ['template_items', (Array.isArray(payload.template_items) ? payload.template_items : [])
      .filter((r: any) => r && tplIds.has(r.template_id))],
    ['tasks', ownRows(payload.tasks)],
    ['task_assignees', (Array.isArray(payload.task_assignees) ? payload.task_assignees : [])
      .filter((r: any) => r && taskIds.has(r.task_id))],
    ['checklist_items', (Array.isArray(payload.checklist_items) ? payload.checklist_items : [])
      .filter((r: any) => r && taskIds.has(r.task_id))],
    ['announcements', ownRows(payload.announcements)],
    ['notes', ownRows(payload.notes)],
    ['shifts', ownRows(payload.shifts)],
    ['leave_requests', ownRows(payload.leave_requests)],
    ['time_entries', ownRows(payload.time_entries)]
  ];

  for (const [table, rows] of order) {
    if (rows.length === 0) continue;
    // güvenlik: id çakışmasıyla BAŞKA şirketin mevcut kaydı ezilemesin
    let safe = rows.filter((r: any) => typeof r.id === 'string');
    if (safe.length && ['departments', 'templates', 'tasks', 'announcements', 'notes', 'shifts', 'leave_requests', 'time_entries'].includes(table)) {
      const ids = safe.map((r: any) => r.id);
      const foreign = new Set<string>();
      // 500'lük listeler adres satırını taşırıyordu → parçalı sorgu
      const clash = await chunkedIn<any>(
        chunk => admin.from(table).select('id').in('id', chunk).neq('company_id', companyId),
        ids
      );
      for (const c of clash) foreign.add(c.id);
      safe = safe.filter((r: any) => !foreign.has(r.id));
    }
    for (let i = 0; i < safe.length; i += 500) {
      const chunk = safe.slice(i, i + 500);
      const { error } = await admin.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) return { error: `${table} geri yüklenirken hata: ${error.message}` };
    }
    counts[table] = safe.length;
  }

  await admin.from('activity_log').insert({
    company_id: companyId, actor_id: profile.id, entity_type: 'backup',
    action: 'restored', meta: counts
  });

  revalidatePath('/admin/settings');
  return { ok: true, counts };
}

/** Super admin creates a new company (preset departments auto-created by trigger). */
export async function createCompany(formData: FormData) {
  const schema = z.object({
    name: z.string().min(2).max(120),
    accent_color: z.string().optional().default('#ff5a1f'),
    // 'order_line' = Lole Sipariş Hattı (müşteri paneli)
    kind: z.enum(['internal', 'order_line']).default('internal')
  });
  const parsed = schema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    accent_color: String(formData.get('accent_color') ?? '#ff5a1f'),
    kind: String(formData.get('kind') ?? 'internal')
  });
  if (!parsed.success) return { error: 'Şirket adı gerekli.' };

  const { supabase, profile } = await getCtx();
  if (profile.role !== 'super_admin') return { error: 'Yalnızca süper admin şirket ekleyebilir.' };

  const slug = parsed.data.name.toLowerCase()
    .replace(/[ışğüçö]/g, c => (({ 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ç': 'c', 'ö': 'o' }) as any)[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { error } = await supabase.from('companies').insert({
    name: parsed.data.name, slug, accent_color: parsed.data.accent_color,
    kind: parsed.data.kind
  });
  if (error) return { error: error.message };
  revalidatePath('/super/companies');
  revalidatePath('/', 'layout');
  return { ok: true, kind: parsed.data.kind };
}
