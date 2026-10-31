-- После «Сохранить подходы» строки блокируются от правок и удаления
alter table workout_sets add column if not exists locked boolean not null default false;
