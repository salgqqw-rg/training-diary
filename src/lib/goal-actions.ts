"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    start_date: new Date().toISOString().slice(0, 10),
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

// Удалить анкету (начать заново)
export async function resetPlan() {
  const { supabase, user } = await requireUser();
  await supabase.from("nutrition_plans").delete().eq("user_id", user.id);
  revalidatePath("/goals");
  revalidatePath("/daily");
}
