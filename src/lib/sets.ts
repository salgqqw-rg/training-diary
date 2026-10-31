// Разбор и ограничение значений подхода. Без зависимостей — модуль покрыт тестами.

export const LIMITS = { weight: 1000, reps: 100, rest: 3600 } as const;

const fin = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? n : null;
};

export const clampWeight = (v: unknown) => Math.min(LIMITS.weight, Math.max(0, fin(v) ?? 0));
export const clampReps = (v: unknown) => Math.min(LIMITS.reps, Math.max(0, Math.round(fin(v) ?? 0)));
export const clampRir = (v: unknown) => { const n = fin(v); return n === null ? null : Math.min(10, Math.max(0, Math.round(n))); }; // в базе RIR — целое
export const clampRpe = (v: unknown) => { const n = fin(v); return n === null ? null : Math.min(10, Math.max(1, n)); };
export const clampRest = (v: unknown) => { const n = fin(v); return n === null ? null : Math.min(LIMITS.rest, Math.max(0, Math.round(n))); };

export type ParsedSet = { weight: number; reps: number; rir: number | null };

/** «80x8, 82,5×6 @2» → [{80, 8, null}, {82.5, 6, 2}]. Запятая может быть и разделителем, и десятичной —
 *  поэтому ищем шаблоны «вес x повторы», а не режем строку по запятым. Нераспознанное пропускается */
export function parseSeries(raw: string): ParsedSet[] {
  const out: ParsedSet[] = [];
  for (const m of raw.matchAll(/(\d+(?:[.,]\d+)?)\s*[xX×*хХ]\s*(\d{1,3})(?:\s*@\s*(\d{1,2}))?/g)) {
    const reps = clampReps(m[2]);
    if (!reps) continue;
    out.push({ weight: clampWeight(m[1]), reps, rir: m[3] !== undefined ? clampRir(m[3]) : null });
  }
  return out;
}
