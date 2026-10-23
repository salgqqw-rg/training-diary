import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DumbbellIcon } from "@/components/icons";

const fmt = (n: number, max = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: max });

// «Упражнения» — сводка: все упражнения пользователя, рекордные веса и ссылки в Прогресс
export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cycles } = await supabase
    .from("cycles").select("id").eq("user_id", user.id);
  const ids = (cycles ?? []).map((c) => c.id);

  const { data: sets } = ids.length
    ? await supabase.from("workout_sets")
        .select("weight, reps, created_at, exercises(name, workouts(workout_date))")
        .in("cycle_id", ids)
    : { data: null };

  type Row = { name: string; weight: number; reps: number; date: string };
  const rows: Row[] = ((sets ?? []) as any[]).map((s) => ({
    name: s.exercises?.name ?? "",
    weight: Number(s.weight),
    reps: Number(s.reps),
    date: s.exercises?.workouts?.workout_date ?? String(s.created_at).slice(0, 10),
  })).filter((r) => r.name);

  if (!rows.length) {
    return (
      <>
        <h1>Упражнения</h1>
        <p className="muted">
          Список соберётся автоматически — добавь упражнения и подходы с весом в <Link href="/diary">Дневнике</Link>
        </p>
      </>
    );
  }

  // Группировка по названию: рекорд, объём, последнее занятие
  type Agg = { name: string; best: number; bestReps: number; setsCount: number; lastDate: string; lastWeight: number };
  const agg = new Map<string, Agg>();
  for (const r of rows) {
    let a = agg.get(r.name);
    if (!a) {
      a = { name: r.name, best: 0, bestReps: 0, setsCount: 0, lastDate: "", lastWeight: 0 };
      agg.set(r.name, a);
    }
    a.setsCount++;
    if (r.weight > a.best) { a.best = r.weight; a.bestReps = r.reps; }
    if (r.date >= a.lastDate) { a.lastDate = r.date; a.lastWeight = r.weight; }
  }
  const list = [...agg.values()].sort((x, y) => y.lastDate.localeCompare(x.lastDate));

  return (
    <>
      <h1>Упражнения</h1>
      <p className="muted" style={{ margin: "-8px 0 16px" }}>
        {list.length} упр. · {fmt(rows.length, 0)} подходов записано
      </p>
      <div className="ex-grid">
        {list.map((a) => (
          <Link key={a.name} href={`/progress?ex=${encodeURIComponent(a.name)}`} className="ex-card">
            <b>{a.name}</b>
            <span className="muted" style={{ display: "block", fontSize: 13 }}>
              рекорд {fmt(a.best)} кг × {a.bestReps}
            </span>
            <span className="muted" style={{ display: "block", fontSize: 13 }}>
              {a.setsCount} подход. · последний {a.lastDate}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
