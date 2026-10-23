-- ============================================================
-- Миграция 9: замеры по дате (вместо «за месяц»)
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

-- Новая колонка с конкретной датой замера
alter table measurements add column if not exists measured_on date;
update measurements set measured_on = month where measured_on is null;
alter table measurements alter column measured_on set not null;

-- Одна запись на пользователя и дату (вместо пользователя и месяца)
alter table measurements drop constraint if exists measurements_user_id_month_key;
alter table measurements drop constraint if exists measurements_user_id_measured_on_key;
alter table measurements add constraint measurements_user_id_measured_on_key
  unique (user_id, measured_on);
