-- ============================================================
-- Миграция 25: ручная правка БЖУ (самим пользователем или тренером)
-- Если все три значения заданы — они заменяют расчётные; калории
-- считаются из них (Б×4 + Ж×9 + У×4). Пусто — норма считается по анкете.
-- Идемпотентная: можно выполнять повторно. Нужна migration_16.
-- ============================================================

alter table nutrition_plans
  add column if not exists custom_protein_g int,
  add column if not exists custom_fat_g int,
  add column if not exists custom_carbs_g int;

-- Либо все три пустые, либо все три заданы (0–999 г)
alter table nutrition_plans drop constraint if exists nutrition_plans_custom_macros_chk;
alter table nutrition_plans add constraint nutrition_plans_custom_macros_chk check (
  num_nonnulls(custom_protein_g, custom_fat_g, custom_carbs_g) in (0, 3)
  and coalesce(custom_protein_g, 0) between 0 and 999
  and coalesce(custom_fat_g, 0) between 0 and 999
  and coalesce(custom_carbs_g, 0) between 0 and 999
);

-- Тренер может обновлять анкету своего подтверждённого подопечного.
-- Менять он должен только custom_* — это гарантирует приложение (saveMacros).
drop policy if exists "nutrition_plans: coach update" on nutrition_plans;
create policy "nutrition_plans: coach update" on nutrition_plans for update
  using (has_active_coach(user_id)) with check (has_active_coach(user_id));
