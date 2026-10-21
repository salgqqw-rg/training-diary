export type SetRow = {
  exercise: string;
  week: number;
  weight: number;
  reps: number;
  rir: number | null;
};

export type Point = { week: number; maxWeight: number; e1rm: number };

export type ExerciseStat = {
  name: string;
  points: Point[];
  progressPct: number | null; // прирост веса от первой недели к последней
  bestE1rm: number;
};

// Расчётный 1RM по Эпли с учётом RIR: повторы + RIR = сколько было бы при отказе
export function estimate1RM(weight: number, reps: number, rir: number | null): number {
  return weight * (1 + (reps + (rir ?? 0)) / 30);
}

export function buildStats(rows: SetRow[]): ExerciseStat[] {
  const byExercise = new Map<string, Map<number, Point>>();
  const names = new Map<string, string>();

  for (const r of rows) {
    if (r.weight <= 0 || r.reps <= 0) continue;
    const key = r.exercise.trim().toLowerCase();
    if (!names.has(key)) names.set(key, r.exercise.trim());
    const weeks = byExercise.get(key) ?? new Map<number, Point>();
    const cur = weeks.get(r.week) ?? { week: r.week, maxWeight: 0, e1rm: 0 };
    weeks.set(r.week, {
      week: r.week,
      maxWeight: Math.max(cur.maxWeight, r.weight),
      e1rm: Math.max(cur.e1rm, estimate1RM(r.weight, r.reps, r.rir)),
    });
    byExercise.set(key, weeks);
  }

  return [...byExercise.entries()].map(([key, weeks]) => {
    const points = [...weeks.values()].sort((a, b) => a.week - b.week);
    const first = points[0];
    const last = points[points.length - 1];
    return {
      name: names.get(key) ?? key,
      points,
      progressPct: points.length > 1 ? ((last.maxWeight - first.maxWeight) / first.maxWeight) * 100 : null,
      bestE1rm: Math.max(...points.map((p) => p.e1rm)),
    };
  });
}
