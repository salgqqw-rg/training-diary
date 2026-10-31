-- Запросы и RLS-политики фильтруют по cycle_id, а индекса на нём не было (полный перебор таблицы).
create index if not exists workout_sets_cycle_id_idx on workout_sets(cycle_id);
create index if not exists exercises_cycle_id_idx on exercises(cycle_id);
create index if not exists workouts_cycle_date_idx on workouts(cycle_id, workout_date);
