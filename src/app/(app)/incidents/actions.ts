'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

const isAdmin = (role: string) => ['super_admin', 'admin'].includes(role);

/** Olay kayıtlarını yalnızca admin + süper yönetici görür → bildirim de onlara gider. */
async function notifyAdmins(
  supabase: any, companyId: string, exceptId: string,
  title: string, body: string, url: string
) {
  const [companyAdmins, supers] = await Promise.all([
    supabase.from('profiles').select('id').eq('company_id', companyId).eq('role', 'admin'),
    supabase.from('profiles').select('id').eq('role', 'super_admin')
  ]);
  const targets = new Set<string>([
    ...((companyAdmins.data ?? []) as any[]).map(a => a.id),
    ...((supers.data ?? []) as any[]).map(a => a.id)
  ]);
  targets.delete(exceptId);
  if (!targets.size) return;
  const ids = Array.from(targets);
  await supabase.from('notifications').insert(ids.map(user_id => ({
    company_id: companyId, user_id, type: 'custom', payload: { title, body, url }
  })));
  pushToUsers(ids, { title, body, url }).catch(() => {});
}

const IncidentSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(5).max(5000),
  location: z.string().max(200).optional().default(''),
  occurred_at: z.string().max(30).optional().default(''),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  department_id: z.string().uuid().optional().nullable()
});

/** Herkes olay kaydı oluşturabilir. */
export async function createIncident(formData: FormData) {
  const parsed = IncidentSchema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    location: String(formData.get('location') ?? '').trim(),
    occurred_at: String(formData.get('occurred_at') ?? '').trim(),
    severity: String(formData.get('severity') ?? 'medium'),
    department_id: String(formData.get('department_id') ?? '') || null
  });
  if (!parsed.success) {
    return { error: 'Başlık en az 3, olay açıklaması en az 5 karakter olmalıdır.' };
  }
  const i = parsed.data;

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  if (i.department_id) {
    const { data: dept } = await supabase.from('departments')
      .select('id').eq('id', i.department_id).eq('company_id', companyId).maybeSingle();
    if (!dept) return { error: 'Geçersiz departman seçimi.' };
  }

  // "2026-08-21T14:30" → İstanbul saati olarak sabitlenir
  let occurred = new Date().toISOString();
  if (i.occurred_at) {
    const d = new Date(`${i.occurred_at}:00+03:00`);
    if (isNaN(d.getTime())) return { error: 'Olay tarihi okunamadı.' };
    if (d.getTime() > Date.now() + 5 * 60000) return { error: 'Olay tarihi gelecekte olamaz.' };
    occurred = d.toISOString();
  }

  const { data: row, error } = await supabase.from('incidents').insert({
    company_id: companyId,
    department_id: i.department_id,
    reporter_id: profile.id,
    title: i.title,
    body: i.body,
    location: i.location || null,
    occurred_at: occurred,
    severity: i.severity
  }).select('id').single();
  if (error) return { error: error.message };

  const sevTxt: Record<string, string> = {
    low: 'Düşük', medium: 'Orta', high: 'Yüksek', critical: 'Kritik'
  };
  await notifyAdmins(supabase, companyId, profile.id,
    '🚨 Yeni olay kaydı',
    `${profile.full_name}: ${i.title} · ${sevTxt[i.severity]} önem`,
    '/incidents');

  revalidatePath('/incidents');
  return { ok: true, id: row?.id };
}

/** Onayla / reddet — yalnızca admin + süper yönetici. */
export async function decideIncident(id: string, approve: boolean, note?: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz kayıt.' };
  const { supabase, profile } = await getCtx();
  if (!isAdmin(profile.role)) {
    return { error: 'Olay kayıtlarını yalnızca yönetici ve süper yönetici onaylayabilir.' };
  }

  const { data: inc } = await supabase.from('incidents')
    .select('id, company_id, reporter_id, title, status').eq('id', id).maybeSingle();
  if (!inc) return { error: 'Olay kaydı bulunamadı.' };
  if (inc.status !== 'pending') return { error: 'Bu kayıt zaten sonuçlanmış.' };

  const { data: updated, error } = await supabase.from('incidents').update({
    status: approve ? 'approved' : 'rejected',
    approved_by: profile.id,
    approved_at: new Date().toISOString(),
    decision_note: note?.trim().slice(0, 500) || null
  }).eq('id', id).eq('status', 'pending').select('id'); // yarış koruması
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Bu kayıt az önce başka biri tarafından sonuçlandırıldı.' };

  await supabase.from('notifications').insert({
    company_id: inc.company_id, user_id: inc.reporter_id, type: 'custom',
    payload: {
      title: approve ? '✅ Olay kaydınız onaylandı' : '❌ Olay kaydınız reddedildi',
      body: inc.title, url: '/incidents'
    }
  });
  pushToUsers([inc.reporter_id], {
    title: approve ? '✅ Olay kaydınız onaylandı' : '❌ Olay kaydınız reddedildi',
    body: inc.title, url: '/incidents'
  }).catch(() => {});

  revalidatePath('/incidents');
  return { ok: true };
}

