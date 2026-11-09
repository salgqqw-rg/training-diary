-- ============================================================
-- Миграция 28: вода за день и отметки «принял» у добавок
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

-- Вода хранится в той же строке дня, что сон и шаги
alter table daily_logs add column if not exists water_ml int check (water_ml >= 0 and water_ml <= 20000);

-- Отметка «принял» на конкретный день (нет строки — не принял)
create table if not exists supplement_checks (
  supplement_id uuid not null references supplements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (supplement_id, log_date)
);

create index if not exists supplement_checks_user_date_idx on supplement_checks(user_id, log_date);

alter table supplement_checks enable row level security;

drop policy if exists "supplement_checks: read own or coach" on supplement_checks;
create policy "supplement_checks: read own or coach" on supplement_checks for select
  using (user_id = auth.uid() or has_active_coach(user_id));

drop policy if exists "supplement_checks: write own" on supplement_checks;
-- Отметить можно только свою добавку
create policy "supplement_checks: write own" on supplement_checks for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from supplements s where s.id = supplement_id and s.user_id = auth.uid())
  );
