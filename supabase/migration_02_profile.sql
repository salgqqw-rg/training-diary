-- ============================================================
-- Миграция: профиль (аватар, редактирование)
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

-- 1. Ссылка на аватар в профиле
alter table profiles add column if not exists avatar_url text;

-- 2. Бакет для аватаров (публичное чтение)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3. Правила доступа к файлам: каждый — только в свою папку uid/
drop policy if exists "avatars: read public" on storage.objects;
drop policy if exists "avatars: upload own" on storage.objects;
drop policy if exists "avatars: update own" on storage.objects;
drop policy if exists "avatars: delete own" on storage.objects;

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
