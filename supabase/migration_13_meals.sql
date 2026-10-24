-- Миграция 13: питание — приёмы пищи и своя база продуктов
-- meal_entries: одна строка = один продукт в конкретный приём пищи за дату
-- Автосумма за день складывается в daily_logs (kcal, БЖУ) на сервере.

create table meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null check (char_length(name) between 1 and 150),
  grams numeric(7,1) not null default 100 check (grams > 0 and grams <= 10000),
  kcal numeric(8,1) not null default 0 check (kcal >= 0),
  protein_g numeric(6,1) not null default 0 check (protein_g >= 0),
  fat_g numeric(6,1) not null default 0 check (fat_g >= 0),
  carbs_g numeric(6,1) not null default 0 check (carbs_g >= 0),
  created_at timestamptz not null default now()
);

create index on meal_entries(user_id, log_date);

-- Свои сохранённые продукты (значения на 100 г) — для быстрого повторного ввода
create table user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  kcal numeric(8,1) not null default 0 check (kcal >= 0),
  protein_g numeric(6,1) not null default 0 check (protein_g >= 0),
  fat_g numeric(6,1) not null default 0 check (fat_g >= 0),
  carbs_g numeric(6,1) not null default 0 check (carbs_g >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table meal_entries enable row level security;
alter table user_foods enable row level security;

create policy "meal_entries: read own or coach" on meal_entries for select
  using (user_id = auth.uid() or has_active_coach(user_id));
create policy "meal_entries: write own" on meal_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user_foods: read own" on user_foods for select
  using (user_id = auth.uid());
create policy "user_foods: write own" on user_foods for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
