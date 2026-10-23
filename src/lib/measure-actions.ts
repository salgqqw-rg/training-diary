"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const goto = (key: "error" | "ok", msg: string): never =>
  redirect(`/measurements?${key}=${encodeURIComponent(msg)}`);

// Поля замеров, приходящие из формы
const NUMERIC_FIELDS = [
  "weight", "height",
  "bicep_l", "bicep_r",
  "shoulders", "chest",
  "thigh_l", "thigh_r",
  "waist", "calf_l", "calf_r",
] as const;

// Сохранить замеры на дату: повторный ввод за ту же дату обновит запись
export async function saveMeasurement(fd: FormData) {
  const { supabase, user } = await requireUser();
  const day = String(fd.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) goto("error", "Выберите дату");

  const record: Record<string, string | number | null> = {
    user_id: user.id,
    measured_on: day,
    month: `${day.slice(0, 7)}-01`, // для совместимости (фото форм и история)
  };
  for (const f of NUMERIC_FIELDS) {
    const raw = String(fd.get(f) ?? "").trim().replace(",", ".");
    record[f] = raw === "" ? null : Number(raw);
    if (record[f] !== null && Number.isNaN(record[f] as number)) {
      goto("error", `Некорректное число в поле ${f}`);
    }
  }

  const { error } = await supabase
    .from("measurements")
    .upsert(record, { onConflict: "user_id,measured_on" });
  if (error) goto("error", "Не удалось сохранить замеры: " + error.message);

  revalidatePath("/measurements");
  const d = new Date(`${day}T00:00:00Z`).toLocaleString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  goto("ok", `Замеры за ${d} сохранены`);
}

export async function deleteMeasurement(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("measurements")
    .delete()
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/measurements");
}

// Прикрепить фото формы к месяцу (можно несколько файлов сразу)
export async function uploadProgressPhotos(fd: FormData) {
  const { supabase, user } = await requireUser();
  const month = String(fd.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) goto("error", "Выберите месяц для фото");

  const files = fd.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
  if (!files.length) goto("error", "Выберите хотя бы одно фото");
  for (const file of files) {
    if (!file.type.startsWith("image/")) goto("error", `Файл ${file.name} — не изображение`);
    if (file.size > 10 * 1024 * 1024) goto("error", `Файл ${file.name} больше 10 МБ`);
  }

  for (const file of files) {
    const path = `${user.id}/${month}-${crypto.randomUUID()}`;
    const { error: upErr } = await supabase.storage
      .from("progress")
      .upload(path, file, { contentType: file.type });
    if (upErr) goto("error", "Не удалось загрузить " + file.name + ": " + upErr.message);
    const { data } = supabase.storage.from("progress").getPublicUrl(path);
    const { error } = await supabase.from("progress_photos").insert({
      user_id: user.id,
      month: `${month}-01`,
      url: data.publicUrl,
      path,
    });
    if (error) goto("error", "Не удалось сохранить фото: " + error.message);
  }

  revalidatePath("/measurements");
  goto("ok", `Фото добавлены за ${month}`);
}

export async function deleteProgressPhoto(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(fd.get("id") ?? "");
  const { data: row } = await supabase
    .from("progress_photos")
    .select("path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (row) {
    await supabase.storage.from("progress").remove([row.path]);
    await supabase.from("progress_photos").delete().eq("id", id);
  }
  revalidatePath("/measurements");
}
