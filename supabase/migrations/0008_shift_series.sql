-- 0008 — tekrarlayan vardiya serileri
alter table shifts add column if not exists series_id uuid;
create index if not exists shifts_series_idx on shifts(series_id);
