-- ============================================================
-- Миграция 10: ответы на сообщения в чате
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

alter table messages add column if not exists reply_to uuid
  references messages(id) on delete set null;

create index if not exists messages_reply_to_idx on messages(reply_to);
