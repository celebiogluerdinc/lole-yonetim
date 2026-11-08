-- ============================================================
-- 0029 — RLS DÜZELTMESİ: İLERİ DURUM GEÇİŞLERİ ENGELLENİYORDU
--
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
-- Önce 0022–0028 çalıştırılmış olmalı.
--
-- SORUN
-- PostgreSQL'de bir UPDATE politikasında WITH CHECK yazılmazsa, USING
-- ifadesi SONUÇ SATIRI için de uygulanır. Politikalarımız "yalnızca
-- taslaktayken dokunabilirsin" diyordu; bu kural sonuç satırına da
-- uygulanınca "taslak → gönderildi" geçişi İMKÂNSIZ hale geliyordu.
-- Temsilci ziyaretini gönderemiyordu.
--
-- Aynı hata beş yerde vardı: visits, quotes, sales_orders,
-- outlet_complaints ve ziyaretin çocuk tabloları.
--
-- DOĞRU AYRIM
--   USING       → bu satıra DOKUNABİLİR misin (mevcut durumuna göre)
--   WITH CHECK  → ortaya çıkan satır KABUL EDİLEBİLİR mi
-- İkisi aynı olursa satır asla ilerleyemez.
--
-- İş kuralları (çift kontrol, stok teyidi, karantina, kritik açılış
-- kontrolleri) zaten TRIGGER'larla zorlanıyor ve atlatılamıyor.
-- RLS'in işi kimin hangi satıra dokunacağını belirlemek; durum
-- makinesini RLS'e de kodlamak gereksiz ve kırılgandı.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ZİYARET — sahibi kendi taslağını GÖNDEREBİLMELİ
--    Onaylama (onaylandi) yalnızca müdür/yöneticide kalır.
-- ------------------------------------------------------------
drop policy if exists visits_update on visits;
create policy visits_update on visits for update
  using (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or (user_id = auth.uid() and status = 'taslak')
    )
  )
  with check (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      -- sahibi: taslakta tutabilir ya da gönderebilir; onaylayamaz
      or (user_id = auth.uid() and status in ('taslak','gonderildi'))
    )
  );

-- ------------------------------------------------------------
-- 2) TEKLİF — hazırlayan kişi süreci ilerletebilmeli
--    Çift kontrol kuralını fn_quote_guard trigger'ı zorluyor;
--    RLS'in ayrıca durum kısıtlaması yapmasına gerek yok.
-- ------------------------------------------------------------
drop policy if exists quotes_update on quotes;
create policy quotes_update on quotes for update
  using (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or created_by = auth.uid()
    )
  )
  with check (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or created_by = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3) SİPARİŞ — aynı gerekçe. Onaylı teklif ve stok teyidi şartını
--    fn_order_guard trigger'ı zorluyor.
-- ------------------------------------------------------------
drop policy if exists sorder_update on sales_orders;
create policy sorder_update on sales_orders for update
  using (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or created_by = auth.uid()
    )
  )
  with check (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or created_by = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4) ŞİKÂYET — bildiren kişi incelemeye alabilmeli/çözebilmeli.
--    Ürün güvenliğinde karantina şartını fn_complaint_guard zorluyor.
-- ------------------------------------------------------------
drop policy if exists complaint_update on outlet_complaints;
create policy complaint_update on outlet_complaints for update
  using (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or reported_by = auth.uid()
    )
  )
  with check (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or reported_by = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5) ZİYARETİN ÇOCUK TABLOLARI
--    Puanlar, tadım, özet ve fotoğraflar ziyaretle BİRLİKTE yazılıyor.
--    Eski kural "yalnızca ziyaret taslakken yazılabilir" diyordu; kayıt
--    sırası gereği ziyaret o an gönderilmiş olabiliyor ve çocuk satırlar
--    reddediliyordu.
--
--    Yeni kural: sahibi, ziyaret ONAYLANMADIĞI sürece yazabilir.
--    Onaylanmış ziyaretin kaydına yalnızca müdür/yönetici dokunabilir —
--    "gönderim bir beyandır" ilkesi onay anında kilitleniyor.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['visit_scores','visit_tastings',
                           'visit_tasting_summary','visit_photos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all '
      || 'using (exists (select 1 from visits v where v.id = %I.visit_id '
      || '   and same_company(v.company_id) and sales_can_see(v.user_id, v.department_id))) '
      || 'with check (exists (select 1 from visits v where v.id = %I.visit_id '
      || '   and same_company(v.company_id) and ('
      || '     is_super_admin() or auth_role() = ''admin'' '
      || '     or manages_department(v.department_id) '
      || '     or (v.user_id = auth.uid() and v.status <> ''onaylandi''))))',
      t || '_all', t, t, t);
  end loop;
end $$;
