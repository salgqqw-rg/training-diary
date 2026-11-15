-- ============================================================
-- Шаг 3 из 3. Выполнять ПОСЛЕ импорта схемы и данных (после 00_roles_and_auth.sql и миграций / дампа).
--
--   psql "$DATABASE_URL" -f 01_after_import.sql
--
--  * права ролей на таблицы (дамп делается без прав, поэтому выдаём их здесь, с ограничениями миграций 26 и 27);
--  * триггер: при создании пользователя автоматически создаётся профиль (как раньше в Supabase);
--  * oauth_sign_in(): находит или создаёт пользователя по входу через Яндекс / VK; вызывается только сервером сайта;
--  * delete_my_account(): удаляет учётную запись текущего пользователя (данные уходят каскадом).
-- ============================================================

-- ---------- права ----------
-- Как в Supabase: вошедший пользователь работает с таблицами, а строки ему оставляют правила RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Миграция 26: email в profiles напрямую не читается
revoke select on public.profiles from authenticated;
grant select (id, display_name, avatar_url, created_at) on public.profiles to authenticated;

-- Миграция 27: в связи тренер-подопечный менять можно только статус
revoke update on public.coach_links from authenticated;
grant update (status) on public.coach_links to authenticated;

-- Миграция 26: поиск по email и «мои связи» — только для вошедших
revoke all on function public.find_user_by_email(text) from public, anon;
revoke all on function public.linked_emails() from public, anon;
grant execute on function public.find_user_by_email(text), public.linked_emails() to authenticated;

-- Профиль создаётся сразу при появлении пользователя
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'Пользователь'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Вход через провайдера.
--  1) знакомая пара (провайдер, id) -> этот пользователь;
--  2) иначе, если email провайдера совпал с email существующей учётки (в том числе перенесённой из Supabase), привязываем вход к ней;
--  3) иначе создаём нового пользователя.
-- Email у Яндекса и VK приходит от самого провайдера, поэтому привязка по нему допустима.
create or replace function public.oauth_sign_in(
  p_provider text, p_uid text, p_email text, p_name text, p_avatar text default null
) returns table (id uuid, email text, display_name text)
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid;
  fresh boolean := false;
  mail text := nullif(lower(trim(p_email)), '');
begin
  if p_provider not in ('yandex', 'vk') or coalesce(p_uid, '') = '' then
    raise exception 'bad oauth identity';
  end if;

  select i.user_id into uid from auth.identities i where i.provider = p_provider and i.provider_uid = p_uid;

  if uid is null and mail is not null then
    select u.id into uid from auth.users u where lower(u.email) = mail;
  end if;

  if uid is null then
    insert into auth.users (email, raw_user_meta_data)
    values (mail, jsonb_build_object('display_name', left(coalesce(nullif(trim(p_name), ''), 'Пользователь'), 100)))
    returning auth.users.id into uid;
    fresh := true;
  end if;

  insert into auth.identities (provider, provider_uid, user_id) values (p_provider, p_uid, uid)
  on conflict (provider, provider_uid) do nothing;

  -- фото из Яндекса / VK берём только для новой учётки и только если своего нет
  if fresh and p_avatar is not null then
    update profiles p set avatar_url = p_avatar where p.id = uid and p.avatar_url is null;
  end if;

  return query
    select p.id, p.email, p.display_name from profiles p where p.id = uid;
end;
$$;

revoke all on function public.oauth_sign_in(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.oauth_sign_in(text, text, text, text, text) to service_role;

-- Удаление своей учётной записи: профиль, циклы, замеры, сообщения, связи — каскадом от auth.users
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- PostgREST перечитывает схему после изменений
notify pgrst, 'reload schema';
