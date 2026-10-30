import type { createClient } from "@/lib/supabase/server";
import { calcPlan, type Activity, type Goal, type PlanResult, type Sex } from "@/lib/nutrition";

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
    .select("weight, month")
    .eq("user_id", userId)
    .not("weight", "is", null)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startMonth = plan.start_date.slice(0, 7) + "-01";
  const currentWeight = m && String(m.month) >= startMonth ? Number(m.weight) : Number(plan.start_weight_kg);
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

  return { plan, currentWeight, goalWeight, reached, result: res.ok ? (res as PlanResult) : null };
}
