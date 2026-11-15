-- ============================================================
-- Шаг после копирования файлов. Заменяет адреса файлов Supabase Storage на адреса Object Storage.
--
--   psql "$DATABASE_URL" -v old_prefix=https://<проект>.supabase.co/storage/v1/object/public/ ^
--                        -v new_prefix=https://storage.yandexcloud.net/<бакет>/ -f 02_rewrite_urls.sql
--
-- new_prefix = S3_PUBLIC_URL из .env (если не задан: https://storage.yandexcloud.net/<S3_BUCKET>) и «/» на конце.
-- Фото формы и фото чата закрытые: приложение отдаёт их по пути из столбцов path / image_path (/api/photo),
-- поэтому для них достаточно скопировать файлы, а адреса в url / image_url ни на что не влияют (их тоже заменяем для порядка).
-- ============================================================

begin;

update profiles         set avatar_url = replace(avatar_url, :'old_prefix', :'new_prefix') where avatar_url like :'old_prefix' || '%';
update coach_profiles   set photo_url  = replace(photo_url,  :'old_prefix', :'new_prefix') where photo_url  like :'old_prefix' || '%';
update user_exercises   set image_url  = replace(image_url,  :'old_prefix', :'new_prefix') where image_url  like :'old_prefix' || '%';
update user_exercises   set video_url  = replace(video_url,  :'old_prefix', :'new_prefix') where video_url  like :'old_prefix' || '%';
update progress_photos  set url        = replace(url,        :'old_prefix', :'new_prefix') where url        like :'old_prefix' || '%';
update messages         set image_url  = replace(image_url,  :'old_prefix', :'new_prefix') where image_url  like :'old_prefix' || '%';

-- Что осталось со старым адресом (должно быть пусто)
select 'profiles.avatar_url' as col, count(*) from profiles where avatar_url like '%supabase.co%'
union all select 'coach_profiles.photo_url', count(*) from coach_profiles where photo_url like '%supabase.co%'
union all select 'user_exercises.image_url', count(*) from user_exercises where image_url like '%supabase.co%'
union all select 'user_exercises.video_url', count(*) from user_exercises where video_url like '%supabase.co%'
union all select 'progress_photos.url', count(*) from progress_photos where url like '%supabase.co%'
union all select 'messages.image_url', count(*) from messages where image_url like '%supabase.co%';

commit;
