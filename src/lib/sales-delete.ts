/**
 * SİLME YARDIMCILARI
 *
 * Silme iki şey demek: kaydın gitmesi ve gittiğinin yazılı kalması.
 * Ticari belge izsiz kaybolmamalı — bu yüzden her silme
 * `sales_deletions` tablosuna bir satır bırakıyor (kim, neyi, neden).
 *
 * Veritabanı tarafında koruma var (0030): bağlı kaydı olan nokta,
 * siparişi olan teklif ve sevk edilmiş sipariş silinmiyor. Buradaki
 * çeviri o hataları kullanıcının anlayacağı tek cümleye indiriyor.
 */

export type SalesEntity =
  | 'outlet' | 'visit' | 'quote' | 'order'
  | 'assessment' | 'complaint' | 'follow_up' | 'route_plan';

/** Veritabanı koruması mı devreye girdi? Hangi koruma? */
export function deleteBlock(msg: string): 'bagli_kayit' | 'bagli_siparis' | 'sevk_edildi' | null {
  if (/BAGLI_KAYIT/.test(msg)) return 'bagli_kayit';
  if (/BAGLI_SIPARIS/.test(msg)) return 'bagli_siparis';
  if (/SEVK_EDILDI/.test(msg)) return 'sevk_edildi';
  return null;
}

/** Ham Postgres hatasını kullanıcıya gösterilebilir Türkçeye çevirir. */
export function deleteMessage(msg: string): string {
  switch (deleteBlock(msg)) {
    case 'bagli_kayit':
      return 'Bu noktaya bağlı ziyaret, teklif veya sipariş var; silinemez. Nokta pasife alındı — listelerde görünmez, geçmiş raporlar bozulmaz.';
    case 'bagli_siparis':
      return 'Bu teklifden sipariş oluşturulmuş. Önce siparişi silin veya iptal edin.';
    case 'sevk_edildi':
      return 'Sevk edilmiş veya teslim edilmiş sipariş silinemez. Durumunu "iptal" yapabilirsiniz.';
    default:
      return msg.replace(/^.*?:\s*/, '');
  }
}

/**
 * Silme kaydını yazar. Hata vermez: denetim satırı yazılamadı diye
 * kullanıcıya "silinemedi" demek yanlış olur — kayıt gerçekten silindi.
 */
export async function logDeletion(
  supabase: any,
  companyId: string | null,
  userId: string,
  entity: SalesEntity,
  recordId: string,
  label: string,
  reason?: string | null
): Promise<void> {
  if (!companyId) return;
  try {
    await supabase.from('sales_deletions').insert({
      company_id: companyId,
      entity,
      record_id: recordId,
      label: label.slice(0, 200) || '—',
      reason: reason?.trim() || null,
      deleted_by: userId
    });
  } catch {
    /* denetim satırı yazılamadı — sessiz geç */
  }
}
