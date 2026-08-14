-- 0015 — yıllık izin hakkı (gün) — bakiye takibi için
alter table profiles add column if not exists leave_allowance int not null default 14;
