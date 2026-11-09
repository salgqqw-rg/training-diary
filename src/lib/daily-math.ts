// Чистая логика раздела «Питание и сон»: без зависимостей, её проверяют тесты (tests/daily-math.test.ts).
// Без импорта из dates.ts: тесты запускаются node без разрешения путей без расширения, а tsc не принимает «.ts» в импорте
const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export type Macros = { grams: number; kcal: number; protein_g: number; fat_g: number; carbs_g: number };

/** Те же продукт и КБЖУ, но на другую массу: всё пересчитывается пропорционально */
export function scaleMeal<T extends Macros>(e: T, grams: number): T {
  const k = e.grams > 0 ? grams / e.grams : 1;
  return {
    ...e,
    grams: r1(grams),
    kcal: r1(e.kcal * k),
    protein_g: r1(e.protein_g * k),
    fat_g: r1(e.fat_g * k),
    carbs_g: r1(e.carbs_g * k),
  };
}

/** Семь дней недели (пн—вс), в которую попадает дата */
export function weekOf(date: string): string[] {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = понедельник
  const monday = shiftDay(date, -dow);
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

/** Добавка действует в этот день: дата начала не позже, окончания не раньше (пустая граница — без ограничения) */
export function activeOn(s: { start_date?: string | null; end_date?: string | null }, date: string): boolean {
  return (!s.start_date || String(s.start_date) <= date) && (!s.end_date || String(s.end_date) >= date);
}

/** Среднее по дням, где значение есть и больше нуля (0 ккал или 0 мл значит «не вносили»). n — сколько дней учтено */
export function avgOf(values: unknown[]): { avg: number; n: number } {
  const v = values.map((x) => (x === null || x === undefined || x === "" ? NaN : Number(x))).filter((x) => Number.isFinite(x) && x > 0);
  return { avg: v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0, n: v.length };
}

/** Недавние продукты: по одному на название (без учёта регистра), самые свежие первыми. rows уже отсортированы от новых к старым */
export function recentFoods<T extends { name: string }>(rows: T[], limit = 12): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = r.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
