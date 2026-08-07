-- 0013 — satın alma ve ödeme taleplerine "bitirildi" durumu
alter table purchase_requests drop constraint if exists purchase_requests_status_check;
alter table purchase_requests add constraint purchase_requests_status_check
  check (status in ('pending','approved','rejected','cancelled','completed'));

alter table payment_requests drop constraint if exists payment_requests_status_check;
alter table payment_requests add constraint payment_requests_status_check
  check (status in ('pending','approved','rejected','cancelled','completed'));
