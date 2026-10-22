-- ============================================================
-- Миграция 7: личные сообщения (тренер <-> подопечный)
-- Идемпотентная: можно выполнять повторно.
-- ============================================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index on messages(sender_id, recipient_id);
create index on messages(recipient_id, read_at);

alter table messages enable row level security;

-- Читать переписку могут только её участники
create policy "messages: read own dialogs" on messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Отправить можно только связанному тренеру/подопечному (в любой роли)
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

-- Отметить «прочитано» может только получатель (read_at: null -> время)
create policy "messages: recipient marks read" on messages for update
  using (recipient_id = auth.uid() and read_at is null)
  with check (recipient_id = auth.uid() and read_at is not null);
