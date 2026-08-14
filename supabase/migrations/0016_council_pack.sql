-- 0016 — Meclis paketi: belge geçerlilik tarihi + vardiya çakışma kısıtı

-- 1) Dosyalara geçerlilik tarihi (sağlık raporu / sertifika takibi)
alter table documents add column if not exists valid_until date;

-- 2) Aynı kişiye çakışan saatlerde iki vardiya yazılamaz (DB seviyesi garanti)
create extension if not exists btree_gist;
alter table shifts drop constraint if exists shifts_no_overlap;
alter table shifts add constraint shifts_no_overlap
  exclude using gist (user_id with =, tstzrange(starts_at, ends_at) with &&);
