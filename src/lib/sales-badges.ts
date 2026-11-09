import { cache } from 'react';
import { TZ } from '@/lib/utils';

/**
 * SAHA SATIŞ ROZET SAYAÇLARI
 *
 * Aynı sayı iki yerde gösteriliyor: kenar çubuğundaki "Satış & Pazarlama"
 * girişinde ve /sales alt sekmelerinde. Her ikisi kendi sorgusunu
 * attığında istek başına aynı sorgu iki kez çalışıyordu.
 *
 * React `cache()` istek ömrü boyunca sonucu tutuyor: ikinci çağrı ağa
 * çıkmıyor. Tarih argümanı yok — gün sunucuda İstanbul takvimine göre
 * burada hesaplanıyor ki iki çağrının anahtarı farklı çıkmasın.
 */
export const salesBadges = cache(async (
  supabase: any, userId: string, companyId: string | null
): Promise<{ dueFollowUps: number; draftVisits: number; pendingOrders: number }> => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  const [fup, draft, orders] = await Promise.all([
    supabase.from('follow_ups').select('id', { count: 'exact', head: true })
      .eq('owner_user_id', userId).eq('status', 'acik').lte('due_date', today),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'taslak'),
    companyId
      ? supabase.from('sales_orders').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).in('status', ['taslak', 'onay_bekliyor'])
      : Promise.resolve({ count: 0 })
  ]);

  return {
    dueFollowUps: fup?.count ?? 0,
    draftVisits: draft?.count ?? 0,
    pendingOrders: orders?.count ?? 0
  };
});
