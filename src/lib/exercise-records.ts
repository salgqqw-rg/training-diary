import { norm } from "@/lib/exercise-catalog";

export type Rec = { best: number; bestReps: number; sets: number; last: string };

// Рекорды пользователя по названию упражнения (без регистра, ё = е)
export async function loadRecords(supabase: any, userId: string): Promise<Map<string, Rec>> {
  const out = new Map<string, Rec>();
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("weight, reps, created_at, exercises(name, workouts(workout_date)), cycles!inner(user_id)")
    .eq("cycles.user_id", userId);
  for (const s of (sets ?? []) as any[]) {
    const name = s.exercises?.name;
    if (!name) continue;
    const key = norm(name);
    const w = Number(s.weight), date = s.exercises?.workouts?.workout_date ?? String(s.created_at).slice(0, 10);
    const r = out.get(key) ?? { best: 0, bestReps: 0, sets: 0, last: "" };
    r.sets++;
    if (w > r.best) { r.best = w; r.bestReps = Number(s.reps); }
    if (date > r.last) r.last = date;
    out.set(key, r);
  }
  return out;
}
