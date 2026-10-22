-- Профили: создаются автоматически при регистрации
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create unique index profiles_email_idx on profiles (lower(email)) where email is not null;

create table cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  weeks_count int not null check (weeks_count between 1 and 52),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id) on delete cascade,
  week_number int not null check (week_number >= 1),
  workout_date date,
  note text,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  set_number int not null check (set_number >= 1),
  weight numeric(6,2) not null default 0 check (weight >= 0),
  reps int not null default 0 check (reps >= 0),
  rir int check (rir between 0 and 10),
  rpe numeric(3,1) check (rpe between 1 and 10),
  created_at timestamptz not null default now()
);

create table coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  trainee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  unique (coach_id, trainee_id),
  check (coach_id <> trainee_id)
);

create index on cycles(user_id);
create index on cycles(is_public);
create index on workouts(cycle_id);
create index on exercises(workout_id);
create index on workout_sets(exercise_id);
create index on coach_links(coach_id);
create index on coach_links(trainee_id);
create index on measurements(user_id);
create index on progress_photos(user_id, month);

create table measurements (
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

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  month date not null,
  url text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  log_date date not null,
  sleep_h numeric(4,1),
  steps int check (steps >= 0),
  kcal numeric(8,1),
  protein_g numeric(6,1),
  fat_g numeric(6,1),
  carbs_g numeric(6,1),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'supplement' check (kind in ('supplement', 'bac', 'course')),
  name text not null check (char_length(name) between 1 and 100),
  dosage text check (char_length(dosage) <= 100),
  start_date date,
  end_date date,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 150),
  details text check (char_length(details) <= 500),
  due_date date,
  status text not null default 'active' check (status in ('active', 'done', 'dropped')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body text check ((body is not null and char_length(body) between 1 and 2000) or image_path is not null),
  image_path text,
  image_url text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index on daily_logs(user_id);
create index on supplements(user_id);
create index on goals(user_id);
create index on messages(sender_id, recipient_id);
create index on messages(recipient_id, read_at);

-- Вспомогательные функции для правил доступа
create or replace function owns_cycle(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cycles where id = cid and user_id = auth.uid());
$$;

-- Подтверждённый тренер связан с подопечным uid?
create or replace function has_active_coach(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_links
    where trainee_id = uid and coach_id = auth.uid() and status = 'active'
  );
$$;

-- Право чтения: владелец, публичный цикл ИЛИ подтверждённый тренер владельца
create or replace function can_read_cycle(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cycles
    where id = cid
      and (user_id = auth.uid() or is_public or has_active_coach(user_id))
  );
$$;

alter table profiles enable row level security;
alter table cycles enable row level security;
alter table workouts enable row level security;
alter table exercises enable row level security;
alter table workout_sets enable row level security;
alter table coach_links enable row level security;
alter table measurements enable row level security;
alter table progress_photos enable row level security;
alter table daily_logs enable row level security;
alter table supplements enable row level security;
alter table goals enable row level security;
alter table messages enable row level security;

-- Профили видны всем, менять можно только свой
create policy "profiles: read all" on profiles for select using (true);
create policy "profiles: update own" on profiles for update using (id = auth.uid());

-- Циклы: читать свои, публичные и подопечных; писать только свои
create policy "cycles: read own, public or coach" on cycles for select
  using (user_id = auth.uid() or is_public or has_active_coach(user_id));
create policy "cycles: write own" on cycles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Всё внутри цикла следует правилам самого цикла
create policy "workouts: read" on workouts for select using (can_read_cycle(cycle_id));
create policy "workouts: write own" on workouts for all
  using (owns_cycle(cycle_id)) with check (owns_cycle(cycle_id));

create policy "exercises: read" on exercises for select using (can_read_cycle(cycle_id));
create policy "exercises: write own" on exercises for all
  using (owns_cycle(cycle_id)) with check (owns_cycle(cycle_id));

create policy "sets: read" on workout_sets for select using (can_read_cycle(cycle_id));
create policy "sets: write own" on workout_sets for all
  using (owns_cycle(cycle_id)) with check (owns_cycle(cycle_id));

-- Связь «тренер — подопечный»: заявка от тренера, подтверждение подопечным
create policy "coach_links: read own side" on coach_links for select
  using (coach_id = auth.uid() or trainee_id = auth.uid());
create policy "coach_links: coach invites" on coach_links for insert
  with check (coach_id = auth.uid());
create policy "coach_links: trainee answers" on coach_links for update
  using (trainee_id = auth.uid() and status = 'pending')
  with check (trainee_id = auth.uid() and status in ('pending', 'active'));
create policy "coach_links: remove any side" on coach_links for delete
  using (coach_id = auth.uid() or trainee_id = auth.uid());

-- Характеристики: читать свои или тренеру; писать только себе
create policy "measurements: read own or coach" on measurements for select
  using (user_id = auth.uid() or has_active_coach(user_id));
create policy "measurements: write own" on measurements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Фото формы: читать свои или тренеру; писать только себе
create policy "progress_photos: read own or coach" on progress_photos for select
  using (user_id = auth.uid() or has_active_coach(user_id));
create policy "progress_photos: write own" on progress_photos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Дневной лог (сон, шаги, БЖУ): читать свои или тренеру; писать только себе
create policy "daily_logs: read own or coach" on daily_logs for select
  using (user_id = auth.uid() or has_active_coach(user_id));
create policy "daily_logs: write own" on daily_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Добавки / БАДы / курсы ААС: читать свои или тренеру; писать только себе
create policy "supplements: read own or coach" on supplements for select
  using (user_id = auth.uid() or has_active_coach(user_id));
create policy "supplements: write own" on supplements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Цели: читать свои или тренеру; писать только себе
create policy "goals: read own or coach" on goals for select
  using (user_id = auth.uid() or has_active_coach(user_id));
create policy "goals: write own" on goals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Личные сообщения: только участники переписки между связанными аккаунтами
-- Личные сообщения: только участники переписки между связанными аккаунтами
create policy "messages: read own dialogs" on messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages: send to linked only" on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from coach_links l
      where l.status = 'active' and (
        (l.coach_id = auth.uid() and l.trainee_id = recipient_id)
        or (l.trainee_id = auth.uid() and l.coach_id = recipient_id)
      )
    )
  );
create policy "messages: recipient marks read" on messages for update
  using (recipient_id = auth.uid() and read_at is null)
  with check (recipient_id = auth.uid() and read_at is not null);

-- Профиль создаётся сразу при регистрации
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ Аватары (Storage) ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars: read public" on storage.objects;
drop policy if exists "avatars: upload own" on storage.objects;
drop policy if exists "avatars: update own" on storage.objects;
drop policy if exists "avatars: delete own" on storage.objects;

-- Чтение публичное, запись — только в свою папку uid/
create policy "avatars: read public" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: upload own" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: update own" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: delete own" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ Фото в чате (Storage) ============
insert into storage.buckets (id, name, public)
values ('chat', 'chat', true)
on conflict (id) do update set public = true;

drop policy if exists "chat: read public" on storage.objects;
drop policy if exists "chat: upload own" on storage.objects;
drop policy if exists "chat: update own" on storage.objects;
drop policy if exists "chat: delete own" on storage.objects;

create policy "chat: read public" on storage.objects for select
  using (bucket_id = 'chat');

create policy "chat: upload own" on storage.objects for insert
  with check (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat: update own" on storage.objects for update
  using (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat: delete own" on storage.objects for delete
  using (
    bucket_id = 'chat'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
