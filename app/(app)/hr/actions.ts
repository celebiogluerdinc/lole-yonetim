'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

async function notify(supabase: any, companyId: string, userIds: string[], title: string, body: string, url: string) {
  if (!userIds.length) return;
  await supabase.from('notifications').insert(userIds.map(user_id => ({
    company_id: companyId, user_id, type: 'custom', payload: { title, body, url }
  })));
  pushToUsers(userIds, { title, body, url }).catch(() => {});
}

// ==================== VARDİYA ====================
const WD_OFFSET: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

// All date math is done on UTC-midnight instants of the calendar dates the user
// picked, and the actual shift instants are built with the fixed Istanbul
// offset (+03:00, no DST) — the server itself runs in UTC.
const dayUTC = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
function mondayOfUTC(d: Date) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Add shifts: one or MANY people at once, one-off OR weekly recurring
 * (selected weekdays × N weeks → a series sharing series_id).
 */
export async function addShift(formData: FormData) {
  const schema = z.object({
    user_ids: z.array(z.string().uuid()).min(1),
    department_id: z.string().uuid(),
    date: z.string().min(8),
    start: z.string().min(4),
    end: z.string().min(4),
    note: z.string().max(200).optional().default(''),
    repeat: z.enum(['none', 'weekly']),
    weekdays: z.array(z.string()).default([]),
    weeks: z.coerce.number().min(1).max(12).default(4)
  });
  const parsed = schema.safeParse({
    user_ids: formData.getAll('user_ids').map(String),
    department_id: String(formData.get('department_id') ?? ''),
    date: String(formData.get('date') ?? ''),
    start: String(formData.get('start') ?? ''),
    end: String(formData.get('end') ?? ''),
    note: String(formData.get('note') ?? ''),
    repeat: String(formData.get('repeat') ?? 'none'),
    weekdays: formData.getAll('weekdays').map(String),
    weeks: formData.get('weeks') || 4
  });
  if (!parsed.success) return { error: 'En az bir kişi, tarih ve saatler zorunludur.' };
  const i = parsed.data;
  if (i.repeat === 'weekly' && i.weekdays.length === 0) {
    return { error: 'Haftalık tekrar için en az bir gün seçin.' };
  }

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  const allowed = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.includes(i.department_id);
  if (!allowed) return { error: 'Bu departmanda vardiya planlamaya yetkiniz yok.' };

  // güvenlik: departman AKTİF şirkete ait olmalı (adminler tüm şirketlerde
  // yetkili olduğu için yanlışlıkla başka şirketin departmanı seçilemesin)
  const { data: deptOk } = await supabase.from('departments')
    .select('id').eq('id', i.department_id).eq('company_id', companyId).maybeSingle();
  if (!deptOk) return { error: 'Geçersiz departman seçimi.' };

  // güvenlik: hedef kişiler bu şirketin aktif çalışanları olmalı
  const { data: validUsers } = await supabase
    .from('profiles').select('id').eq('company_id', companyId).in('id', i.user_ids);
  if ((validUsers ?? []).length !== i.user_ids.length) {
    return { error: 'Seçilen kişilerden bazıları bu şirkette bulunamadı.' };
  }

  // occurrence dates
  const baseDates: Date[] = [];
  const anchor = dayUTC(i.date);
  if (isNaN(anchor.getTime())) return { error: 'Geçersiz tarih.' };
  if (i.repeat === 'none') {
    baseDates.push(anchor);
  } else {
    const week0 = mondayOfUTC(anchor);
    for (let w = 0; w < i.weeks; w++) {
      for (const wd of i.weekdays) {
        const off = WD_OFFSET[wd];
        if (off === undefined) continue;
        const d = new Date(week0.getTime() + (w * 7 + off) * 86400000);
        if (d >= anchor) baseDates.push(d); // başlangıç tarihinden öncesine vardiya yazma
      }
    }
    baseDates.sort((a, b) => a.getTime() - b.getTime());
  }

  const seriesId = (i.repeat === 'weekly' || i.user_ids.length > 1)
    ? crypto.randomUUID() : null;

  const rows: any[] = [];
  for (const d of baseDates) {
    const dateStr = d.toISOString().slice(0, 10);
    const starts = new Date(`${dateStr}T${i.start.slice(0, 5)}:00+03:00`);
    let ends = new Date(`${dateStr}T${i.end.slice(0, 5)}:00+03:00`);
    if (isNaN(starts.getTime()) || isNaN(ends.getTime())) return { error: 'Geçersiz saat.' };
    if (ends <= starts) ends = new Date(ends.getTime() + 24 * 3600 * 1000); // gece vardiyası
    for (const uid of i.user_ids) {
      rows.push({
        company_id: companyId,
        department_id: i.department_id,
        user_id: uid,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        note: i.note || null,
        created_by: profile.id,
        series_id: seriesId
      });
    }
  }
  if (rows.length === 0) return { error: 'Oluşturulacak vardiya bulunamadı.' };
  if (rows.length > 400) return { error: 'Tek seferde en fazla 400 vardiya oluşturulabilir.' };

  // vardiya–izin çakışma kontrolü: onaylı izindeki kişiye o güne vardiya yazılamaz
  const minDate = baseDates[0].toISOString().slice(0, 10);
  const maxDate = baseDates[baseDates.length - 1].toISOString().slice(0, 10);
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('user_id, start_date, end_date, profiles:user_id(full_name)')
    .eq('status', 'approved')
    .in('user_id', i.user_ids)
    .lte('start_date', maxDate)
    .gte('end_date', minDate);
  if (leaves?.length) {
    const conflicts: string[] = [];
    for (const l of leaves) {
      const hit = baseDates.some(d => {
        const ds = d.toISOString().slice(0, 10);
        return ds >= l.start_date && ds <= l.end_date;
      });
      if (hit) {
        conflicts.push(`${(l as any).profiles?.full_name ?? 'Personel'} (${l.start_date} – ${l.end_date} izinli)`);
      }
    }
    if (conflicts.length) {
      return { error: `⚠️ İzin çakışması — şu kişiler seçilen tarihlerde onaylı izinde: ${Array.from(new Set(conflicts)).join(', ')}. Bu kişileri çıkarın veya tarihleri değiştirin.` };
    }
  }

  const { error } = await supabase.from('shifts').insert(rows);
  if (error) {
    return { error: error.code === '23P01'
      ? '⚠️ Vardiya çakışması: seçilen kişilerden birinin bu saat aralığında zaten vardiyası var.'
      : error.message };
  }

  const first = baseDates[0].toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
  const body = i.repeat === 'weekly'
    ? `${first} itibarıyla haftalık vardiya programınız güncellendi (${baseDates.length} gün).`
    : `${first} · ${i.start}–${i.end} vardiyası planlandı.`;
  await notify(supabase, companyId, i.user_ids, '🗓 Vardiya planlandı', body, '/shifts');

  revalidatePath('/shifts');
  return { ok: true, count: rows.length };
}

