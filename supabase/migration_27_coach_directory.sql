-- ============================================================
-- Миграция 27: каталог тренеров (идемпотентная)
-- Выполнить ПОСЛЕ миграции 26. Не запускайте после неё заново
-- schema.sql и migration_01: они вернут старые правила coach_links.
-- ============================================================

-- 1. Анкета тренера. Видна всем вошедшим, только если тренер включил «показывать в каталоге»
create table if not exists coach_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  about text not null default '' check (char_length(about) <= 1500),
  specialties text not null default '' check (char_length(specialties) <= 200),
  experience_years int check (experience_years between 0 and 60),
  format text not null default 'both' check (format in ('online', 'offline', 'both')),
  price text not null default '' check (char_length(price) <= 100),
  photo_url text,
  city text not null default '' check (char_length(city) <= 60),
  listed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- на случай, если таблица уже создана раньше
alter table coach_profiles add column if not exists photo_url text;
alter table coach_profiles add column if not exists city text not null default '' check (char_length(city) <= 60);

alter table coach_profiles enable row level security;

drop policy if exists "coach_profiles: read listed or own" on coach_profiles;
drop policy if exists "coach_profiles: write own" on coach_profiles;

create policy "coach_profiles: read listed or own" on coach_profiles for select to authenticated
  using (listed or user_id = auth.uid());

create policy "coach_profiles: write own" on coach_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Заявку теперь может отправить и подопечный (через каталог).
-- requested_by — кто отправил; подтверждает всегда ДРУГАЯ сторона.
alter table coach_links add column if not exists requested_by uuid references profiles(id) on delete cascade;
update coach_links set requested_by = coach_id where requested_by is null;
alter table coach_links alter column requested_by set not null;
alter table coach_links alter column requested_by set default auth.uid();

alter table coach_links add column if not exists note text;
alter table coach_links drop constraint if exists coach_links_note_chk;
alter table coach_links add constraint coach_links_note_chk check (note is null or char_length(note) <= 500);

alter table coach_links drop constraint if exists coach_links_requested_by_chk;
alter table coach_links add constraint coach_links_requested_by_chk check (requested_by in (coach_id, trainee_id));

-- Отправить заявку: тренер — любому, подопечный — только тренеру с включённой анкетой
drop policy if exists "coach_links: coach invites" on coach_links;
drop policy if exists "coach_links: send request" on coach_links;
create policy "coach_links: send request" on coach_links for insert
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and (
      coach_id = auth.uid()
      or (
        trainee_id = auth.uid()
        and exists (select 1 from coach_profiles p where p.user_id = coach_id and p.listed)
      )
    )
  );

-- Принять заявку может только сторона, которая её НЕ отправляла
drop policy if exists "coach_links: trainee answers" on coach_links;
drop policy if exists "coach_links: coach answers" on coach_links;
create policy "coach_links: trainee answers" on coach_links for update
  using (trainee_id = auth.uid() and status = 'pending' and requested_by = coach_id)
  with check (trainee_id = auth.uid() and status in ('pending', 'active'));
create policy "coach_links: coach answers" on coach_links for update
  using (coach_id = auth.uid() and status = 'pending' and requested_by = trainee_id)
  with check (coach_id = auth.uid() and status in ('pending', 'active'));

-- Менять в связи можно только статус: иначе можно подменить requested_by и принять свою же заявку
revoke update on coach_links from anon, authenticated;
grant update (status) on coach_links to authenticated;
