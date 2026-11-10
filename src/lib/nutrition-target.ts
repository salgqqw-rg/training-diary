import type { createClient } from "@/lib/supabase/server";
import { calcPlan, withCustomMacros, type Activity, type Goal, type PlanResult, type Sex } from "@/lib/nutrition";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type PlanRow = {
  user_id: string;
  goal: Goal;
  sex: Sex;
  birth_date: string;
  height_cm: number;
  start_weight_kg: number;
  goal_weight_kg: number;
  activity: Activity;
  pace_kg_week: number;
  start_date: string;
  // Ручные БЖУ (migration 25): все три заданы или все null
  custom_protein_g: number | null;
  custom_fat_g: number | null;
  custom_carbs_g: number | null;
};

// Анкета + текущий вес (последний замер после старта) + пересчитанная норма.
// Вес в замерах обновился — норма пересчитывается сама. null — анкеты нет
// (или таблица ещё не создана миграцией 16).
export async function loadPlan(supabase: Supa, userId: string) {
  const { data } = await supabase.from("nutrition_plans").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const plan = data as PlanRow;

  const { data: m } = await supabase
    .from("measurements")
    .select("weight, measured_on")
    .eq("user_id", userId)
    .not("weight", "is", null)
    .order("measured_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentWeight = m && String(m.measured_on) >= plan.start_date.slice(0, 10) ? Number(m.weight) : Number(plan.start_weight_kg);
  const goalWeight = Number(plan.goal_weight_kg);

  // Цель достигнута — дальше считаем норму на поддержание веса
  const reached =
    (plan.goal === "lose" && currentWeight <= goalWeight) ||
    (plan.goal === "gain" && currentWeight >= goalWeight);

  const res = calcPlan({
    goal: reached ? "maintain" : plan.goal,
    sex: plan.sex,
    birthDate: plan.birth_date,
    heightCm: Number(plan.height_cm),
    weightKg: currentWeight,
    goalWeightKg: goalWeight,
    activity: plan.activity,
    paceKgWeek: Number(plan.pace_kg_week),
  });

  const { custom_protein_g: p, custom_fat_g: f, custom_carbs_g: c } = plan;
  const custom = p != null && f != null && c != null;
  const calc = res.ok ? (res as PlanResult) : null;

  return { plan, currentWeight, goalWeight, reached, custom, result: calc && custom ? withCustomMacros(calc, p, f, c) : calc };
}

export type ManualRow = {
  kcal: number;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  set_by: string;
  updated_at: string;
};

// Норма, заданная вручную (самим человеком или тренером). null — не задана
// (или таблица ещё не создана миграцией 29). Она главнее расчёта по анкете.
export async function loadManualTarget(supabase: Supa, userId: string): Promise<ManualRow | null> {
  const { data } = await supabase
    .from("nutrition_targets")
    .select("kcal, protein_g, fat_g, carbs_g, set_by, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ManualRow | null) ?? null;
}