/**
 * Geçen haftanın vardiya planını bu haftaya kopyalar (+7 gün).
 * Yalnızca yetkili departmanlar; aynı kişi-saat çakışması ve onaylı izin günleri atlanır.
 */
export async function copyPreviousWeekShifts(weekStartIso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso)) return { error: 'Geçersiz hafta.' };
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  if (!isAdmin && managedDepartmentIds.length === 0) {
    return { error: 'Vardiya planlamaya yetkiniz yok.' };
  }

  const weekStart = new Date(`${weekStartIso}T00:00:00+03:00`);
  const prevStart = new Date(weekStart.getTime() - 7 * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  // geçen haftanın vardiyaları (yetki kapsamında)
  let q = supabase.from('shifts')
    .select('user_id, department_id, starts_at, ends_at, note')
    .eq('company_id', companyId)
    .gte('starts_at', prevStart.toISOString())
    .lt('starts_at', weekStart.toISOString());
  if (!isAdmin) q = q.in('department_id', managedDepartmentIds);
  const { data: prevShifts } = await q;
  if (!prevShifts?.length) return { error: 'Geçen haftada kopyalanacak vardiya yok.' };

  // bu haftada zaten var olanlar (mükerrer önleme) + izinli günler
  const userIds = Array.from(new Set(prevShifts.map((s: any) => s.user_id)));
  const [{ data: existing }, { data: leaves }] = await Promise.all([
    supabase.from('shifts')
      .select('user_id, starts_at')
      .eq('company_id', companyId)
      .gte('starts_at', weekStart.toISOString()).lt('starts_at', weekEnd.toISOString())
      .in('user_id', userIds),
    supabase.from('leave_requests')
      .select('user_id, start_date, end_date')
      .eq('status', 'approved').in('user_id', userIds)
      .lte('start_date', weekEnd.toISOString().slice(0, 10))
      .gte('end_date', weekStart.toISOString().slice(0, 10))
  ]);
  const existingKeys = new Set((existing ?? []).map((s: any) =>
    `${s.user_id}|${new Date(s.starts_at).toISOString()}`));

  const dayIst = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
  const onLeave = (uid: string, d: Date) => (leaves ?? []).some((l: any) =>
    l.user_id === uid && dayIst(d) >= l.start_date && dayIst(d) <= l.end_date);

  const seriesId = crypto.randomUUID();
  let skippedDup = 0, skippedLeave = 0;
  const rows: any[] = [];
  for (const s of prevShifts) {
    const starts = new Date(new Date(s.starts_at).getTime() + 7 * 86400000);
    const ends = new Date(new Date(s.ends_at).getTime() + 7 * 86400000);
    if (existingKeys.has(`${s.user_id}|${starts.toISOString()}`)) { skippedDup++; continue; }
    if (onLeave(s.user_id, starts)) { skippedLeave++; continue; }
    rows.push({
      company_id: companyId, department_id: s.department_id, user_id: s.user_id,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      note: s.note, created_by: profile.id, series_id: seriesId
    });
  }
  if (!rows.length) {
    return { error: `Kopyalanacak yeni vardiya kalmadı (${skippedDup} zaten planlı, ${skippedLeave} izinli).` };
  }
  const { error } = await supabase.from('shifts').insert(rows);
  if (error) {
    return { error: error.code === '23P01'
      ? '⚠️ Vardiya çakışması: bazı kişilerin bu haftada çakışan vardiyası zaten var — önce mevcut planı kontrol edin.'
      : error.message };
  }

  const affected = Array.from(new Set(rows.map(r => r.user_id)));
  await notify(supabase, companyId, affected, '🗓 Vardiya planlandı',
    'Bu haftanın vardiya programınız yayınlandı (geçen haftadan kopyalandı).', '/shifts');

  revalidatePath('/shifts');
  return { ok: true, count: rows.length, skippedDup, skippedLeave };
}

