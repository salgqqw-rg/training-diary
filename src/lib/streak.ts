import { loadUserSets, type UserSet } from "./user-sets";
import { streakOf } from "./dates";

// Питание: дни подряд, в которые записана еда (калории за день из daily_logs — туда же складываются приёмы пищи).
// Тренировки: число записей — каждая проведённая тренировка (есть подход с весом и повторами, не позже сегодня) +1, подряд не нужно.
// Подходы можно передать, если страница уже их загрузила.
export async function loadStreak(supabase: any, userId: string, today: string, sets?: UserSet[]) {
  const [all, { data: food }] = await Promise.all([
    sets ?? loadUserSets(supabase, userId),
    supabase.from("daily_logs").select("log_date").eq("user_id", userId).gt("kcal", 0).lte("log_date", today)
      .order("log_date", { ascending: false }).limit(400), // shortcut: еда старше 400 дней не видна, нужна только при серии длиннее 400
  ]);
  const done = all.filter((s) => s.weight > 0 && s.reps > 0 && s.date <= today);
  return {
    food: streakOf(((food ?? []) as { log_date: string }[]).map((r) => String(r.log_date)), today),
    workouts: new Set(done.map((s) => s.workoutId ?? s.date)).size,
  };
}
