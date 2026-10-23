import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Line } from "@/components/chart";

const fmt = (n: number, max = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: max });
const short = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);

const PERIODS = [
  { d: 7, label: "7 дней" },
  { d: 30, label: "30 дней" },
  { d: 90, label: "3 месяца" },
  { d: 365, label: "1 год" },
];

// «Прогресс» — график максимального веса по упражнению + личные рекорды (макет IRONLOG)
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ ex?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cycles } = await supabase.from("cycles").select("id").eq("user_id", user.id);
  const ids = (cycles ?? []).map((c) => c.id);

  const { data: sets } = ids.length
    ? await supabase.from("workout_sets")
        .select("weight, created_at, exercises(name, workouts(workout_date))")
        .in("cycle_id", ids)
    : { data: null };

  type Row = { name: string; weight: number; date: string };
  const rows: Row[] = ((sets ?? []) as any[]).map((s) => ({
    name: s.exercises?.name ?? "",
    weight: Number(s.weight),
    date: s.exercises?.workouts?.workout_date ?? String(s.created_at).slice(0, 10),
  })).filter((r) => r.name && r.weight > 0);

  if (!rows.length) {
    return (
      <>
        <h1>Прогресс</h1>
        <p className="muted">
          Графики появятся, когда запишешь веса в <Link href="/diary">Дневнике</Link>
        </p>
      </>
    );
  }

  // Точки по датам: максимальный вес за дату (по каждому упражнению отдельно)
  const byEx = new Map<string, Map<string, number>>();
  const best = new Map<string, number>();
  for (const r of rows) {
    const m = byEx.get(r.name) ?? new Map<string, number>();
    m.set(r.date, Math.max(m.get(r.date) ?? 0, r.weight));
    byEx.set(r.name, m);
    best.set(r.name, Math.max(best.get(r.name) ?? 0, r.weight));
  }
  const names = [...byEx.keys()];
  const lastActive = new Map(names.map((n) => {
    const dates = [...byEx.get(n)!.keys()];
    return [n, dates.reduce((a, b) => (b > a ? b : a), "")];
  }));

  // Выбранное упражнение: из адреса, иначе последнее активное
  const selected = sp.ex && byEx.has(sp.ex)
    ? sp.ex
    : names.sort((a, b) => lastActive.get(b)!.localeCompare(lastActive.get(a)!))[0];

  const days = Number(sp.d ?? 0);
  const cut = days > 0 ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10) : "";
  const allPts = [...byEx.get(selected)!].sort();
  const pts = cut ? allPts.filter(([d]) => d >= cut) : allPts;
  const values = pts.map(([, w]) => w);

  const lastW = values.at(-1) ?? null;
  const prevW = values.at(-2) ?? null;
  const delta = lastW !== null && lastW !== prevW ? (lastW ?? 0) - (prevW ?? 0) : null;

  const records = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <>
      <h1>Прогресс</h1>

      <div className="card">
        <div className="chart-head">
          <div>
            <h3>{selected}</h3>
            <span className="muted" style={{ fontSize: 13 }}>Вес (кг)</span>
          </div>
          <div className="chart-box">
            <div className="v">{lastW ? `${fmt(lastW)} кг` : "—"}</div>
            {delta !== null && (
              <div className={`s ${delta > 0 ? "up" : "down"}`}>
                {delta > 0 ? "↑" : "↓"} {fmt(Math.abs(delta))} кг к прошлой дате
              </div>
            )}
          </div>
        </div>

        <div className="tabs" style={{ margin: "4px 0 14px" }}>
          {[...PERIODS, { d: 0, label: "Всё время" }].map((p) => (
            <Link key={p.d} href={`/progress?ex=${encodeURIComponent(selected)}&d=${p.d}`}
              className={`tab${days === p.d ? " on" : ""}`}>
              {p.label}
            </Link>
          ))}
        </div>

        <Line values={values} labels={pts.length >= 2 ? [short(pts[0][0]), short(pts[pts.length - 1][0])] : undefined}
          height={280} gradId="prog" />
      </div>

      <div className="card">
        <h3>Личные рекорды</h3>
        <div className="rec-grid">
          {records.map(([name, w]) => (
            <Link key={name} href={`/progress?ex=${encodeURIComponent(name)}`} className="rec">
              <span className="n">{name}</span>
              <b>{fmt(w)} кг</b>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
