-- 0003 — chat fixes
-- Allows super admins (whose profile has no company_id) to send messages
-- inside whichever company they are acting in.

drop policy if exists msg_insert on messages;
create policy msg_insert on messages for insert with check (
  sender_id = auth.uid()
  and is_conversation_member(conversation_id)
  and (is_super_admin() or company_id = auth_company_id())
);
