-- ============================================================
-- Миграция 16: анкета цели (набор / сброс / поддержание веса)
-- Норма калорий и БЖУ считается в приложении из этих данных и
-- последнего замера веса, поэтому сама норма в базе не хранится.
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

create table if not exists nutrition_plans (
  user_id uuid primary key references profiles(id) on delete cascade,
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null,
  height_cm numeric(5,1) not null check (height_cm between 100 and 250),
  start_weight_kg numeric(5,1) not null check (start_weight_kg between 30 and 300),
  goal_weight_kg numeric(5,1) not null check (goal_weight_kg between 30 and 300),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  pace_kg_week numeric(3,2) not null default 0.5 check (pace_kg_week between 0 and 1),
  start_date date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table nutrition_plans enable row level security;

drop policy if exists "nutrition_plans: read own or coach" on nutrition_plans;
drop policy if exists "nutrition_plans: write own" on nutrition_plans;

-- Читать свою; тренер — своих подтверждённых подопечных
create policy "nutrition_plans: read own or coach" on nutrition_plans for select
  using (user_id = auth.uid() or has_active_coach(user_id));

-- Писать может только сам пользователь
create policy "nutrition_plans: write own" on nutrition_plans for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
