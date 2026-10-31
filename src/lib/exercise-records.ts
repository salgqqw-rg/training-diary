import { norm } from "@/lib/exercise-catalog";
import { loadUserSets } from "@/lib/user-sets";

export type Rec = { best: number; bestReps: number; sets: number; last: string };

// Рекорды пользователя по названию упражнения (без регистра, ё = е)
export async function loadRecords(supabase: any, userId: string): Promise<Map<string, Rec>> {
  const out = new Map<string, Rec>();
  for (const s of await loadUserSets(supabase, userId)) {
    if (!s.name) continue;
    const key = norm(s.name);
    const r = out.get(key) ?? { best: 0, bestReps: 0, sets: 0, last: "" };
    r.sets++;
    if (s.weight > r.best) { r.best = s.weight; r.bestReps = s.reps; }
    if (s.date > r.last) r.last = s.date;
    out.set(key, r);
  }
  return out;
}
