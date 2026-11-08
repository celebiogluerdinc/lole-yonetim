'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

/**
 * Saha satış ayarları — yalnızca yönetici.
 * Fiyat listesi, onay adımları, puanlama kriterleri, itiraz nedenleri, hedefler.
 */

const uuid = z.string().uuid();

async function adminCtx() {
  const ctx = await getCtx();
  if (ctx.isCustomer) throw new Error('Bu bölüme erişiminiz yok.');
  if (!['super_admin', 'admin'].includes(ctx.profile.role)) {
    throw new Error('Bu ayarları yalnızca yönetici değiştirebilir.');
  }
  return ctx;
}

// ---------------- Fiyat listesi ----------------

export async function upsertPriceList(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const version = s('version');
  if (version.length < 3) return { error: 'Liste sürümü en az 3 karakter olmalı (örn. 2026-11).' };

  const { supabase, companyId } = await adminCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: list, error } = await supabase.from('price_lists')
    .upsert({
      company_id: companyId,
      version,
      valid_from: s('valid_from') || new Date().toISOString().slice(0, 10),
      is_active: true
    }, { onConflict: 'company_id,version' })
    .select('id').single();
  if (error) return { error: error.message };

  // ürün fiyatları: price_<productId>
  const { data: products } = await supabase.from('products')
    .select('id').eq('company_id', companyId).eq('is_active', true);

  const rows = (products ?? []).map((p: any) => {
    const raw = s(`price_${p.id}`);
    if (raw === '') return null;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) return null;
    return { price_list_id: list.id, product_id: p.id, unit_price: v };
  }).filter(Boolean) as any[];

  if (rows.length) {
    const { error: e2 } = await supabase.from('price_list_items')
      .upsert(rows, { onConflict: 'price_list_id,product_id' });
    if (e2) return { error: e2.message };
  }

  revalidatePath('/sales/settings');
  return { ok: true };
}

// ---------------- Onay adımları ----------------

export async function updateApprovalStep(formData: FormData) {
  const schema = z.object({
    step_id: uuid,
    open_to_all: z.boolean(),
    department_id: uuid.nullable().optional()
  });
  const parsed = schema.safeParse({
    step_id: String(formData.get('step_id') ?? ''),
    open_to_all: formData.get('open_to_all') === 'on',
    department_id: String(formData.get('department_id') ?? '') || null
  });
  if (!parsed.success) return { error: 'Geçersiz onay adımı.' };
  const i = parsed.data;

  if (!i.open_to_all && !i.department_id) {
    return { error: 'Adım tüm departmanlara kapalıysa bir departman seçilmelidir.' };
  }

  const { supabase } = await adminCtx();
  const { error } = await supabase.from('approval_steps').update({
    open_to_all: i.open_to_all,
    department_id: i.open_to_all ? null : i.department_id
  }).eq('id', i.step_id);
  if (error) return { error: error.message };

  revalidatePath('/sales/settings');
  return { ok: true };
}

// ---------------- Puanlama kriteri ----------------

export async function updateCriterion(formData: FormData) {
  const schema = z.object({
    criterion_id: uuid,
    weight: z.coerce.number().int().min(1).max(5),
    is_active: z.boolean()
  });
  const parsed = schema.safeParse({
    criterion_id: String(formData.get('criterion_id') ?? ''),
    weight: String(formData.get('weight') ?? '1'),
    is_active: formData.get('is_active') === 'on'
  });
  if (!parsed.success) return { error: 'Ağırlık 1–5 arasında olmalı.' };
  const i = parsed.data;

  const { supabase } = await adminCtx();
  const { error } = await supabase.from('score_criteria')
    .update({ weight: i.weight, is_active: i.is_active })
    .eq('id', i.criterion_id);
  if (error) return { error: error.message };

  revalidatePath('/sales/settings');
  return { ok: true };
}

// ---------------- Hedef ----------------

export async function upsertTarget(formData: FormData) {
  const schema = z.object({
    scope: z.enum(['varsayilan', 'sehir']),
    scope_value: z.string().max(80).optional().default(''),
    target_value: z.coerce.number().min(0).max(100)
  });
  const parsed = schema.safeParse({
    scope: (String(formData.get('scope') ?? 'varsayilan')) as any,
    scope_value: String(formData.get('scope_value') ?? '').trim(),
    target_value: String(formData.get('target_value') ?? '')
  });
  if (!parsed.success) return { error: 'Hedef 0–100 arasında olmalı.' };
  const i = parsed.data;
  if (i.scope === 'sehir' && !i.scope_value) return { error: 'Şehir adı girilmelidir.' };

  const { supabase, companyId } = await adminCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  // aynı kapsam için eskisini kapat, yenisini aç
  await supabase.from('sales_targets').delete()
    .eq('company_id', companyId).eq('metric', 'ziyaret').eq('period', 'gunluk')
    .eq('scope', i.scope)
    .filter('scope_value', i.scope === 'sehir' ? 'eq' : 'is', i.scope === 'sehir' ? i.scope_value : null);

  const { error } = await supabase.from('sales_targets').insert({
    company_id: companyId,
    scope: i.scope,
    scope_value: i.scope === 'sehir' ? i.scope_value : null,
    period: 'gunluk',
    metric: 'ziyaret',
    target_value: i.target_value
  });
  if (error) return { error: error.message };

  revalidatePath('/sales/settings');
  return { ok: true };
}

// ---------------- İtiraz nedeni ----------------

export async function addNoOrderReason(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (label.length < 3) return { error: 'Neden en az 3 karakter olmalı.' };

  const { supabase, companyId } = await adminCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const code = label.toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşöçı]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40);

  const { data: last } = await supabase.from('no_order_reasons')
    .select('sort_order').eq('company_id', companyId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();

  const { error } = await supabase.from('no_order_reasons').insert({
    company_id: companyId, code, label,
    requires_note: false,
    sort_order: (last?.sort_order ?? 0) + 10
  });
  if (error) return { error: error.message };

  revalidatePath('/sales/settings');
  return { ok: true };
}

export async function toggleNoOrderReason(id: string, active: boolean) {
  if (!uuid.safeParse(id).success) return { error: 'Geçersiz kayıt.' };
  const { supabase } = await adminCtx();
  const { error } = await supabase.from('no_order_reasons')
    .update({ is_active: active }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/sales/settings');
  return { ok: true };
}
