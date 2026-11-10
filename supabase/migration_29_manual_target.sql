-- ============================================================
-- Миграция 29: дневная норма, заданная вручную (самим человеком или его тренером)
-- Не требует анкеты цели. Если строка есть, она главнее расчёта по анкете
-- и прежней ручной правки БЖУ из миграции 25.
-- Идемпотентная: можно выполнять повторно. Нужны migration_01 (has_active_coach) и migration_02 (profiles).
-- ============================================================

create table if not exists nutrition_targets (
  user_id uuid primary key references profiles(id) on delete cascade,
  kcal int not null check (kcal between 500 and 10000),
  protein_g int check (protein_g between 0 and 999),
  fat_g int check (fat_g between 0 and 999),
  carbs_g int check (carbs_g between 0 and 999),
  set_by uuid not null references profiles(id) on delete cascade, -- кто задал: сам человек или тренер
  updated_at timestamptz not null default now(),
  -- БЖУ — все три или ни одного
  check (num_nonnulls(protein_g, fat_g, carbs_g) in (0, 3))
);

alter table nutrition_targets enable row level security;

drop policy if exists "nutrition_targets: read own or coach" on nutrition_targets;
create policy "nutrition_targets: read own or coach" on nutrition_targets for select
  using (user_id = auth.uid() or has_active_coach(user_id));

-- Писать может сам человек или его подтверждённый тренер; в set_by всегда тот, кто пишет
drop policy if exists "nutrition_targets: write own or coach" on nutrition_targets;
create policy "nutrition_targets: write own or coach" on nutrition_targets for all
  using (user_id = auth.uid() or has_active_coach(user_id))
  with check ((user_id = auth.uid() or has_active_coach(user_id)) and set_by = auth.uid());
