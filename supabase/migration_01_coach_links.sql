-- ============================================================
-- Миграция: связь «тренер — подопечный» (идемпотентная)
-- Можно выполнять повторно: существующие объекты пропускаются
-- и дозаявляются недостающие политики и функции.
-- ============================================================

-- 1. Email в профиле: нужен тренеру, чтобы найти подопечного по email
alter table profiles add column if not exists email text;

-- Разовое заполнение email из auth.users (не трогает уже заполненные)
update profiles p
set email = (select u.email from auth.users u where u.id = p.id)
where p.email is null;

create unique index if not exists profiles_email_idx on profiles (lower(email)) where email is not null;

-- 2. Таблица связей: coach_id (тренер) -> trainee_id (подопечный)
create table if not exists coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  trainee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  unique (coach_id, trainee_id),
  check (coach_id <> trainee_id)
);

create index if not exists coach_links_coach_idx on coach_links(coach_id);
create index if not exists coach_links_trainee_idx on coach_links(trainee_id);

alter table coach_links enable row level security;

-- 3. Политики на coach_links (пересоздаём, чтобы гарантировать актуальные правила)
drop policy if exists "coach_links: read own side" on coach_links;
drop policy if exists "coach_links: coach invites" on coach_links;
drop policy if exists "coach_links: trainee answers" on coach_links;
drop policy if exists "coach_links: remove any side" on coach_links;
drop policy if exists "coach_links: delete" on coach_links;
drop policy if exists "coach_links: update" on coach_links;
drop policy if exists "coach_links: insert" on coach_links;
drop policy if exists "coach_links: select" on coach_links;

-- Видят только свои связи
create policy "coach_links: read own side" on coach_links for select
  using (coach_id = auth.uid() or trainee_id = auth.uid());

-- Тренер отправляет заявку
create policy "coach_links: coach invites" on coach_links for insert
  with check (coach_id = auth.uid());

-- Подопечный подтверждает заявку (pending -> active)
create policy "coach_links: trainee answers" on coach_links for update
  using (trainee_id = auth.uid() and status = 'pending')
  with check (trainee_id = auth.uid() and status in ('pending', 'active'));

-- Разорвать связь может любая из сторон
create policy "coach_links: remove any side" on coach_links for delete
  using (coach_id = auth.uid() or trainee_id = auth.uid());

-- 4. Подтверждённый тренер связан с подопечным uid?
create or replace function has_active_coach(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_links
    where trainee_id = uid and coach_id = auth.uid() and status = 'active'
  );
$$;

-- 5. Право чтения цикла: сам владелец, публичный ИЛИ его подтверждённый тренер
create or replace function can_read_cycle(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cycles
    where id = cid
      and (user_id = auth.uid() or is_public or has_active_coach(user_id))
  );
$$;

-- 6. Циклы подопечного видны его подтверждённому тренеру
drop policy if exists "cycles: read own or public" on cycles;
drop policy if exists "cycles: read own" on cycles;
drop policy if exists "cycles: read own, public or coach" on cycles;
create policy "cycles: read own, public or coach" on cycles for select
  using (user_id = auth.uid() or is_public or has_active_coach(user_id));

-- 7. Email указывается при регистрации (подопечных ищут по нему)
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
