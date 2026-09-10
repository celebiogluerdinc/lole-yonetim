-- ============================================================
-- 0020 — OLAY KAYDINA FOTOĞRAF
--   Olay raporuna fotoğraf eklenebilir. Fotoğraflar tıpkı kaydın
--   kendisi gibi YALNIZCA admin ve süper yönetici tarafından görülür;
--   yükleyen kişi kendi eklediklerini görür.
--   Dosyalar mevcut özel "attachments" kovasında saklanır; yol
--   <company_id>/incidents/<incident_id>/<dosya> biçimindedir ki
--   0002'deki depolama kuralı (ilk klasör = şirket) aynen geçerli olsun.
-- ============================================================

create table if not exists incident_photos (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists incph_incident_idx on incident_photos(incident_id, created_at);

alter table incident_photos enable row level security;

-- GÖRÜNÜRLÜK: olay kaydının kendisiyle birebir aynı kural.
drop policy if exists incph_select on incident_photos;
create policy incph_select on incident_photos for select
  using (is_super_admin() or uploaded_by = auth.uid());

-- EKLEME: yalnızca kaydın sahibi (raporu yazan) ya da yönetici fotoğraf ekleyebilir
-- ve dosya yolu ilgili olayın klasörünü göstermek zorundadır. Böylece doğrudan
-- veritabanına istek atarak başka bir olaya sahte fotoğraf iliştirilemez.
drop policy if exists incph_insert on incident_photos;
create policy incph_insert on incident_photos for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from incidents i
      where i.id = incident_photos.incident_id
        and i.company_id = incident_photos.company_id
        and (is_super_admin() or i.reporter_id = auth.uid())
    )
    and storage_path like company_id::text || '/incidents/' || incident_id::text || '/%'
  );

drop policy if exists incph_delete on incident_photos;
create policy incph_delete on incident_photos for delete
  using (is_super_admin() or uploaded_by = auth.uid());

-- ------------------------------------------------------------
-- DOSYANIN KENDİSİ
--   Tablo kuralı satırı gizler ama dosya "attachments" kovasında durur ve
--   0002'deki kural bu kovayı şirketin TÜM personeline açar. Olay fotoğrafları
--   bu genel kuralın dışında tutulur: yalnızca yönetici ya da dosyayı
--   yükleyen kişi görebilir. (Kısıtlayıcı kural, mevcut kurallarla VE'lenir.)
-- ------------------------------------------------------------
do $$
begin
  execute 'drop policy if exists lole_incident_photo_guard on storage.objects';
  execute 'create policy lole_incident_photo_guard on storage.objects '
       || 'as restrictive for select to authenticated using ('
       || '  bucket_id <> ''attachments'''
       || '  or coalesce((storage.foldername(name))[2], '''') <> ''incidents'''
       || '  or is_super_admin()'
       || '  or owner = auth.uid())';
exception when insufficient_privilege then
  raise notice 'storage.objects politikasi atlandi (yetki yok): %', sqlerrm;
end $$;

-- Müşteri hesapları olay kaydına hiçbir şekilde erişemez (0018 ile aynı çizgi).
drop policy if exists lole_cust_block_incident_photos on incident_photos;
create policy lole_cust_block_incident_photos on incident_photos
  as restrictive for all to authenticated
  using ((select not auth_is_customer()))
  with check ((select not auth_is_customer()));
