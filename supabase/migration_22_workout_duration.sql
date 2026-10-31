-- Длительность тренировки, минуты
alter table workouts add column if not exists duration_min int check (duration_min between 1 and 600);
