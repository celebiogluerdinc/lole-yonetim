'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

const ALLOWED = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/msword', 'application/vnd.ms-excel', 'text/plain', 'text/csv'
]);

/** Şirket dosya arşivine dosya yükle (admin + departman müdürleri). */
export async function uploadDocument(formData: FormData) {
  const title = z.string().min(2).max(200).safeParse(String(formData.get('title') ?? '').trim());
  const category = String(formData.get('category') ?? '').trim().slice(0, 60) || null;
  const deptId = String(formData.get('department_id') ?? '') || null;
  const validUntilRaw = String(formData.get('valid_until') ?? '').trim();
  const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(validUntilRaw) ? validUntilRaw : null;
  const file = formData.get('file') as File | null;
  if (!title.success) return { error: 'Dosya başlığı en az 2 karakter olmalı.' };
  if (!file || !file.size) return { error: 'Dosya seçilmedi.' };
  if (file.size > 20 * 1024 * 1024) return { error: 'Dosya 20MB sınırını aşıyor.' };
  if (file.type && !ALLOWED.has(file.type)) {
    return { error: 'Desteklenmeyen dosya türü. PDF, Office belgeleri, resim ve metin dosyaları yüklenebilir.' };
  }
  if (deptId && !z.string().uuid().safeParse(deptId).success) return { error: 'Geçersiz departman.' };

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  const canUpload = ['super_admin', 'admin'].includes(profile.role) ||
    (deptId ? managedDepartmentIds.includes(deptId) : managedDepartmentIds.length > 0);
  if (!canUpload) return { error: 'Dosya yüklemeyi yalnızca yönetici ve müdürler yapabilir.' };

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const path = `${companyId}/docs/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('attachments')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (upErr) return { error: `Yükleme başarısız: ${upErr.message}` };

  const { error } = await supabase.from('documents').insert({
    company_id: companyId,
    department_id: deptId,
    title: title.data,
    category,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    uploaded_by: profile.id,
    ...(validUntil ? { valid_until: validUntil } : {})
  });
  if (error) return { error: error.message };

  revalidatePath('/files');
  return { ok: true };
}

/** Dosyayı arşivden sil (yükleyen müdür veya admin — RLS de korur). */
export async function deleteDocument(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz dosya.' };
  const { supabase } = await getCtx();
  const { data: doc } = await supabase.from('documents')
    .select('id, storage_path').eq('id', id).maybeSingle();
  if (!doc) return { error: 'Dosya bulunamadı.' };

  const { data, error } = await supabase.from('documents').delete().eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Bu dosyayı silme yetkiniz yok.' };
  // storage temizliği — başarısız olsa da kayıt silindi
  await supabase.storage.from('attachments').remove([doc.storage_path]).catch(() => {});

  revalidatePath('/files');
  return { ok: true };
}
