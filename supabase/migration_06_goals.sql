-- ============================================================
-- Миграция 6: постановка целей
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 150),
  details text check (char_length(details) <= 500),
  due_date date,
  status text not null default 'active' check (status in ('active', 'done', 'dropped')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists goals_user_idx on goals(user_id);

alter table goals enable row level security;

-- Читать свои; тренер — своих подтверждённых подопечных
create policy "goals: read own or coach" on goals for select
  using (user_id = auth.uid() or has_active_coach(user_id));

-- Писать может только сам пользователь
create policy "goals: write own" on goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
