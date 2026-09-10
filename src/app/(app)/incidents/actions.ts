'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { notifyDeciders, notifyUser } from '@/lib/notify';

const isAdmin = (role: string) => ['super_admin', 'admin'].includes(role);
const uuid = z.string().uuid();

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
  // NOT: decider_ids() adminleri ve süper yöneticileri şirketten bağımsız bulur;
  // olay kayıtlarını yalnızca onlar görebildiği için bildirim de onlara gider.
  const notified = await notifyDeciders(supabase, {
    companyId, exceptId: profile.id,
    title: '🚨 Yeni olay kaydı',
    body: `${profile.full_name}: ${i.title} · ${sevTxt[i.severity]} önem`,
    url: '/incidents'
  });

  revalidatePath('/incidents');
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true, id: row?.id, notified };
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

  await notifyUser(supabase, {
    companyId: inc.company_id, userId: inc.reporter_id,
    title: approve ? '✅ Olay kaydınız onaylandı' : '❌ Olay kaydınız reddedildi',
    body: inc.title, url: '/incidents'
  });

  revalidatePath('/incidents');
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
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

/* ============================================================
   OLAY KAYDI FOTOĞRAFLARI
   Fotoğrafı olay kaydını açan kişi (kendi kaydına) ve yöneticiler ekler.
   Görme yetkisi veritabanı kuralıyla admin + süper yönetici ile sınırlıdır.
   ============================================================ */

const ALLOWED_IMG = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'
]);
const ALLOWED_IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif']);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_INCIDENT = 10;

/** Bir olay kaydına fotoğraf yükler. */
export async function uploadIncidentPhoto(formData: FormData) {
  const incidentId = String(formData.get('incident_id') ?? '');
  if (!uuid.safeParse(incidentId).success) return { error: 'Geçersiz olay kaydı.' };

  const files = formData.getAll('photos').filter(f => f instanceof File) as File[];
  if (!files.length) return { error: 'Fotoğraf seçilmedi.' };

  const { supabase, profile } = await getCtx();

  const { data: inc } = await supabase.from('incidents')
    .select('id, company_id, reporter_id').eq('id', incidentId).maybeSingle();
  if (!inc) return { error: 'Olay kaydı bulunamadı veya erişiminiz yok.' };
  if (!(isAdmin(profile.role) || inc.reporter_id === profile.id)) {
    return { error: 'Bu kayda fotoğraf ekleme yetkiniz yok.' };
  }

  const { count: mevcut } = await supabase.from('incident_photos')
    .select('id', { count: 'exact', head: true }).eq('incident_id', incidentId);
  if ((mevcut ?? 0) + files.length > MAX_PHOTOS_PER_INCIDENT) {
    return { error: `Bir olay kaydına en fazla ${MAX_PHOTOS_PER_INCIDENT} fotoğraf eklenebilir.` };
  }

  // ÖNCE HEPSİNİ DENETLE, SONRA YÜKLE.
  // Böylece hatalı bir dosya yüzünden yarısı yüklenmiş bir kayıt oluşmaz.
  const kabul: { file: File; ext: string }[] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_PHOTO_BYTES) {
      return { error: `"${file.name}" 10MB sınırını aşıyor.` };
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    if (file.type ? !ALLOWED_IMG.has(file.type) : !ALLOWED_IMG_EXT.has(ext)) {
      return { error: `"${file.name}" bir fotoğraf değil (JPG, PNG, HEIC, WebP kabul edilir).` };
    }
    kabul.push({ file, ext });
  }
  if (!kabul.length) return { error: 'Fotoğraf seçilmedi.' };

  let eklenen = 0;
  for (const { file, ext } of kabul) {
    // 0002'deki depolama kuralı: ilk klasör şirket kimliği olmalı
    const path = `${inc.company_id}/incidents/${incidentId}/${crypto.randomUUID()}.${ext || 'jpg'}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from('attachments')
      .upload(path, buf, { contentType: file.type || 'image/jpeg' });
    if (upErr) {
      revalidatePath('/incidents');
      return { error: `Yükleme başarısız: ${upErr.message}`, eklenen };
    }

    const { error: rowErr } = await supabase.from('incident_photos').insert({
      incident_id: incidentId,
      company_id: inc.company_id,
      uploaded_by: profile.id,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type || null
    });
    if (rowErr) {
      // satır yazılamadıysa dosyayı da bırakma
      await supabase.storage.from('attachments').remove([path]);
      revalidatePath('/incidents');
      return { error: `Fotoğraf kaydedilemedi: ${rowErr.message}`, eklenen };
    }
    eklenen++;
  }

  revalidatePath('/incidents');
  return { ok: true, eklenen };
}

/** Fotoğrafı siler (yükleyen kişi ya da süper yönetici). */
export async function deleteIncidentPhoto(photoId: string) {
  if (!uuid.safeParse(photoId).success) return { error: 'Geçersiz fotoğraf.' };
  const { supabase, profile } = await getCtx();

  const { data: ph } = await supabase.from('incident_photos')
    .select('id, storage_path, uploaded_by').eq('id', photoId).maybeSingle();
  if (!ph) return { error: 'Fotoğraf bulunamadı.' };
  // Yükleyen kişi kendi fotoğrafını, yönetici (admin / süper yönetici) her fotoğrafı silebilir.
  if (ph.uploaded_by !== profile.id && !isAdmin(profile.role)) {
    return { error: 'Yalnızca kendi eklediğiniz fotoğrafı silebilirsiniz.' };
  }

  const { data, error } = await supabase.from('incident_photos')
    .delete().eq('id', photoId).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Fotoğraf silinemedi.' };

  await supabase.storage.from('attachments').remove([ph.storage_path]);
  revalidatePath('/incidents');
  return { ok: true };
}
