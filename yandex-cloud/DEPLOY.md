# Переезд с Supabase на Yandex Cloud

Сайт остаётся на Vercel. В Yandex Cloud переезжают три вещи: база, вход и файлы.

```
Браузер → сайт на Vercel ──(JWT)──► PostgREST ──► Managed PostgreSQL
                    │
                    └──(S3, подписанные ссылки)──► Object Storage
Вход: Яндекс ID / VK ID → сайт сам выдаёт сессию (кука solo_session, JWT на 30 дней)
```

Код сайта по-прежнему ходит в базу через тот же запросный язык (PostgREST), поэтому все запросы и правила доступа (RLS)
работают без переписывания. PostgREST — открытая программа, свой контейнер в вашем облаке; Supabase для него не нужен.

Порядок: **подготовить новое окружение → перенести данные → переключить сайт → проверить**.
Пока вы не поменяли переменные в Vercel, сайт работает на старом Supabase, так что переезд безопасен.

## 0. Что понадобится

- Аккаунт Yandex Cloud с платёжным аккаунтом.
- На компьютере: `psql` и `pg_dump` (PostgreSQL client 15+), [rclone](https://rclone.org/).
- Данные подключения к Supabase: строка подключения к базе (Project Settings → Database, лучше «Session pooler» или прямая) и S3-ключи (Project Settings → Storage → S3 Connection).

## 1. Managed PostgreSQL

1. Консоль → Managed Service for PostgreSQL → создать кластер (версия 15 или 16, минимальный хост подойдёт).
2. Создайте базу `diary` и пользователя-владельца базы (например, `diary_owner`) с паролем.
3. В кластере → база → **Расширения** → включите `pg_trgm` (нужно для поиска продуктов).
4. Сделайте кластер доступным тому месту, где будет PostgREST (шаг 2) и вашему компьютеру на время переноса:
   - либо публичный доступ + разрешённый ваш IP в группе безопасности (проще; после переноса закройте),
   - либо работайте с ВМ внутри той же сети.
5. Строка подключения (понадобится ниже), SSL обязателен:

```
export DATABASE_URL="postgresql://diary_owner:ПАРОЛЬ@rc1a-xxxx.mdb.yandexcloud.net:6432/diary?sslmode=verify-full"
```

   Сертификат Яндекса: `mkdir -p ~/.postgresql && curl -o ~/.postgresql/root.crt https://storage.yandexcloud.net/cloud-certs/CA.pem`.

## 2. PostgREST (прослойка между сайтом и базой)

PostgREST запускается как контейнер `postgrest/postgrest` (Serverless Containers или маленькая ВМ в той же сети, что и кластер).
Переменные окружения:

| Переменная | Значение |
|---|---|
| `PGRST_DB_URI` | `postgres://authenticator:ПАРОЛЬ@<хост>:6432/diary?sslmode=require` — пользователь `authenticator` создаёт файл `00_...sql` (шаг 3) |
| `PGRST_DB_SCHEMAS` | `public` |
| `PGRST_DB_ANON_ROLE` | **не задавать** — запросы без токена должны отклоняться |
| `PGRST_JWT_SECRET` | то же значение, что `JWT_SECRET` сайта (≥ 32 символов; `openssl rand -base64 48`) |

Опубликуйте контейнер по HTTPS (Serverless Containers даёт адрес сразу; для ВМ поставьте перед ним Caddy/nginx с сертификатом).
Этот адрес — `POSTGREST_URL` для сайта. Токены подписывает только сайт, поэтому закрывать PostgREST от интернета не обязательно,
но и открывать больше не нужно: без правильного токена он ничего не отдаёт.

Если после правки схемы PostgREST «не видит» новые таблицы/функции: `notify pgrst, 'reload schema';` (скрипты это делают сами).

## 3. Перенос базы

Все команды выполняются из папки проекта на компьютере. `SUPABASE_DB_URL` — строка подключения к старой базе.

```bash
# 3.1 Роли и «учётная часть» (в пустой базе)
psql "$DATABASE_URL" -v authenticator_password='ПАРОЛЬ-ДЛЯ-POSTGREST' -f yandex-cloud/00_roles_and_auth.sql

# 3.2 Выгрузка из Supabase: схема public с данными и пользователи
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --no-comments -f public.sql
psql "$SUPABASE_DB_URL" -c "\copy (select id, email, raw_user_meta_data, created_at from auth.users) to 'users.csv' csv"

# 3.3 Загрузка. Сначала пользователи (на них ссылаются профили), потом схема и данные
psql "$DATABASE_URL" -c "\copy auth.users (id, email, raw_user_meta_data, created_at) from 'users.csv' csv"
psql "$DATABASE_URL" -f public.sql     # без ON_ERROR_STOP!

# 3.4 Права, триггеры, функции входа
psql "$DATABASE_URL" -f yandex-cloud/01_after_import.sql
```

В выводе 3.3 ожидаема одна безобидная ошибка `schema "public" already exists`. Остальные ошибки смотрите внимательно.

Проверка: `psql "$DATABASE_URL" -c "select count(*) from auth.users" -c "select count(*) from profiles"` — числа совпадают со старой базой
(`select count(*) from auth.users` в Supabase SQL Editor).

Пользователи переносятся **с теми же идентификаторами**, поэтому все данные остаются привязанными. Пароли не переносятся
(вход теперь только через Яндекс и VK): при первом входе человека находят по email (регистр не важен) и привязывают к старой записи.

## 4. Object Storage (фото)

1. Консоль → Object Storage → создать **один** бакет (например, `solo-diary`), доступ чтения объектов — «ограниченный» (по умолчанию закрыт).
2. Сервисный аккаунт с ролью `storage.editor` на этот бакет → «Создать статический ключ доступа» → это `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY`.
3. Политика бакета: публичное чтение **только** для аватаров и картинок упражнений. Фото формы и чата остаются закрытыми — их отдаёт сайт после проверки прав.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": ["arn:aws:s3:::solo-diary/avatars/*", "arn:aws:s3:::solo-diary/exercises/*"]
  }]
}
```

4. CORS бакета (нужен для загрузки картинки упражнения прямо из браузера):

```json
[{ "AllowedOrigins": ["https://ВАШ-ДОМЕН"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
```

5. Копирование старых файлов. В Supabase файлы лежат в бакетах `avatars`, `chat`, `progress`, `exercises`; в новом бакете они становятся папками с теми же именами:

```bash
rclone config create supa s3 provider=Other endpoint=https://<проект>.supabase.co/storage/v1/s3 access_key_id=... secret_access_key=... region=eu-west-1
rclone config create yc  s3 provider=Other endpoint=https://storage.yandexcloud.net access_key_id=... secret_access_key=... region=ru-central1

for b in avatars chat progress exercises; do
  rclone copy supa:$b yc:solo-diary/$b --progress
done
```

6. Замена адресов файлов в базе:

```bash
psql "$DATABASE_URL" \
  -v old_prefix=https://<проект>.supabase.co/storage/v1/object/public/ \
  -v new_prefix=https://storage.yandexcloud.net/solo-diary/ \
  -f yandex-cloud/02_rewrite_urls.sql
```

## 5. Вход через Яндекс ID и VK ID

**Яндекс** — [oauth.yandex.ru](https://oauth.yandex.ru/) → Создать приложение → платформа «Веб-сервисы».
Callback URI: `https://ВАШ-ДОМЕН/auth/callback/yandex`. Доступы: «Доступ к адресу электронной почты», «Доступ к логину, имени и фамилии, полу», «Доступ к портрету пользователя».
Скопируйте ID и пароль → `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`.

**VK** — [id.vk.com/about/business/go](https://id.vk.com/about/business/go) → создать приложение «Web».
Доверенный Redirect URL: `https://ВАШ-ДОМЕН/auth/callback/vk`. Доступ к email включите в настройках приложения.
ID приложения → `VK_CLIENT_ID`. Для VK секрет не нужен (используется PKCE).

Кнопка провайдера на странице входа показывается только если его ключи заданы.

Важно: если у человека в VK нет подтверждённой почты, сопоставить его со старой записью нельзя — он войдёт как новый пользователь.

## 6. Переменные в Vercel и переключение

Settings → Environment Variables (Production) — заведите новые, **а старые `NEXT_PUBLIC_SUPABASE_*` и `SUPABASE_SERVICE_ROLE_KEY` удалите**:

| Переменная | Значение |
|---|---|
| `POSTGREST_URL` | адрес PostgREST из шага 2 |
| `JWT_SECRET` | тот же, что в `PGRST_JWT_SECRET` |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | из шага 4 |
| `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL` | необязательно (по умолчанию Yandex, `ru-central1`, адрес бакета) |
| `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `VK_CLIENT_ID` | шаг 5 |
| `NEXT_PUBLIC_SITE_URL` | `https://ВАШ-ДОМЕН` (без «/» на конце) |
| `FATSECRET_*` | как раньше |

Затем Deployments → Redeploy. Скрипт `scripts/vercel-env.mjs` (его вызывает `deploy.bat`) переносит эти же ключи из `.env.local`.

## 7. Проверка после переключения

- [ ] Вход через Яндекс (и VK) с тем же email, что был в Supabase: видны старые циклы и тренировки.
- [ ] Новый пользователь входит и получает пустой профиль.
- [ ] Дневник: добавить и сохранить подходы; питание; замеры.
- [ ] Профиль: загрузка аватара; фото формы в «Характеристиках» открываются; фото в чате.
- [ ] Упражнения: добавить своё с картинкой (проверяет CORS).
- [ ] Подопечный видит данные только тренера, к которому привязан; посторонний не видит чужого.
- [ ] «Удалить аккаунт» на тестовом пользователе.

## 8. Откат

Пока Supabase не удалён, достаточно вернуть в Vercel старые переменные (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) и код предыдущей версии (git). Данные, записанные после переезда, в Supabase не вернутся.
Не удаляйте проект Supabase хотя бы месяц.

## Что стоит знать

- **Сессия** — подписанная кука на 30 дней; отозвать вручную (выйти со всех устройств) нельзя, кроме как сменить `JWT_SECRET` (тогда выйдут все).
- **Старые пароли и Google** больше не работают; вход только через Яндекс и VK по тому же email.
- **Импорт каталога продуктов** (`scripts/import-openfoodfacts.mjs`) написан под Supabase и не менялся: запускайте его, указав `DATABASE_URL` Yandex, через `psql`/`\copy`
  либо перепишите скрипт под вашу строку подключения.
- Резервные копии Managed PostgreSQL включены по умолчанию; срок хранения настраивается в кластере.
