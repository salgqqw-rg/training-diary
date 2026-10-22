-- ============================================================
-- Миграция 4: дневной лог (сон, шаги, питание и БЖУ)
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

-- Одна запись на день на пользователя
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  log_date date not null,
  sleep_h numeric(4,1),          -- сон, часов
  steps int check (steps >= 0),  -- шаги
  kcal numeric(8,1),             -- калории
  protein_g numeric(6,1),        -- белки, г
  fat_g numeric(6,1),            -- жиры, г
  carbs_g numeric(6,1),          -- углеводы, г
  note text,                     -- что ел / заметка (необязательно)
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_logs_user_idx on daily_logs(user_id);

alter table daily_logs enable row level security;

-- Читать свои; тренер — своих подтверждённых подопечных
create policy "daily_logs: read own or coach" on daily_logs for select
  using (user_id = auth.uid() or has_active_coach(user_id));

-- Писать может только сам пользователь
create policy "daily_logs: write own" on daily_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
