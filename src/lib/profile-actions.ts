"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordError } from "@/lib/password";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const goto = (key: "error" | "ok", msg: string): never =>
  redirect(`/profile?${key}=${encodeURIComponent(msg)}`);

// Имя и фото профиля
export async function updateProfile(fd: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(fd.get("name") ?? "").trim().slice(0, 100);
  const file = fd.get("avatar");

  const updates: { display_name?: string; avatar_url?: string } = {};

  if (name) {
    // Синхронизируем имя в auth, чтобы триггер и метаданные не расходились
    await supabase.auth.updateUser({ data: { display_name: name } });
    updates.display_name = name;
  }

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) goto("error", "Файл не является изображением");
    if (file.size > 5 * 1024 * 1024) goto("error", "Файл больше 5 МБ");
    const path = `${user.id}/avatar`; // стабильный путь, файл перезаписывается
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) goto("error", "Не удалось загрузить фото: " + uploadErr.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // ?v — обходим кеш браузера после замены файла
    updates.avatar_url = `${data.publicUrl}?v=${Date.now()}`;
  }

  if (Object.keys(updates).length === 0) goto("error", "Укажите имя или выберите фото");
  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) goto("error", "Не удалось сохранить профиль");

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  goto("ok", "Профиль обновлён");
}

// Смена email: письмо для подтверждения уходит на новый адрес
export async function changeEmail(fd: FormData) {
  const { supabase, user } = await requireUser();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) goto("error", "Некорректный email");

  const { error } = await supabase.auth.updateUser({ email });
  if (error) goto("error", "Не удалось сменить email: " + error.message);

  // Профильный email нужен тренерам для поиска — обновляем сразу,
  // если подтверждение не пройдено, auth.user останется со старым адресом
  await supabase.from("profiles").update({ email }).eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  goto("ok", "На новый email отправлено письмо для подтверждения");
}

// Смена пароля
export async function changePassword(fd: FormData) {
  const { supabase } = await requireUser();
  const password = String(fd.get("password") ?? "");
  const weak = passwordError(password);
  if (weak) goto("error", weak);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) goto("error", "Не удалось сменить пароль: " + error.message);
  goto("ok", "Пароль изменён");
}

// Полное удаление аккаунта: данные, фото и учётка в Supabase Auth
export async function deleteAccount(fd: FormData) {
  const { supabase, user } = await requireUser();
  if (String(fd.get("confirm") ?? "").trim() !== "УДАЛИТЬ") {
    goto("error", "Для удаления введите слово УДАЛИТЬ заглавными буквами");
  }

  const admin = createAdminClient();
  if (admin) {
    // Файлы аватара и фото формы
    await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);
    const { data: photos } = await supabase
      .from("progress_photos")
      .select("path")
      .eq("user_id", user.id);
    if (photos?.length) {
      await supabase.storage.from("progress").remove(photos.map((p) => p.path));
    }

    // Сначала данные (циклы, замеры, связи с тренерами) — каскад от профиля
    const { error: profileErr } = await supabase.from("profiles").delete().eq("id", user.id);
    if (profileErr) goto("error", "Не удалось удалить данные аккаунта: " + profileErr.message);

    // Затем сама учётная запись
    const { error: userErr } = await admin.auth.admin.deleteUser(user.id);
    if (userErr) goto("error", "Данные удалены, но учётка осталась: " + userErr.message);

    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
  }
  goto("error", "Не настроен ключ SUPABASE_SERVICE_ROLE_KEY — см. README, раздел «Профиль»");
}
