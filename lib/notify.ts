import 'server-only';
import { pushToUsers } from './push';

/**
 * Bir şirketteki YETKİLİLERE (admin + süper yönetici + müdürler) bildirim yollar.
 *
 * Neden RPC? Yetkilileri doğrudan `profiles` üzerinden aramak çalışmıyordu:
 * personel yalnızca kendi şirketindeki profilleri görebildiği için, şirketi
 * olmayan SÜPER YÖNETİCİLER ve başka şirkete kayıtlı (ama tüm şirketlerde
 * yetkili) ADMİNLER hiç bulunamıyordu. `decider_ids()` SECURITY DEFINER
 * olduğu için bu kısıtı aşar (bkz. 0019_notifications_fix.sql).
 *
 * @returns bildirim gönderilen kişi sayısı (0 ise kimse bulunamadı)
 */
export async function notifyDeciders(
  supabase: any,
  opts: {
    companyId: string;
    exceptId?: string;
    title: string;
    body: string;
    url: string;
  }
): Promise<number> {
  const { data, error } = await supabase.rpc('decider_ids', { cid: opts.companyId });
  if (error) {
    // sessizce kaybolmasın: sunucu günlüğüne düşsün
    console.error('[bildirim] yöneticiler bulunamadı:', error.message);
    return 0;
  }

  const ids = Array.from(new Set(
    ((data ?? []) as any[]).map(r => (typeof r === 'string' ? r : r.user_id)).filter(Boolean)
  )).filter(id => id !== opts.exceptId) as string[];

  if (!ids.length) return 0;

  const { error: insErr } = await supabase.from('notifications').insert(
    ids.map(user_id => ({
      company_id: opts.companyId,
      user_id,
      type: 'custom',
      payload: { title: opts.title, body: opts.body, url: opts.url }
    }))
  );
  if (insErr) {
    console.error('[bildirim] yazılamadı:', insErr.message);
    return 0;
  }

  pushToUsers(ids, { title: opts.title, body: opts.body, url: opts.url }).catch(() => {});
  return ids.length;
}

/**
 * Tek bir kişiye bildirim (talep sahibine karar bildirimi gibi).
 * Bildirim yazılamazsa sessizce geçer — ana işlemi asla bozmaz.
 */
export async function notifyUser(
  supabase: any,
  opts: { companyId: string; userId: string; title: string; body: string; url: string }
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    company_id: opts.companyId,
    user_id: opts.userId,
    type: 'custom',
    payload: { title: opts.title, body: opts.body, url: opts.url }
  });
  if (error) console.error('[bildirim] yazılamadı:', error.message);
  pushToUsers([opts.userId], { title: opts.title, body: opts.body, url: opts.url }).catch(() => {});
}
