# Выкатка на Vercel (через GitHub)

Сайт уже умеет ставиться на экран телефона (манифест, иконки, нижнее меню, отступы под «чёлку»).
Проект привязан к Vercel-проекту `training-diary` (папка `.vercel`, в git она не попадает).

## 1. База данных (Supabase → SQL Editor), по порядку
Выполните то, что ещё не выполняли: `migration_25_custom_macros.sql`, `migration_26_security_fixes.sql`,
`migration_27_coach_directory.sql`. Делайте это прямо перед выкладкой нового кода:
после миграции 26 старая версия сайта перестаёт читать email из профиля.

## 2. Проверка у себя на компьютере (в папке проекта)
```
npm install
npm run check      # типы и тесты
npm run build      # то же, что сделает Vercel
```
Если `check` или `build` покажет ошибку, пришлите её текст.

## 3. Код на GitHub
Если репозитория ещё нет: на github.com создайте пустой приватный репозиторий, затем в папке проекта
```
git add .
git commit -m "Solo: каталог тренеров, безопасность, PWA"
git remote add origin https://github.com/<вы>/<репозиторий>.git
git branch -M main
git push -u origin main
```
(`.env.local` и `.vercel` в `.gitignore`, ключи в GitHub не уйдут.)

## 4. Vercel
1. vercel.com → Add New → Project → Import репозитория (Framework: Next.js определится сам).
   Если проект `training-diary` уже есть: Settings → Git → Connect Git Repository.
2. Settings → Environment Variables (Production), значения берите из `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (только для «Удалить аккаунт», секретный)
   - `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET` (необязательно)
   - `NEXT_PUBLIC_SITE_URL` — адрес сайта, например `https://training-diary.vercel.app` (после первой выкладки)
3. Deploy. Каждый следующий `git push` в `main` выкатывается сам.

## 5. Supabase → Authentication → URL Configuration
- Site URL: адрес сайта на Vercel.
- Redirect URLs: добавьте `https://<ваш-адрес>/auth/callback` и `https://<ваш-адрес>/**`
  (иначе не сработают вход через Google и письма «сброс пароля»).
- Google Cloud менять не нужно: он ведёт на адрес Supabase.

## 6. На телефоне
- iPhone (Safari): «Поделиться» → «На экран “Домой”».
- Android (Chrome): меню ⋮ → «Установить приложение».
