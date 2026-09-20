-- ============================================================
-- 0021 — CHECKLIST SAAT HATIRLATICISI
--
--   Bir checklist maddesine gün içinde bir saat yazılabilir.
--   Görevin bitiş gününde o saat geldiğinde, madde hâlâ
--   işaretlenmemişse, göreve atanan kişilere bildirim gider.
--
--   Kurallar:
--     • Saat yazmak ZORUNLU DEĞİL — boş bırakılan madde hiç hatırlatmaz.
--     • Her madde için GÜNDE EN FAZLA BİR kez hatırlatılır
--       (reminded_on alanı aynı gün tekrar göndermeyi engeller).
--     • Madde işaretlendiyse hatırlatma gitmez.
--     • Görev tamamlandı/iptal edildiyse hatırlatma gitmez.
--     • Saat Türkiye saatine göre değerlendirilir.
--
--   Bildirim, 0004'teki mevcut zamanlayıcının (fn_process_reminders)
--   içine eklenir; ayrı bir zamanlayıcı KURULMAZ. Web Push teslimi de
--   0004'teki mevcut /api/push işiyle aynı yoldan yapılır.
-- ============================================================

-- ---------- 0) BİLDİRİM TÜRÜ ----------
-- notifications.type bir enum'dur (0001). Yeni tür önce tanıma eklenmezse
-- hatırlatma yazılamaz ve hatırlatma motorunun TAMAMI geri alınır.
alter type notif_type add value if not exists 'checklist_reminder';


-- ---------- 1) ALANLAR ----------
alter table checklist_items
  add column if not exists remind_at time,           -- örn. 14:00 (boşsa hatırlatma yok)
  add column if not exists reminded_on date;         -- en son hangi gün hatırlatıldı

-- Hatırlatma taraması yalnızca saati olan maddelere baksın.
create index if not exists checklist_remind_idx
  on checklist_items (remind_at)
  where remind_at is not null and is_done = false;

comment on column checklist_items.remind_at is
  'Gün içinde hatırlatma saati (Europe/Istanbul). NULL ise hatırlatma yapılmaz.';
comment on column checklist_items.reminded_on is
  'Bu madde için en son hatırlatmanın gönderildiği gün — aynı gün tekrarı engeller.';


-- ---------- 2) HATIRLATMA MOTORU ----------
-- 0004'teki fonksiyonun tamamı yeniden tanımlanır; ilk dört adım
-- birebir aynıdır, sonuna (5) checklist saat hatırlatması eklenmiştir.
create or replace function fn_process_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  ist_now   timestamptz := now();
  ist_today date        := (now() at time zone 'Europe/Istanbul')::date;
  ist_clock time        := (now() at time zone 'Europe/Istanbul')::time;