export async function deleteShift(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz kayıt.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  if (!(['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0)) {
    return { error: 'Vardiya silme yetkiniz yok.' };
  }
  const { data, error } = await supabase.from('shifts').delete().eq('id', id).select('id'); // RLS korur
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Vardiya bulunamadı veya silme yetkiniz yok.' };
  revalidatePath('/shifts');
  return { ok: true };
}

/** Deletes every shift of a recurring series (RLS scoped). */
export async function deleteShiftSeries(seriesId: string) {
  if (!z.string().uuid().safeParse(seriesId).success) return { error: 'Seri bulunamadı.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  if (!(['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0)) {
    return { error: 'Vardiya silme yetkiniz yok.' };
  }
  const { data, error } = await supabase.from('shifts').delete().eq('series_id', seriesId).select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Seri bulunamadı veya silme yetkiniz yok.' };
  revalidatePath('/shifts');
  return { ok: true, count: data.length };
}

// ==================== İZİN ====================
export async function requestLeave(formData: FormData) {
  const schema = z.object({
    type: z.enum(['annual', 'sick', 'unpaid', 'other']),
    start_date: z.string().min(8),
    end_date: z.string().min(8),
    reason: z.string().max(500).optional().default('')
  });
  const parsed = schema.safeParse({
    type: String(formData.get('type') ?? 'annual'),
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? ''),
    reason: String(formData.get('reason') ?? '')
  });
  if (!parsed.success) return { error: 'Tür ve tarihler zorunludur.' };
  const i = parsed.data;
  if (i.end_date < i.start_date) return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { error } = await supabase.from('leave_requests').insert({
    company_id: companyId, user_id: profile.id,
    type: i.type, start_date: i.start_date, end_date: i.end_date,
    reason: i.reason || null
  });
  if (error) return { error: error.message };

  // yöneticilere haber ver: kişinin departman müdürleri + adminler
  const { data: myDepts } = await supabase
    .from('department_members').select('department_id').eq('user_id', profile.id);
  const deptIds = (myDepts ?? []).map((d: any) => d.department_id);
  const targets = new Set<string>();
  if (deptIds.length) {
    const { data: mgrs } = await supabase
      .from('department_members').select('user_id')
      .in('department_id', deptIds).eq('is_manager', true);
    for (const m of mgrs ?? []) targets.add(m.user_id);
  }
  const { data: admins } = await supabase
    .from('profiles').select('id').eq('company_id', companyId).eq('role', 'admin');
  for (const a of admins ?? []) targets.add(a.id);
  targets.delete(profile.id);
  await notify(supabase, companyId, Array.from(targets),
    '🏖 Yeni izin talebi', `${profile.full_name}: ${i.start_date} – ${i.end_date}`, '/leave');

  revalidatePath('/leave');
  return { ok: true };
}

