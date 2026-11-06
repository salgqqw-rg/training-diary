-- ============================================================
-- Миграция 26: закрытие дыр по результатам аудита (идемпотентная)
-- Выполнить в Supabase SQL Editor ПОСЛЕ миграций 1–25.
-- Не перезапускайте после неё migration_03 / migration_08 и schema.sql целиком:
-- они снова сделают бакеты фото публичными.
-- ============================================================

-- 1. Тренер может только ОТПРАВИТЬ заявку (pending); active ставит подопечный
drop policy if exists "coach_links: coach invites" on coach_links;
create policy "coach_links: coach invites" on coach_links for insert
  with check (coach_id = auth.uid() and status = 'pending');

-- Проверьте, что нет чужих «активных» связей, которых вы не подтверждали:
--   select cl.id, c.display_name as coach, t.display_name as trainee, cl.created_at
--   from coach_links cl
--   join profiles c on c.id = cl.coach_id join profiles t on t.id = cl.trainee_id
--   where cl.status = 'active' order by cl.created_at desc;
-- Лишнюю строку удалите: delete from coach_links where id = '...';

-- 2. Email в profiles больше не читается напрямую (ни без входа, ни после)
revoke select on profiles from anon, authenticated;
grant select (id, display_name, avatar_url, created_at) on profiles to anon, authenticated;
-- Новую колонку в profiles, которую нужно читать из приложения, добавляйте в этот grant.

-- Поиск подопечного по точному email: наружу отдаётся только id
create or replace function find_user_by_email(e text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where lower(email) = lower(trim(e)) limit 1;
$$;

-- Email только тех, с кем у меня есть связь (тренеры и подопечные, в т.ч. ожидающие)
create or replace function linked_emails() returns table(id uuid, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email from profiles p
  where p.id in (
    select trainee_id from coach_links where coach_id = auth.uid()
    union
    select coach_id from coach_links where trainee_id = auth.uid()
  );
$$;

revoke all on function find_user_by_email(text) from public, anon;
revoke all on function linked_emails() from public, anon;
grant execute on function find_user_by_email(text), linked_emails() to authenticated;

-- 3. Фото формы и фото в чате — только для владельца и его тренера / собеседника.
-- Приложение отдаёт их через /api/photo (проверка прав = эти правила).
update storage.buckets set public = false where id in ('progress', 'chat');

drop policy if exists "progress: read public" on storage.objects;
drop policy if exists "progress: read own or coach" on storage.objects;
create policy "progress: read own or coach" on storage.objects for select
  using (
    bucket_id = 'progress'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from coach_links l
        where l.status = 'active' and l.coach_id = auth.uid()
          and l.trainee_id::text = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists "chat: read public" on storage.objects;
drop policy if exists "chat: read dialog" on storage.objects;
create policy "chat: read dialog" on storage.objects for select
  using (
    bucket_id = 'chat'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from coach_links l
        where l.status = 'active'
          and ((l.coach_id = auth.uid() and l.trainee_id::text = (storage.foldername(name))[1])
            or (l.trainee_id = auth.uid() and l.coach_id::text = (storage.foldername(name))[1]))
      )
    )
  );

-- 4. Зафиксированный подход нельзя править, пока его не разблокируют («Изменить»)
create or replace function workout_sets_locked_guard() returns trigger
language plpgsql as $$
begin
  if old.locked and new.locked then
    raise exception 'Подход зафиксирован: сначала нажмите «Изменить»';
  end if;
  return new;
end;
$$;

drop trigger if exists workout_sets_locked_guard on workout_sets;
create trigger workout_sets_locked_guard
  before update on workout_sets
  for each row execute function workout_sets_locked_guard();
