-- Библиотека упражнений: свои упражнения пользователя и его фото/видео к встроенным.
-- Встроенный каталог лежит в коде (src/lib/exercise-catalog.ts), в базе только то, что добавил человек.

create table if not exists user_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  base_key text,                       -- slug встроенного упражнения; null = своё упражнение
  name text not null check (char_length(name) between 1 and 100),
  muscle text not null default 'chest'
    check (muscle in ('chest','back','shoulders','traps','biceps','triceps','forearms','abs','quads','hamstrings','glutes','calves','cardio')),
  kind text not null default 'base' check (kind in ('base','isolation')),
  equipment text check (char_length(equipment) <= 60),
  description text check (char_length(description) <= 3000),
  image_url text check (char_length(image_url) <= 1000),
  video_url text check (char_length(video_url) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- одно «переопределение» медиа на встроенное упражнение
create unique index if not exists user_exercises_base_uniq
  on user_exercises (owner_id, base_key) where base_key is not null;
create index if not exists user_exercises_owner_idx on user_exercises (owner_id);

alter table user_exercises enable row level security;

drop policy if exists "user_exercises: own" on user_exercises;
create policy "user_exercises: own" on user_exercises for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Бакет для фото и видео упражнений (публичное чтение, запись в свою папку uid/)
insert into storage.buckets (id, name, public, file_size_limit)
values ('exercises', 'exercises', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "exercises: read public" on storage.objects;
drop policy if exists "exercises: upload own" on storage.objects;
drop policy if exists "exercises: update own" on storage.objects;
drop policy if exists "exercises: delete own" on storage.objects;

create policy "exercises: read public" on storage.objects for select
  using (bucket_id = 'exercises');

create policy "exercises: upload own" on storage.objects for insert
  with check (bucket_id = 'exercises' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "exercises: update own" on storage.objects for update
  using (bucket_id = 'exercises' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'exercises' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "exercises: delete own" on storage.objects for delete
  using (bucket_id = 'exercises' and (storage.foldername(name))[1] = auth.uid()::text);
