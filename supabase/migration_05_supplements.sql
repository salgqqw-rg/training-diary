-- ============================================================
-- Миграция 5: добавки, БАДы и курсы ААС
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

create table if not exists supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'supplement' check (kind in ('supplement', 'bac', 'course')),
  name text not null check (char_length(name) between 1 and 100),
  dosage text check (char_length(dosage) <= 100),
  start_date date,
  end_date date,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists supplements_user_idx on supplements(user_id);

alter table supplements enable row level security;

-- Читать свои; тренер — своих подтверждённых подопечных
create policy "supplements: read own or coach" on supplements for select
  using (user_id = auth.uid() or has_active_coach(user_id));

-- Писать может только сам пользователь
create policy "supplements: write own" on supplements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
