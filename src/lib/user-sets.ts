import { fetchAll } from "./fetch-all";

// Все подходы пользователя одной плоской таблицей (для прогресса, статистики, рекордов, экспорта)
export type UserSet = {
  id: string;
  name: string;
  weight: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  rest: number | null;
  setNumber: number;
  date: string;       // дата тренировки, а если не задана — день записи
  week: number | null;
  workoutId: string | null;
  workoutNote: string | null;
  cycleId: string;
  cycleName: string;
};

const SELECT =
  "id, weight, reps, rir, rpe, rest_sec, set_number, created_at, cycle_id, " +
  "exercises(name, workout_id, workouts(workout_date, week_number, note)), cycles!inner(user_id, name)";

const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// Читает постранично: у Supabase лимит 1000 строк на запрос
export async function loadUserSets(supabase: any, userId: string): Promise<UserSet[]> {
  const rows = await fetchAll<any>((from, to) =>
    supabase.from("workout_sets").select(SELECT).eq("cycles.user_id", userId).order("id").range(from, to),
  );
  return rows.map((s) => {
    const ex = s.exercises;
    const w = ex?.workouts;
    return {
      id: s.id,
      name: ex?.name ?? "",
      weight: Number(s.weight),
      reps: Number(s.reps),
      rir: numOrNull(s.rir),
      rpe: numOrNull(s.rpe),
      rest: numOrNull(s.rest_sec),
      setNumber: Number(s.set_number),
      date: w?.workout_date ?? String(s.created_at).slice(0, 10),
      week: numOrNull(w?.week_number),
      workoutId: ex?.workout_id ?? null,
      workoutNote: w?.note ?? null,
      cycleId: s.cycle_id,
      cycleName: s.cycles?.name ?? "",
    };
  });
}
