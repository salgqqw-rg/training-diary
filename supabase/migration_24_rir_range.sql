-- Диапазон RIR: rir — нижняя граница (по ней считается аналитика), rir_max — верхняя (null, если RIR одним числом)
alter table workout_sets add column if not exists rir_max int check (rir_max between 0 and 10);
