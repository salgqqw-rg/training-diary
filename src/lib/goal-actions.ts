"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/today";
import { ACTIVITY, calcPlan, PACES, type Activity, type Goal, type Sex } from "@/lib/nutrition";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const goto = (key: "error" | "ok", msg: string): never =>
  redirect(`/goals?${key}=${encodeURIComponent(msg)}`);

// Поставить цель
export async function addGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(fd.get("title") ?? "").trim().slice(0, 150);
  if (!title) goto("error", "Опишите цель");
  const details = String(fd.get("details") ?? "").trim().slice(0, 500) || null;
  const dueDate = String(fd.get("due_date") ?? "").trim() || null;

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title, details, due_date: dueDate,
  });
  if (error) {
    goto("error", error.code === "42P01"
      ? "Таблица не создана: выполните supabase/migration_06_goals.sql в Supabase"
      : "Не удалось сохранить цель: " + error.message);
  }
  revalidatePath("/goals");
}

// Отметить выполненной / вернуть в работу
export async function toggleGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(fd.get("id") ?? "");
  const done = String(fd.get("done")) === "true";
  await supabase
    .from("goals")
    .update({ status: done ? "done" : "active", done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/goals");
}

// Отказаться от цели (срок вышел / планы изменились)
export async function dropGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("goals")
    .update({ status: "dropped", done_at: null })
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/goals");
}

export async function deleteGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("goals")
    .delete()
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/goals");
}

// ===== Анкета цели: набор / сброс / поддержание веса + автоматическая норма =====

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").trim().replace(",", "."));

// Сохранить анкету. Норма не хранится — её считает loadPlan из анкеты и последнего веса.
export async function savePlan(fd: FormData) {
  const { supabase, user } = await requireUser();

  const goal = String(fd.get("goal")) as Goal;
  const sex = String(fd.get("sex")) as Sex;
  const activity = String(fd.get("activity")) as Activity;
  if (!["lose", "maintain", "gain"].includes(goal)) goto("error", "Выберите цель");
  if (!["male", "female"].includes(sex)) goto("error", "Укажите пол");
  if (!(activity in ACTIVITY)) goto("error", "Выберите уровень активности");

  const weight = num(fd.get("weight"));
  const goalWeight = goal === "maintain" ? weight : num(fd.get("goal_weight"));
  const pace = goal === "maintain" ? 0 : num(fd.get("pace"));
  const birth = String(fd.get("birth_date") ?? "");

  // Та же проверка, что и в живом расчёте на форме
  const res = calcPlan({
    goal, sex, birthDate: birth, heightCm: num(fd.get("height")),
    weightKg: weight, goalWeightKg: goalWeight, activity, paceKgWeek: pace,
  });
  if (!res.ok) goto("error", res.error);
  if (goal !== "maintain" && !PACES[goal].includes(pace)) goto("error", "Выберите темп из списка");

  const { error } = await supabase.from("nutrition_plans").upsert({
    user_id: user.id, goal, sex, birth_date: birth,
    height_cm: num(fd.get("height")), start_weight_kg: weight, goal_weight_kg: goalWeight,
    activity, pace_kg_week: pace,
    start_date: await today(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) {
    goto("error", error.code === "42P01"
      ? "Таблица не создана: выполните supabase/migration_16_nutrition_plan.sql в Supabase"
      : "Не удалось сохранить анкету: " + error.message);
  }
  revalidatePath("/goals");
  revalidatePath("/daily");
  goto("ok", "Норма рассчитана");
}

// Ручная правка БЖУ: себе или подопечному (тренер). Права проверяет RLS (своя строка или активный тренер).
// Кнопка «reset» возвращает расчётные значения.
export async function saveMacros(fd: FormData) {
  const { supabase, user } = await requireUser();
  const uid = String(fd.get("user_id") ?? user.id);
  const back = (key: "error" | "ok", msg: string): never =>
    redirect(`/goals?${uid === user.id ? "" : `user=${encodeURIComponent(uid)}&`}${key}=${encodeURIComponent(msg)}`);

  const reset = fd.get("reset") !== null;
  const get = (k: string) => (String(fd.get(k) ?? "").trim() === "" ? NaN : num(fd.get(k)));
  const [p, f, c] = [get("protein"), get("fat"), get("carbs")];
  if (!reset && ![p, f, c].every((v) => Number.isInteger(v) && v >= 0 && v <= 999)) {
    back("error", "Белки, жиры и углеводы — целые числа от 0 до 999 г");
  }

  const { data, error } = await supabase
    .from("nutrition_plans")
    .update(reset
      ? { custom_protein_g: null, custom_fat_g: null, custom_carbs_g: null }
      : { custom_protein_g: p, custom_fat_g: f, custom_carbs_g: c })
    .eq("user_id", uid)
    .select("user_id");
  if (error) {
    back("error", error.code === "PGRST204" || error.code === "42703"
      ? "Колонок нет: выполните supabase/migration_25_custom_macros.sql в Supabase"
      : "Не удалось сохранить БЖУ: " + error.message);
  }
  // RLS молча отфильтровывает чужие строки — пустой ответ значит «нет доступа» или анкеты нет
  if (!data?.length) back("error", "Нет доступа или анкета ещё не заполнена");

  revalidatePath("/goals");
  back("ok", reset ? "Возвращена расчётная норма" : "БЖУ сохранены");
}

// Удалить анкету (начать заново)
export async function resetPlan() {
  const { supabase, user } = await requireUser();
  await supabase.from("nutrition_plans").delete().eq("user_id", user.id);
  revalidatePath("/goals");
  revalidatePath("/daily");
}
