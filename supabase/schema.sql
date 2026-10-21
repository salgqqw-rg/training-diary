-- Профили: создаются автоматически при регистрации
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

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

create index on cycles(user_id);
create index on cycles(is_public);
create index on workouts(cycle_id);
create index on exercises(workout_id);
create index on workout_sets(exercise_id);

-- Вспомогательные функции для правил доступа
create or replace function owns_cycle(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cycles where id = cid and user_id = auth.uid());
$$;

create or replace function can_read_cycle(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cycles where id = cid and (user_id = auth.uid() or is_public));
$$;

alter table profiles enable row level security;
alter table cycles enable row level security;
alter table workouts enable row level security;
alter table exercises enable row level security;
alter table workout_sets enable row level security;

-- Профили видны всем, менять можно только свой
create policy "profiles: read all" on profiles for select using (true);
create policy "profiles: update own" on profiles for update using (id = auth.uid());

-- Циклы: читать свои и публичные, писать только свои
create policy "cycles: read own or public" on cycles for select
  using (user_id = auth.uid() or is_public);
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

-- Профиль создаётся сразу при регистрации
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
