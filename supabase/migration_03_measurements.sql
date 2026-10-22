-- ============================================================
-- Миграция 3: характеристики (замеры помесячно) + фото формы
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

-- 1. Замеры: одна запись на месяц (последний день не важен — храним первое число месяца)
create table if not exists measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  month date not null,
  weight numeric(6,2),
  height numeric(6,2),
  bicep_l numeric(6,2),
  bicep_r numeric(6,2),
  shoulders numeric(6,2),
  chest numeric(6,2),
  thigh_l numeric(6,2),
  thigh_r numeric(6,2),
  waist numeric(6,2),
  calf_l numeric(6,2),
  calf_r numeric(6,2),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists measurements_user_idx on measurements(user_id);

alter table measurements enable row level security;

-- Читать свои; тренер — читает замеры своих подтверждённых подопечных
create policy "measurements: read own or coach" on measurements for select
  using (user_id = auth.uid() or has_active_coach(user_id));

-- Писать может только сам пользователь (тренер подопечного — не может)
create policy "measurements: write own" on measurements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Фото формы: сколько угодно фото на месяц
create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  month date not null,
  url text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_user_idx on progress_photos(user_id, month);

alter table progress_photos enable row level security;

create policy "progress_photos: read own or coach" on progress_photos for select
  using (user_id = auth.uid() or has_active_coach(user_id));

create policy "progress_photos: write own" on progress_photos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Бакет для фото формы (публичное чтение, запись в свою папку uid/)
insert into storage.buckets (id, name, public)
values ('progress', 'progress', true)
on conflict (id) do update set public = true;

drop policy if exists "progress: read public" on storage.objects;
drop policy if exists "progress: upload own" on storage.objects;
drop policy if exists "progress: update own" on storage.objects;
drop policy if exists "progress: delete own" on storage.objects;

create policy "progress: read public" on storage.objects for select
  using (bucket_id = 'progress');

create policy "progress: upload own" on storage.objects for insert
  with check (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "progress: update own" on storage.objects for update
  using (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "progress: delete own" on storage.objects for delete
  using (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
