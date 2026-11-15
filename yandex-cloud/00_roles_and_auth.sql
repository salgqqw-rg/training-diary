-- ============================================================
-- Шаг 1 из 3. Роли и «учётная часть» для работы без Supabase.
-- Выполнять в пустой базе Managed PostgreSQL под владельцем базы, ДО импорта схемы и данных.
--
--   psql "$DATABASE_URL" -v authenticator_password=придумайте-пароль -f 00_roles_and_auth.sql
--
-- Что создаётся:
--  * роли anon / authenticated / service_role (без входа) и authenticator (под ним ходит PostgREST);
--  * схема auth: таблица users (id, email — на неё ссылается profiles), identities (привязка к Яндексу / VK)
--    и функции auth.uid() / auth.role() / auth.jwt(), которые используют правила доступа (RLS);
--  * заглушка схемы storage: нужна только чтобы прошли старые миграции с бакетами; файлы лежат в Object Storage.
-- ============================================================

-- ---------- роли ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit; end if;
end $$;

-- authenticator: логин для PostgREST; сам прав не имеет, а переключается в роль из токена
select format('create role authenticator login noinherit password %L', :'authenticator_password')
where not exists (select 1 from pg_roles where rolname = 'authenticator')
\gexec
grant anon, authenticated, service_role to authenticator;

-- как в Supabase: новые таблицы и функции схемы public доступны ролям (доступ к строкам ограничивает RLS)
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- ---------- схема auth ----------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists auth_users_email_idx on auth.users (lower(email)) where email is not null;

-- вход через внешнего провайдера: (провайдер, id у провайдера) -> наш пользователь
create table if not exists auth.identities (
  provider text not null check (provider in ('yandex', 'vk')),
  provider_uid text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, provider_uid)
);
create index if not exists auth_identities_user_idx on auth.identities (user_id);

-- Данные из токена, который проверил PostgREST (он кладёт их в настройки сессии)
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'role', '')
$$;
create or replace function auth.email() returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'email', '')
$$;
grant execute on function auth.jwt(), auth.uid(), auth.role(), auth.email() to anon, authenticated, service_role;

-- Таблицы auth недоступны ролям приложения: с ними работают только функции из 01_after_import.sql
revoke all on auth.users, auth.identities from anon, authenticated, service_role;

-- ---------- расширения ----------
-- Миграция 15 ставит pg_trgm в схему extensions (поиск продуктов). В Yandex Cloud расширение сначала
-- включают в консоли: кластер -> база -> «Расширения» (pg_trgm).
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pg_trgm with schema extensions;

-- ---------- заглушка storage ----------
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;
revoke all on storage.buckets, storage.objects from anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
