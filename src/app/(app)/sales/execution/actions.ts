'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

/**
 * F07 AÇILIŞ KONTROLÜ · F08 PERSONEL EĞİTİMİ
 */

const uuid = z.string().uuid();

async function salesCtx() {
  const ctx = await getCtx();
  if (ctx.isCustomer) throw new Error('Bu bölüme erişiminiz yok.');
  return ctx;
}

// ============================================================
// F07 — AÇILIŞ KONTROLÜ
// ============================================================

/**
 * Açılış kaydı.
 *
 * Kayıt her zaman 'eksik_var' olarak açılır, sonra istenen sonuca GÜNCELLENİR.
 * Sebebi teknik ama önemli: veritabanındaki koruma `before update of result`
 * tetikleyicisi. Doğrudan 'satisa_hazir' olarak INSERT edilseydi tetikleyici
 * hiç çalışmaz ve kritik kontroller atlanabilirdi. Bu sırayla veritabanı
 * her durumda son sözü söylüyor.
 */
export async function saveOpening(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const outletId = s('outlet_id');
  if (!uuid.safeParse(outletId).success) return { error: 'Nokta seçilmedi.' };

  const result = z.enum(['satisa_hazir', 'eksik_var', 'ertelendi'])
    .safeParse(s('result') || 'eksik_var');
  if (!result.success) return { error: 'Geçersiz sonuç.' };

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: items } = await supabase.from('opening_check_items')
    .select('id, label, is_critical')
    .eq('company_id', companyId).eq('is_active', true).order('sort_order');
  if (!items?.length) return { error: 'Açılış kontrol başlıkları tanımlı değil (Ayarlar).' };

  const { data: opening, error } = await supabase.from('outlet_openings').insert({
    company_id: companyId,
    outlet_id: outletId,
    delivery_doc_no: s('delivery_doc_no') || null,
    outlet_manager: s('outlet_manager') || null,
    shift: s('shift') || null,
    checked_by: profile.id,
    note: s('note') || null
  }).select('id').single();
  if (error) return { error: error.message };

  const rows = items.map((it: any) => {
    const ans = String(formData.get(`ans_${it.id}`) ?? '').trim();
    return {
      opening_id: opening.id,
      check_item_id: it.id,
      answer: ['evet', 'hayir', 'uygulanmaz'].includes(ans) ? ans : 'hayir',
      missing_note: String(formData.get(`miss_${it.id}`) ?? '').trim() || null,
      owner_user_id: String(formData.get(`owner_${it.id}`) ?? '') || null,
      due_date: String(formData.get(`due_${it.id}`) ?? '') || null
    };
  });
  const { error: e2 } = await supabase.from('outlet_opening_results').insert(rows);
  if (e2) return { error: `Kontroller kaydedilemedi: ${e2.message}` };

  if (result.data !== 'eksik_var') {
    const { error: e3 } = await supabase.from('outlet_openings')
      .update({ result: result.data }).eq('id', opening.id);
    if (e3) {
      // Tetikleyicinin mesajı kullanıcıya olduğu gibi gidiyor: hangi kuralın
      // engellediğini bilmesi, genel bir hata metninden daha faydalı.
      return { error: e3.message, id: opening.id };
    }
  }

  // Eksik kalan kritik kontroller için takip aç — kâğıtta "eksik / sorumlu / tarih"
  // sütunu vardı ama takibi kimse yapmıyordu.
  const follow = rows
    .filter(r => r.answer === 'hayir' && r.missing_note && r.owner_user_id && r.due_date)
    .map(r => ({
      company_id: companyId,
      source_type: 'opening',
      source_id: opening.id,
      outlet_id: outletId,
      action: `Açılış eksiği: ${items.find((i: any) => i.id === r.check_item_id)?.label ?? ''} — ${r.missing_note}`,
      owner_user_id: r.owner_user_id!,
      due_date: r.due_date!,
      created_by: profile.id
    }));
  if (follow.length) await supabase.from('follow_ups').insert(follow);

  revalidatePath('/sales/execution');
  revalidatePath(`/sales/outlets/${outletId}`);
  return { ok: true, id: opening.id as string };
}

// ============================================================
// F08 — PERSONEL EĞİTİMİ
// ============================================================

const CHECKS = ['chk_taste_match', 'chk_recommend', 'chk_label', 'chk_service', 'chk_report'] as const;

/**
 * Eğitim kaydı. Katılımcı başına beş kontrol; `passed` sütununu
 * veritabanı hesaplıyor (5/5 kuralı) — burada tekrar hesaplanmıyor ki
 * iki ayrı doğru ortaya çıkmasın.
 */
export async function saveTraining(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const outletId = s('outlet_id');
  if (!uuid.safeParse(outletId).success) return { error: 'Nokta seçilmedi.' };

  const names = formData.getAll('p_name').map(String).map(v => v.trim());
  if (!names.some(Boolean)) return { error: 'En az bir katılımcı girilmelidir.' };

  const { supabase, profile, companyId } = await salesCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const retrain = s('retrain_date');
  const { data: training, error } = await supabase.from('outlet_trainings').insert({
    company_id: companyId,
    outlet_id: outletId,
    trainer_id: profile.id,
    duration_min: Number(s('duration_min')) || 15,
    outlet_training_owner: s('outlet_training_owner') || null,
    missing_topics: s('missing_topics') || null,
    retrain_date: retrain || null,
    absent_shift: s('absent_shift') || null,
    materials_left: s('materials_left') || null,
    owner_accepted_by: s('owner_accepted_by') || null,
    owner_accepted_at: s('owner_accepted_by') ? new Date().toISOString() : null
  }).select('id').single();
  if (error) return { error: error.message };

  const roles = formData.getAll('p_role').map(String);
  const shifts = formData.getAll('p_shift').map(String);

  const rows = names.map((name, idx) => {
    const rec: any = {
      training_id: training.id,
      full_name: name,
      role: (roles[idx] ?? '').trim() || null,
      shift: (shifts[idx] ?? '').trim() || null,
      position: idx
    };
    for (const c of CHECKS) {
      rec[c] = String(formData.get(`${c}_${idx}`) ?? '') === 'gecti' ? 'gecti' : 'tekrar';
    }
    return rec;
  }).filter(r => r.full_name);

  const { error: e2 } = await supabase.from('training_participants').insert(rows);
  if (e2) return { error: `Katılımcılar kaydedilemedi: ${e2.message}` };

  // 5/5 alamayan varsa tekrar eğitim takibi aç
  const failing = rows.filter(r => CHECKS.some(c => r[c] !== 'gecti')).length;
  if (failing > 0 && retrain) {
    await supabase.from('follow_ups').insert({
      company_id: companyId,
      source_type: 'training',
      source_id: training.id,
      outlet_id: outletId,
      action: `Tekrar eğitim: ${failing} katılımcı 5/5 alamadı`,
      owner_user_id: profile.id,
      due_date: retrain,
      created_by: profile.id
    });
  }

  revalidatePath('/sales/execution');
  revalidatePath(`/sales/outlets/${outletId}`);
  return { ok: true, id: training.id as string, failing };
}
