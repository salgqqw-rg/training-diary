-- Время отдыха после подхода, секунды
alter table workout_sets add column if not exists rest_sec int check (rest_sec between 0 and 3600);
