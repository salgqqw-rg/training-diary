// «В прошлый раз»: последняя прошлая тренировка с тем же упражнением. Без зависимостей — покрыто тестами.

export type PrevRow = {
  name: string;
  workoutId: string;
  date: string | null; // дата тренировки
  createdAt: string;
  sets: { weight: number; reps: number; setNumber: number }[];
};
export type Previous = { date: string; sets: { weight: number; reps: number }[] };

const key = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");

/** Для каждого упражнения — самая свежая прошлая тренировка (не позже текущей, если у неё есть дата) */
export function pickPrevious(rows: PrevRow[], currentWorkoutId: string, currentDate: string | null): Map<string, Previous> {
  const best = new Map<string, { sort: string; created: string; prev: Previous }>();
  for (const r of rows) {
    if (r.workoutId === currentWorkoutId) continue;
    const sets = r.sets.filter((s) => s.weight > 0 && s.reps > 0).sort((a, b) => a.setNumber - b.setNumber);
    if (!sets.length) continue;
    const date = r.date ?? r.createdAt.slice(0, 10);
    if (currentDate && date > currentDate) continue;
    const k = key(r.name);
    const cur = best.get(k);
    if (!cur || date > cur.sort || (date === cur.sort && r.createdAt > cur.created)) {
      best.set(k, { sort: date, created: r.createdAt, prev: { date, sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })) } });
    }
  }
  return new Map([...best].map(([k, v]) => [k, v.prev]));
}