/** Onaylanmış kaydı kapat (aksiyon tamamlandı). */
export async function closeIncident(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz kayıt.' };
  const { supabase, profile } = await getCtx();
  if (!isAdmin(profile.role)) return { error: 'Bu işlemi yalnızca yöneticiler yapabilir.' };

  const { data, error } = await supabase.from('incidents')
    .update({ status: 'closed' }).eq('id', id).eq('status', 'approved').select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Yalnızca onaylanmış kayıtlar kapatılabilir.' };

  revalidatePath('/incidents');
  return { ok: true };
}

/** Aksiyon raporu yaz — yalnızca admin + süper yönetici, yalnızca ONAYLANMIŞ kayda. */
export async function addIncidentAction(incidentId: string, body: string) {
  if (!z.string().uuid().safeParse(incidentId).success) return { error: 'Geçersiz kayıt.' };
  const text = body.trim();
  if (text.length < 3) return { error: 'Aksiyon raporu en az 3 karakter olmalıdır.' };
  if (text.length > 5000) return { error: 'Aksiyon raporu çok uzun.' };

  const { supabase, profile } = await getCtx();
  if (!isAdmin(profile.role)) {
    return { error: 'Aksiyon raporunu yalnızca yönetici ve süper yönetici yazabilir.' };
  }

  const { data: inc } = await supabase.from('incidents')
    .select('id, company_id, status').eq('id', incidentId).maybeSingle();
  if (!inc) return { error: 'Olay kaydı bulunamadı.' };
  if (!['approved', 'closed'].includes(inc.status)) {
    return { error: 'Aksiyon raporu yazmak için önce olay kaydını onaylayın.' };
  }

  const { error } = await supabase.from('incident_actions').insert({
    incident_id: incidentId, company_id: inc.company_id, author_id: profile.id, body: text
  });
  if (error) return { error: error.message };

  revalidatePath('/incidents');
  return { ok: true };
}

/** Aksiyon raporunu düzenle (yazan kişi ya da süper yönetici). */
export async function updateIncidentAction(id: string, body: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz rapor.' };
  const text = body.trim();
  if (text.length < 3) return { error: 'Aksiyon raporu en az 3 karakter olmalıdır.' };

  const { supabase, profile } = await getCtx();
  if (!isAdmin(profile.role)) return { error: 'Yetkiniz yok.' };

  const { data: row } = await supabase.from('incident_actions')
    .select('id, author_id').eq('id', id).maybeSingle();
  if (!row) return { error: 'Rapor bulunamadı.' };
  if (row.author_id !== profile.id && profile.role !== 'super_admin') {
    return { error: 'Yalnızca kendi yazdığınız raporu düzenleyebilirsiniz.' };
  }

  const { data, error } = await supabase.from('incident_actions')
    .update({ body: text.slice(0, 5000) }).eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Rapor güncellenemedi.' };

  revalidatePath('/incidents');
  return { ok: true };
}

/** Aksiyon raporunu sil (yazan kişi ya da süper yönetici). */
export async function deleteIncidentAction(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz rapor.' };
  const { supabase, profile } = await getCtx();
  if (!isAdmin(profile.role)) return { error: 'Yetkiniz yok.' };

  const { data: row } = await supabase.from('incident_actions')
    .select('id, author_id').eq('id', id).maybeSingle();
  if (!row) return { error: 'Rapor bulunamadı.' };
  if (row.author_id !== profile.id && profile.role !== 'super_admin') {
    return { error: 'Yalnızca kendi yazdığınız raporu silebilirsiniz.' };
  }

  const { error } = await supabase.from('incident_actions').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/incidents');
  return { ok: true };
}
