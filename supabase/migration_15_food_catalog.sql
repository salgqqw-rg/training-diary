-- Миграция 15: собственный каталог продуктов (вместо FatSecret API).
-- Данные: Open Food Facts (лицензия ODbL), заливаются скриптом scripts/import-openfoodfacts.mjs.
-- Читать каталог могут все вошедшие пользователи; писать — только service-ключ (скрипт импорта),
-- политик на запись нет намеренно.

create extension if not exists pg_trgm with schema extensions;

create table if not exists food_catalog (
  code text primary key,                       -- штрихкод Open Food Facts
  name text not null check (char_length(name) between 1 and 200),
  brand text,
  kcal numeric(7,1) not null check (kcal >= 0 and kcal <= 900),   -- на 100 г
  protein_g numeric(6,1) not null default 0 check (protein_g >= 0 and protein_g <= 100),
  fat_g numeric(6,1) not null default 0 check (fat_g >= 0 and fat_g <= 100),
  carbs_g numeric(6,1) not null default 0 check (carbs_g >= 0 and carbs_g <= 100),
  search text not null,                        -- имя + бренд в нижнем регистре для поиска
  created_at timestamptz not null default now()
);

create index if not exists food_catalog_search_trgm
  on food_catalog using gin (search extensions.gin_trgm_ops);

alter table food_catalog enable row level security;

drop policy if exists "food_catalog: read all" on food_catalog;
create policy "food_catalog: read all" on food_catalog for select
  using (auth.uid() is not null);
