-- 0011 — şirket listesi herkese görünür (adlar/renkler; veriler yine izole kalır)
drop policy if exists companies_select on companies;
create policy companies_select on companies for select
  using (auth.uid() is not null);
