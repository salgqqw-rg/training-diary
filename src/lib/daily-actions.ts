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

const goto = (key: "error" | "ok", msg: string, tab = "day", extra = ""): never =>
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) goto("error", "Выберите дату");

  const record: Record<string, string | number | null> = {
    user_id: user.id,
    log_date: date,
    note: String(fd.get("note") ?? "").trim() || null,
  };
  for (const f of NUMERIC_FIELDS) {
    const raw = String(fd.get(f) ?? "").trim().replace(",", ".");
    record[f] = raw === "" ? null : Number(raw);
    if (record[f] !== null && Number.isNaN(record[f] as number)) {
      goto("error", "Некорректное число в одном из полей", "day", `&date=${date}`);
    }
  }

  const { error } = await supabase
    .from("daily_logs")
    .upsert(record, { onConflict: "user_id,log_date" });
  if (error) goto("error", "Не удалось сохранить запись: " + error.message, "day", `&date=${date}`);

  revalidatePath("/daily");
  goto("ok", `Запись за ${date} сохранена`, "day", `&date=${date}`);
}

// Вода: прибавить или убавить миллилитры (кнопки +250 / +500 / −250), итог держится в пределах 0—20 л
export async function addWater(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  const delta = Math.trunc(Number(fd.get("delta")));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(delta) || Math.abs(delta) > 2000) return;
  const { data: cur } = await supabase.from("daily_logs").select("water_ml").eq("user_id", user.id).eq("log_date", date).maybeSingle();
  const water_ml = Math.min(20000, Math.max(0, Number(cur?.water_ml ?? 0) + delta));
  const { error } = await supabase.from("daily_logs").upsert({ user_id: user.id, log_date: date, water_ml }, { onConflict: "user_id,log_date" });
  if (error) {
    goto("error", error.code === "42703"
      ? "Нет колонки воды: выполните supabase/migration_28_water_and_supplement_checks.sql в Supabase"
      : "Не удалось сохранить воду: " + error.message, "day", `&date=${date}`);
  }
  revalidatePath("/daily");
}

// Отметка «принял» у добавки на день: есть отметка — снимаем, нет — ставим
export async function toggleSupplementCheck(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  const id = String(fd.get("supplement_id") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !id) return;
  const { error } = fd.get("checked") === "1"
    ? await supabase.from("supplement_checks").delete().eq("supplement_id", id).eq("log_date", date).eq("user_id", user.id)
    : await supabase.from("supplement_checks").insert({ supplement_id: id, user_id: user.id, log_date: date });
  if (error) {
    goto("error", error.code === "42P01"
      ? "Таблица не создана: выполните supabase/migration_28_water_and_supplement_checks.sql в Supabase"
      : "Не удалось сохранить отметку: " + error.message, "day", `&date=${date}`);
  }
  revalidatePath("/daily");
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
// Добавить несколько позиций за раз: форма шлёт поля по одному набору на строку (kind, name, … — одинаковой длины)
// shortcut: не больше 30 позиций за раз, лишние отбрасываются
export async function addSupplements(fd: FormData) {
  const { supabase, user } = await requireUser();
  const [kinds, names, dosages, starts, ends, notes] = ["kind", "name", "dosage", "start_date", "end_date", "note"]
    .map((k) => fd.getAll(k).map((v) => String(v).trim()));

  const rows = names
    .map((name, i) => ({
      user_id: user.id,
      kind: (kinds[i] ?? "") in KINDS ? (kinds[i] as Kind) : "supplement",
      name: name.slice(0, 100),
      dosage: (dosages[i] ?? "").slice(0, 100) || null,
      start_date: starts[i] || null,
      end_date: ends[i] || null,
      note: (notes[i] ?? "").slice(0, 300) || null,
    }))
    .filter((r) => r.name)
    .slice(0, 30);
  if (!rows.length) goto("error", "Укажите название", "supplements");
  const bad = rows.find((r) => r.start_date && r.end_date && r.end_date < r.start_date);
  if (bad) goto("error", `«${bad.name}»: дата окончания раньше даты начала`, "supplements");

  const { error } = await supabase.from("supplements").insert(rows);
  if (error) {
    goto("error", error.code === "42P01"
      ? "Таблица не создана: выполните supabase/migration_05_supplements.sql в Supabase"
      : "Не удалось добавить: " + error.message, "supplements");
  }
  revalidatePath("/daily");
  goto("ok", `Добавлено: ${rows.length}`, "supplements");
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
