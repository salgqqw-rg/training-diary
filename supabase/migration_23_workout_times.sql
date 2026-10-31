-- Время начала и окончания тренировки (длительность и чистое время считаются на сайте)
alter table workouts add column if not exists start_time time;
alter table workouts add column if not exists end_time time;
