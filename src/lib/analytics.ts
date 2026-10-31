// Расчёты прогресса: расчётный 1RM, ряды по датам, рекорды, недельный объём.
// Без зависимостей — покрыто тестами в tests/analytics.test.ts.

export type SetFact = {
  name: string;
  weight: number;
  reps: number;
  rir: number | null;
  date: string; // «ГГГГ-ММ-ДД»
};

/** Расчётный 1RM по Эпли с учётом RIR: повторы + RIR = сколько было бы при отказе */
export function estimate1RM(weight: number, reps: number, rir: number | null): number {
  return weight * (1 + (reps + (rir ?? 0)) / 30);
}

export type Metric = "weight" | "e1rm" | "volume";
export const METRICS: Record<Metric, { label: string; unit: string }> = {
  weight: { label: "Рабочий вес", unit: "кг" },
  e1rm: { label: "Расчётный 1RM", unit: "кг" },
  volume: { label: "Объём", unit: "кг" },
};

const key = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");

/** Значение метрики по каждой дате для одного упражнения (по возрастанию даты) */
export function seriesByDate(sets: SetFact[], name: string, metric: Metric): { date: string; value: number }[] {
  const k = key(name);
  const byDate = new Map<string, number>();
  for (const s of sets) {
    if (key(s.name) !== k || s.weight <= 0 || s.reps <= 0) continue;
    const v = metric === "weight" ? s.weight
      : metric === "e1rm" ? estimate1RM(s.weight, s.reps, s.rir)
      : s.weight * s.reps;
    const cur = byDate.get(s.date) ?? 0;
    byDate.set(s.date, metric === "volume" ? cur + v : Math.max(cur, v));
  }
  return [...byDate].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

export type ExerciseBest = {
  name: string;
  weight: number;     // максимальный вес
  weightReps: number; // повторы в подходе с макс. весом
  e1rm: number;       // лучший расчётный 1RM
  last: string;       // дата последней тренировки
  sets: number;
};

/** Лучшие результаты по каждому упражнению; сверху — те, что тренировались недавно.
 *  Упражнения между собой не сравниваются: рекорд жима и рекорд приседа — разные вещи. */
export function bestByExercise(sets: SetFact[]): ExerciseBest[] {
  const map = new Map<string, ExerciseBest>();
  for (const s of sets) {
    if (!s.name || s.weight <= 0 || s.reps <= 0) continue;
    const k = key(s.name);
    const cur = map.get(k) ?? { name: s.name.trim(), weight: 0, weightReps: 0, e1rm: 0, last: "", sets: 0 };
    cur.sets++;
    if (s.weight > cur.weight || (s.weight === cur.weight && s.reps > cur.weightReps)) {
      cur.weight = s.weight;
      cur.weightReps = s.reps;
    }
    cur.e1rm = Math.max(cur.e1rm, estimate1RM(s.weight, s.reps, s.rir));
    if (s.date > cur.last) cur.last = s.date;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last) || b.sets - a.sets);
}

export type NewRecord = { name: string; e1rm: number; previous: number; date: string };

/** Упражнения, где с даты since расчётный 1RM превысил всё, что было раньше (и раньше что-то было) */
export function newRecords(sets: SetFact[], since: string): NewRecord[] {
  const before = new Map<string, number>();
  const after = new Map<string, { name: string; e1rm: number; date: string }>();
  for (const s of sets) {
    if (!s.name || s.weight <= 0 || s.reps <= 0) continue;
    const k = key(s.name);
    const v = estimate1RM(s.weight, s.reps, s.rir);
    if (s.date < since) {
      before.set(k, Math.max(before.get(k) ?? 0, v));
    } else {
      const cur = after.get(k);
      if (!cur || v > cur.e1rm) after.set(k, { name: s.name.trim(), e1rm: v, date: s.date });
    }
  }
  const out: NewRecord[] = [];
  for (const [k, a] of after) {
    const prev = before.get(k);
    if (prev !== undefined && a.e1rm > prev * 1.0005) out.push({ name: a.name, e1rm: a.e1rm, previous: prev, date: a.date });
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

/** Понедельник недели, в которую попадает дата */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Пн = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** Объём (вес × повторы) и число подходов по неделям за последние weeks недель, включая текущую */
export function weeklyVolume(
  sets: { weight: number; reps: number; date: string }[],
  today: string,
  weeks: number,
): { week: string; volume: number; sets: number }[] {
  const out: { week: string; volume: number; sets: number }[] = [];
  const idx = new Map<string, number>();
  const first = new Date(`${weekStart(today)}T00:00:00Z`);
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    const w = d.toISOString().slice(0, 10);
    idx.set(w, out.length);
    out.push({ week: w, volume: 0, sets: 0 });
  }
  for (const s of sets) {
    const i = idx.get(weekStart(s.date));
    if (i === undefined || s.weight <= 0 || s.reps <= 0) continue;
    out[i].volume += s.weight * s.reps;
    out[i].sets++;
  }
  return out;
}

// ---- Статистика по неделям цикла (страница цикла) ----
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

export function buildStats(rows: SetRow[]): ExerciseStat[] {
  const byExercise = new Map<string, Map<number, Point>>();
  const names = new Map<string, string>();

  for (const r of rows) {
    if (r.weight <= 0 || r.reps <= 0) continue;
    const k = r.exercise.trim().toLowerCase();
    if (!names.has(k)) names.set(k, r.exercise.trim());
    const weeks = byExercise.get(k) ?? new Map<number, Point>();
    const cur = weeks.get(r.week) ?? { week: r.week, maxWeight: 0, e1rm: 0 };
    weeks.set(r.week, {
      week: r.week,
      maxWeight: Math.max(cur.maxWeight, r.weight),
      e1rm: Math.max(cur.e1rm, estimate1RM(r.weight, r.reps, r.rir)),
    });
    byExercise.set(k, weeks);
  }

  return [...byExercise.entries()].map(([k, weeks]) => {
    const points = [...weeks.values()].sort((a, b) => a.week - b.week);
    const first = points[0];
    const last = points[points.length - 1];
    return {
      name: names.get(k) ?? k,
      points,
      progressPct: points.length > 1 ? ((last.maxWeight - first.maxWeight) / first.maxWeight) * 100 : null,
      bestE1rm: Math.max(...points.map((p) => p.e1rm)),
    };
  });
}
