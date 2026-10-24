-- Миграция 11: тренер может составлять тренировочные планы (циклы) подопечному.
-- Цикл создаётся с user_id = подопечный и created_by = тренер, поэтому он
-- автоматически появляется в дневнике подопечного.

alter table cycles add column if not exists created_by uuid references profiles(id) on delete set null;

-- Право на содержимое цикла: владелец, автор-тренер или тренер с активной связью
create or replace function can_edit_cycle(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cycles c
    where c.id = cid
      and (
        c.user_id = auth.uid()
        or c.created_by = auth.uid()
        or exists (
          select 1 from coach_links l
          where l.coach_id = auth.uid() and l.trainee_id = c.user_id and l.status = 'active'
        )
      )
  );
$$;

-- Циклы: создание себе или активному подопечному
drop policy if exists "cycles: write own" on cycles;
drop policy if exists "cycles: insert own or trainee" on cycles;

create policy "cycles: insert own or trainee" on cycles for insert
  with check (user_id = auth.uid() or has_active_coach(user_id));

create policy "cycles: update own or author" on cycles for update
  using (user_id = auth.uid() or created_by = auth.uid())
  with check (user_id = auth.uid() or created_by = auth.uid());

create policy "cycles: delete own or author" on cycles for delete
  using (user_id = auth.uid() or created_by = auth.uid());

-- Контент цикла (тренировки, упражнения, подходы): владелец или его тренер
drop policy if exists "workouts: write own" on workouts;
drop policy if exists "workouts: write" on workouts;
create policy "workouts: write" on workouts for all
  using (can_edit_cycle(cycle_id)) with check (can_edit_cycle(cycle_id));

drop policy if exists "exercises: write own" on exercises;
drop policy if exists "exercises: write" on exercises;
create policy "exercises: write" on exercises for all
  using (can_edit_cycle(cycle_id)) with check (can_edit_cycle(cycle_id));

drop policy if exists "sets: write own" on workout_sets;
drop policy if exists "sets: write" on workout_sets;
create policy "sets: write" on workout_sets for all
  using (can_edit_cycle(cycle_id)) with check (can_edit_cycle(cycle_id));