export async function decideLeave(id: string, approve: boolean, note?: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const { data: req } = await supabase.from('leave_requests').select('*').eq('id', id).maybeSingle();
  if (!req) return { error: 'Talep bulunamadı.' };
  if (req.status !== 'pending') return { error: 'Bu talep zaten sonuçlanmış.' };

  // yalnızca yöneticiler karar verebilir; kimse KENDİ talebini onaylayamaz
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  if (req.user_id === profile.id && profile.role !== 'super_admin') {
    return { error: 'Kendi izin talebinizi kendiniz sonuçlandıramazsınız.' };
  }
  if (!isAdmin) {
    if (managedDepartmentIds.length === 0) return { error: 'İzin taleplerini sonuçlandırma yetkiniz yok.' };
    const { data: shared } = await supabase
      .from('department_members').select('department_id')
      .eq('user_id', req.user_id).in('department_id', managedDepartmentIds).limit(1);
    if (!shared?.length) return { error: 'Bu kişi yönettiğiniz departmanlarda değil.' };
  }

  const { data: updated, error } = await supabase.from('leave_requests').update({
    status: approve ? 'approved' : 'rejected',
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
    decision_note: note?.trim().slice(0, 500) || null
  }).eq('id', id).eq('status', 'pending').select('id'); // yarış koruması: yalnız bekleyen talep
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Bu talep az önce başka biri tarafından sonuçlandırıldı.' };

  await notify(supabase, req.company_id, [req.user_id],
    approve ? '✅ İzin talebiniz onaylandı' : '❌ İzin talebiniz reddedildi',
    `${req.start_date} – ${req.end_date}${note ? ` · ${note}` : ''}`, '/leave');

  revalidatePath('/leave');
  return { ok: true };
}

export async function cancelLeave(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Geçersiz talep.' };
  const { supabase, profile } = await getCtx();
  const { data, error } = await supabase.from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', id).eq('user_id', profile.id).eq('status', 'pending')
    .select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Talep bulunamadı veya zaten sonuçlanmış.' };
  revalidatePath('/leave');
  return { ok: true };
}

// ==================== PUANTAJ ====================
export async function clockIn(method: 'qr' | 'manual') {
  if (!['qr', 'manual'].includes(method)) return { error: 'Geçersiz giriş yöntemi.' };
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: open } = await supabase
    .from('time_entries').select('id')
    .eq('user_id', profile.id).is('clock_out', null).limit(1).maybeSingle();
  if (open) return { error: 'Zaten açık bir mesainiz var. Önce çıkış yapın.' };

  const { error } = await supabase.from('time_entries').insert({
    company_id: companyId, user_id: profile.id, in_method: method
  });
  if (error) {
    return { error: error.code === '23505'
      ? 'Zaten açık bir mesainiz var. Önce çıkış yapın.'
      : error.message };
  }
  revalidatePath('/clock');
  return { ok: true };
}

export async function clockOut() {
  const { supabase, profile } = await getCtx();
  const { data: open } = await supabase
    .from('time_entries').select('id')
    .eq('user_id', profile.id).is('clock_out', null)
    .order('clock_in', { ascending: false }).limit(1).maybeSingle();
  if (!open) return { error: 'Açık mesai bulunamadı. Önce giriş yapın.' };

  const { error } = await supabase.from('time_entries')
    .update({ clock_out: new Date().toISOString() }).eq('id', open.id);
  if (error) return { error: error.message };
  revalidatePath('/clock');
  return { ok: true };
}
