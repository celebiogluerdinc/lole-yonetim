import { cache } from 'react';
import { TZ } from '@/lib/utils';

/**
 * "Satışta yönetici mi?" sorusunun TEK cevabı.
 *
 * salesBadges React cache() ile sarılı ve anahtarı argümanların kendisi:
 * uygulama kabuğu ile /sales kabuğu bu değeri ayrı ayrı hesaplayıp farklı
 * sonuç geçerse aynı istekte sorgu iki kez çalışır, üstelik iki yerde
 * farklı rozet görünür. Bu yüzden dört çağıran da değeri buradan alıyor.
 *
 * Kural uygulamanın geri kalanıyla aynı: "manager" rolü tek başına
 * yetmez, kişi gerçekten bir departmanı yönetiyor olmalı (ya da admin).
 */
export function isSalesManager(role: string, managedDepartmentIds: string[]): boolean {
  return role === 'super_admin' || role === 'admin' || managedDepartmentIds.length > 0;
}

/**
 * SAHA SATIŞ ROZET SAYAÇLARI
 *
 * Aynı sayı iki yerde gösteriliyor: uygulama menüsündeki "Satış" girişinde
 * ve /sales sekmelerinde. Her ikisi kendi sorgusunu attığında istek başına
 * aynı sorgu iki kez çalışıyordu.
 *
 * React `cache()` istek ömrü boyunca sonucu tutuyor: ikinci çağrı ağa
 * çıkmıyor. Tarih argümanı yok — gün sunucuda İstanbul takvimine göre
 * burada hesaplanıyor ki iki çağrının anahtarı farklı çıkmasın.
 *
 * BEKLEYEN SİPARİŞİN KAPSAMI role göre değişiyor: rozet "senin yapman
 * gereken iş var" demek. Onay yöneticinin işi, o yüzden yönetici şirketin
 * tüm bekleyenlerini görür. Temsilci başkasının siparişini onaylayamaz;
 * şirket geneli sayıldığında rozeti hiçbir şey yapsa da sıfırlanmıyordu
 * ve bir süre sonra kimse rozete bakmıyordu. Temsilcide yalnız kendi
 * açtığı ve henüz onaylanmamış siparişler sayılır.
 */
export const salesBadges = cache(async (
  supabase: any, userId: string, companyId: string | null, isManager: boolean
): Promise<{ dueFollowUps: number; draftVisits: number; pendingOrders: number }> => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  let orders: any = Promise.resolve({ count: 0 });
  if (companyId) {
    let q = supabase.from('sales_orders').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).in('status', ['taslak', 'onay_bekliyor']);
    if (!isManager) q = q.eq('created_by', userId);
    orders = q;
  }

  const [fup, draft, ord] = await Promise.all([
    supabase.from('follow_ups').select('id', { count: 'exact', head: true })
      .eq('owner_user_id', userId).eq('status', 'acik').lte('due_date', today),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'taslak'),
    orders
  ]);

  return {
    dueFollowUps: fup?.count ?? 0,
    draftVisits: draft?.count ?? 0,
    pendingOrders: ord?.count ?? 0
  };
});
