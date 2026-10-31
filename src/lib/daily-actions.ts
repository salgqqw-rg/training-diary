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

const goto = (key: "error" | "ok", msg: string, tab = "food", extra = ""): never =>
  redirect(`/daily?tab=${tab}${extra}&${key}=${encodeURIComponent(msg)}`);

// КБЖУ за день теперь считаются автоматически из приёмов пищи (food-actions),
// ручной ввод оставлен только для сна, шагов и заметки
const NUMERIC_FIELDS = [
  "sleep_h", "steps",
] as const;

// Сохранить запись за день: повторный ввод за ту же дату обновит её
export async function saveDailyLog(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) goto("error", "Выберите дату", "sleep");

  const record: Record<string, string | number | null> = {
    user_id: user.id,
    log_date: date,
    note: String(fd.get("note") ?? "").trim() || null,
  };
  for (const f of NUMERIC_FIELDS) {
    const raw = String(fd.get(f) ?? "").trim().replace(",", ".");
    record[f] = raw === "" ? null : Number(raw);
    if (record[f] !== null && Number.isNaN(record[f] as number)) {
      goto("error", "Некорректное число в одном из полей", "sleep", `&date=${date}`);
    }
  }

  const { error } = await supabase
    .from("daily_logs")
    .upsert(record, { onConflict: "user_id,log_date" });
  if (error) goto("error", "Не удалось сохранить запись: " + error.message, "sleep", `&date=${date}`);

  revalidatePath("/daily");
  goto("ok", `Запись за ${date} сохранена`, "sleep", `&date=${date}`);
}

export async function deleteDailyLog(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("daily_logs")
    .delete()
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/daily");
}

// ============ Добавки, БАДы и курсы ААС ============

const KINDS = { supplement: "Добавка", bac: "БАД", course: "Курс ААС" } as const;
type Kind = keyof typeof KINDS;

// Добавить позицию: название и дозировка вписываются вручную
export async function addSupplement(fd: FormData) {
  const { supabase, user } = await requireUser();
  const kindRaw = String(fd.get("kind") ?? "supplement");
  const kind: Kind = kindRaw in KINDS ? (kindRaw as Kind) : "supplement";
  const name = String(fd.get("name") ?? "").trim().slice(0, 100);
  if (!name) goto("error", "Укажите название", "supplements");
  const dosage = String(fd.get("dosage") ?? "").trim().slice(0, 100) || null;
  const startDate = String(fd.get("start_date") ?? "").trim() || null;
  const endDate = String(fd.get("end_date") ?? "").trim() || null;
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  if (startDate && endDate && endDate < startDate) {
    goto("error", "Дата окончания раньше даты начала", "supplements");
  }

  const { error } = await supabase.from("supplements").insert({
    user_id: user.id,
    kind, name, dosage, start_date: startDate, end_date: endDate, note,
  });
  if (error) {
    goto("error", error.code === "42P01"
      ? "Таблица не создана: выполните supabase/migration_05_supplements.sql в Supabase"
      : "Не удалось добавить: " + error.message, "supplements");
  }
  revalidatePath("/daily");
}

export async function deleteSupplement(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("supplements")
    .delete()
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/daily");
}
