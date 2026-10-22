-- ============================================================
-- Миграция 8: фото в чате
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

alter table messages add column if not exists image_path text;
alter table messages add column if not exists image_url text;

-- Тело сообщения теперь необязательно, если отправлено фото
alter table messages alter column body drop not null;
alter table messages drop constraint if exists messages_body_check;
-- join предложения для читаемости
alter table messages add constraint messages_body_check
  check ((body is not null and char_length(body) between 1 and 2000) or image_path is not null);

-- Бакет для фотографий в переписке
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