begin
  -- 1) süresi geçmiş görevleri 'overdue' yap
  update tasks set status = 'overdue'
   where status in ('open','in_progress')
     and due_at is not null and due_at < ist_now;

  -- 2) 60 dakika içinde bitecekler → atananlara (görev+kişi başına bir kez)
  insert into notifications (company_id, user_id, type, payload)
  select t.company_id, ta.user_id, 'due_soon',
         jsonb_build_object('task_id', t.id, 'title', t.title)
    from tasks t
    join task_assignees ta on ta.task_id = t.id
   where t.status in ('open','in_progress')
     and t.due_at between ist_now and ist_now + interval '60 minutes'
     and not exists (
       select 1 from notifications n
        where n.type = 'due_soon' and n.user_id = ta.user_id
          and n.payload->>'task_id' = t.id::text);

  -- 3) süresi geçti → atananlara (görev+kişi başına bir kez)
  insert into notifications (company_id, user_id, type, payload)
  select t.company_id, ta.user_id, 'overdue',
         jsonb_build_object('task_id', t.id, 'title', t.title)
    from tasks t
    join task_assignees ta on ta.task_id = t.id
   where t.status = 'overdue'
     and not exists (
       select 1 from notifications n
        where n.type = 'overdue' and n.user_id = ta.user_id
          and n.payload->>'task_id' = t.id::text
          and coalesce(n.payload->>'escalated','false') = 'false');

  -- 4) 30+ dakikadır gecikmiş → müdürlere ve yöneticilere (bir kez)
  insert into notifications (company_id, user_id, type, payload)
  select t.company_id, x.user_id, 'overdue',
         jsonb_build_object('task_id', t.id, 'title', t.title, 'escalated', true)
    from tasks t
    join lateral (
      select dm.user_id
        from department_members dm
       where dm.department_id = t.department_id and dm.is_manager
      union
      select p.id from profiles p
       where p.company_id = t.company_id and p.role = 'admin'
    ) x on true
   where t.status = 'overdue'
     and t.due_at < ist_now - interval '30 minutes'
     and not exists (
       select 1 from notifications n
        where n.type = 'overdue' and n.user_id = x.user_id
          and n.payload->>'task_id' = t.id::text
          and n.payload->>'escalated' = 'true');

  -- ----------------------------------------------------------
  -- 5) YENİ: CHECKLIST SAAT HATIRLATMASI
  --    Saati gelmiş, hâlâ işaretlenmemiş maddeler için atananlara
  --    bildirim. Görevin bitiş günü bugünse çalışır; böylece ileri
  --    tarihli bir görevin maddesi bugünden hatırlatılmaz.
  --
  --    Zaman penceresi: saatin üzerinden 90 dakikadan fazla geçtiyse
  --    hatırlatma gönderilmez. Böylece saati çoktan geçmiş bir madde
  --    yazıldığı anda bildirim yağdırmaz; buna karşılık zamanlayıcı
  --    bir süre duraksasa bile hatırlatma kaçmaz.
  --
  --    KORUMA: Bu adım kendi hata kalkanı içindedir. Beklenmedik bir
  --    durumda yalnızca bu adım atlanır; yukarıdaki dört adım (gecikme
  --    takibi ve yönetici uyarıları) asla geri alınmaz.
  -- ----------------------------------------------------------
  begin
    with hedef as (
      select ci.id as item_id, ci.title as item_title,
             t.id as task_id, t.title as task_title, t.company_id
        from checklist_items ci
        join tasks t on t.id = ci.task_id
       where ci.remind_at is not null
         and ci.is_done = false
         and coalesce(ci.reminded_on, date '1900-01-01') < ist_today
         and ci.remind_at <= ist_clock
         -- gece yarısı taşmasın diye 01:30'dan önce pencere gün başına sabitlenir
         and ci.remind_at >= (case when ist_clock < time '01:30'
                                   then time '00:00'
                                   else ist_clock - interval '90 minutes' end)
         and t.status not in ('completed','cancelled')
         and t.due_at is not null
         and (t.due_at at time zone 'Europe/Istanbul')::date = ist_today
    ), gonderilen as (
      insert into notifications (company_id, user_id, type, payload)
      select h.company_id, ta.user_id, 'checklist_reminder',
             jsonb_build_object(
               'task_id', h.task_id,
               'title', h.task_title,
               'item_id', h.item_id,
               'item_title', h.item_title)
        from hedef h
        join task_assignees ta on ta.task_id = h.task_id
      returning 1
    )
    -- Atanan kişisi olmayan görevin maddesi de işaretlenir; aksi hâlde her
    -- turda yeniden taranır ve boşuna iş çıkarır.
    update checklist_items ci
       set reminded_on = ist_today
     where ci.id in (select item_id from hedef);
  exception when others then
    raise notice 'checklist hatirlatmasi atlandi: %', sqlerrm;
  end;
end $$;

revoke execute on function fn_process_reminders() from public;


-- ============================================================
-- KONTROL — zamanlayıcı gerçekten çalışıyor mu?
--   Aşağıdaki sorguyu ayrıca çalıştırıp iki satır görmelisiniz:
--     lole-reminders  */10 * * * *
--     lole-push       */10 * * * *
--
--     select jobname, schedule, active from cron.job;
--
--   Satır yoksa 0004_reminders.sql dosyasındaki iki 'cron.schedule'
--   komutu, YOUR_APP_URL ve YOUR_CRON_SECRET yerine gerçek değerler
--   yazılarak bir kez çalıştırılmalıdır. Uygulama adresi:
--     https://lole-yonetim.vercel.app
--   CRON_SECRET değeri Vercel ayarlarınızdadır — buraya yazmayın,
--   yalnızca SQL kutusuna yapıştırırken kullanın.
-- ============================================================
