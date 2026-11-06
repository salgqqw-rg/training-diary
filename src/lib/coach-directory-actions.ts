"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCoachProfile } from "@/lib/coach-profile";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const goto = (key: "error" | "ok", msg: string, tab: "find" | "mine"): never =>
  redirect(`/coaches?tab=${tab}&${key}=${encodeURIComponent(msg)}`);

// Тренер создаёт или меняет свою анкету; в каталоге она видна только при включённой галочке
export async function saveCoachProfile(fd: FormData) {
  const { supabase, user } = await requireUser();
  const p = parseCoachProfile(fd);
  if (p.listed && p.about.length < 20) goto("error", "Расскажите о себе хотя бы парой предложений — иначе анкета не попадёт в каталог", "mine");

  // Фото анкеты: один файл в публичном бакете avatars (папка своего uid), путь стабильный — файл перезаписывается
  const row: Record<string, unknown> = { user_id: user.id, ...p, updated_at: new Date().toISOString() };
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) goto("error", "Файл не является изображением", "mine");
    if (file.size > 5 * 1024 * 1024) goto("error", "Фото больше 5 МБ", "mine");
    const path = `${user.id}/coach`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) goto("error", "Не удалось загрузить фото: " + upErr.message, "mine");
    row.photo_url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`; // ?v — обход кеша
  } else if (fd.get("remove_photo") === "on") {
    await supabase.storage.from("avatars").remove([`${user.id}/coach`]);
    row.photo_url = null;
  }

  const { error } = await supabase.from("coach_profiles").upsert(row);
  if (error) goto("error", "Не удалось сохранить анкету: " + error.message, "mine");
  revalidatePath("/coaches");
  goto("ok", p.listed ? "Анкета сохранена и показывается в каталоге" : "Анкета сохранена, в каталоге она скрыта", "mine");
}

// Подопечный просится к тренеру из каталога; тренер примет заявку на странице «Подопечные»
export async function requestCoach(fd: FormData) {
  const { supabase, user } = await requireUser();
  const coachId = String(fd.get("coach_id") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  if (!coachId || coachId === user.id) goto("error", "Нельзя отправить заявку самому себе", "find");

  const { error } = await supabase
    .from("coach_links")
    .insert({ coach_id: coachId, trainee_id: user.id, status: "pending", requested_by: user.id, note });
  if (error) {
    goto("error", error.code === "23505"
      ? "Заявка этому тренеру уже есть"
      : "Не удалось отправить заявку — возможно, тренер скрыл анкету", "find");
  }
  revalidatePath("/coaches");
  revalidatePath("/clients");
  goto("ok", "Заявка отправлена — тренер увидит её на странице «Подопечные»", "find");
}
