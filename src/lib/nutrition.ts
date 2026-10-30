// Расчёт суточной нормы по анкете (как в FatSecret): BMR по Mifflin-St Jeor,
// затем коэффициент активности и поправка на темп набора / сброса веса.
// Чистые функции без зависимостей — работают и на сервере, и в форме на клиенте.

export type Goal = "lose" | "maintain" | "gain";
export type Sex = "male" | "female";

export const GOALS: Record<Goal, string> = {
  lose: "Сбросить вес",
  maintain: "Поддерживать вес",
  gain: "Набрать вес",
};

export const ACTIVITY = {
  sedentary: { mult: 1.2, label: "Сидячий", hint: "Работа за столом, тренировок почти нет" },
  light: { mult: 1.375, label: "Лёгкая активность", hint: "1–3 тренировки в неделю" },
  moderate: { mult: 1.55, label: "Умеренная", hint: "3–5 тренировок в неделю" },
  active: { mult: 1.725, label: "Высокая", hint: "6–7 тренировок в неделю" },
  very_active: { mult: 1.9, label: "Очень высокая", hint: "Тяжёлый физический труд плюс тренировки" },
} as const;
export type Activity = keyof typeof ACTIVITY;

// Допустимый темп, кг в неделю
export const PACES: Record<Exclude<Goal, "maintain">, number[]> = {
  lose: [0.25, 0.5, 0.75, 1],
  gain: [0.25, 0.5],
};

const KCAL_PER_KG = 7700;
const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };
const PROTEIN_PER_KG: Record<Goal, number> = { lose: 2, maintain: 1.6, gain: 1.8 };

export type PlanInput = {
  goal: Goal;
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number; // текущий вес
  goalWeightKg: number;
  activity: Activity;
  paceKgWeek: number;
};

export type PlanResult = {
  ok: true;
  age: number;
  bmi: number;
  bmr: number;
  tdee: number;
  kcal: number;
  deltaKcal: number; // с учётом знака: минус — дефицит, плюс — профицит
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  weeks: number | null;
  clamped: boolean; // норма подтянута к безопасному минимуму
};

export function ageOn(birth: string, now = new Date()): number {
  const b = new Date(birth + "T00:00:00Z");
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() ||
      (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function calcPlan(i: PlanInput, now = new Date()): PlanResult | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.birthDate) || Number.isNaN(Date.parse(i.birthDate))) {
    return { ok: false, error: "Укажите дату рождения" };
  }
  const age = ageOn(i.birthDate, now);
  if (age < 18 || age > 100) return { ok: false, error: "Расчёт рассчитан на возраст от 18 до 100 лет" };
  if (!(i.heightCm >= 100 && i.heightCm <= 250)) return { ok: false, error: "Рост должен быть от 100 до 250 см" };
  if (!(i.weightKg >= 30 && i.weightKg <= 300)) return { ok: false, error: "Текущий вес должен быть от 30 до 300 кг" };

  const goalW = i.goal === "maintain" ? i.weightKg : i.goalWeightKg;
  if (!(goalW >= 30 && goalW <= 300)) return { ok: false, error: "Желаемый вес должен быть от 30 до 300 кг" };
  if (i.goal === "lose" && goalW >= i.weightKg) return { ok: false, error: "Для сброса веса желаемый вес должен быть меньше текущего" };
  if (i.goal === "gain" && goalW <= i.weightKg) return { ok: false, error: "Для набора веса желаемый вес должен быть больше текущего" };

  const pace = i.goal === "maintain" ? 0 : i.paceKgWeek;
  if (i.goal !== "maintain" && !PACES[i.goal].includes(pace)) return { ok: false, error: "Выберите темп из списка" };

  const bmr = 10 * i.weightKg + 6.25 * i.heightCm - 5 * age + (i.sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY[i.activity].mult;
  const sign = i.goal === "lose" ? -1 : i.goal === "gain" ? 1 : 0;
  let kcal = tdee + (sign * pace * KCAL_PER_KG) / 7;
  let clamped = false;
  if (kcal < MIN_KCAL[i.sex]) { kcal = MIN_KCAL[i.sex]; clamped = true; }
  kcal = Math.round(kcal);

  const protein = Math.round(i.weightKg * PROTEIN_PER_KG[i.goal]);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  // Реальный темп мог упасть из-за безопасного минимума
  const effPace = sign === 0 ? 0 : (Math.abs(kcal - tdee) * 7) / KCAL_PER_KG;
  const weeks = sign === 0 || effPace <= 0 ? null : Math.ceil(Math.abs(goalW - i.weightKg) / effPace);

  return {
    ok: true, age, bmi: i.weightKg / (i.heightCm / 100) ** 2,
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, deltaKcal: Math.round(kcal - tdee),
    protein_g: protein, fat_g: fat, carbs_g: carbs, weeks, clamped,
  };
}
