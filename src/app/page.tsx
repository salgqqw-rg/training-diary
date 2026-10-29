import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Line } from "@/components/chart";
import { ChevronIcon, BoltIcon } from "@/components/icons";

const fmt = (n: number, max = 1) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: max });

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: cycles }, { data: measures }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("cycles").select("id, name, weeks_count").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("measurements").select("weight, measured_on").eq("user_id", user.id).order("measured_on"),
  ]);

  const name = profile?.display_name ?? "чемпион";
  const cycle = cycles?.[0];
  const ids = (cycles ?? []).map((c) => c.id);

  const today = new Date().toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const d60 = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);

  const [{ data: recent }, { data: next }, { data: sets }, { count: wCount }] = ids.length
    ? await Promise.all([
        supabase.from("workouts").select("id, workout_date, note, cycle_id, cycles(name)")
          .in("cycle_id", ids).order("workout_date", { ascending: false, nullsFirst: false }).limit(5),
        supabase.from("workouts").select("id, workout_date, note, cycle_id, cycles(name)")
          .in("cycle_id", ids).gte("workout_date", today).order("workout_date").limit(1),
        supabase.from("workout_sets").select("weight, reps, created_at").in("cycle_id", ids),
        supabase.from("workouts").select("id", { count: "exact", head: true }).in("cycle_id", ids),
      ])
    : [{ data: null }, { data: null }, { data: null }, { count: null }];

  const planName = (r: { cycles: unknown }) =>
    (Array.isArray(r.cycles) ? r.cycles[0]?.name : (r.cycles as { name?: string } | null)?.name);

  // Вес: история, текущий, дельта
  const weights = (measures ?? []).map((m) => Number(m.weight)).filter((w) => w > 0);
  const wLast = weights.at(-1) ?? null;
  const wPrev = weights.at(-2) ?? null;
  const wFirst = weights[0] ?? null;
  const gainPct = wFirst && wLast && wFirst !== wLast
    ? ((wLast - wFirst) / wFirst) * 100 : null;

  // Объём и подходы за последние / предыдущие 30 дней
  const stat = (sets ?? []) as { weight: number; reps: number; created_at: string }[];
  const inRange = (s: { created_at: string }, a: string, b: string) =>
    s.created_at.slice(0, 10) >= a && s.created_at.slice(0, 10) < b;
  const cur30 = stat.filter((s) => inRange(s, d30, "9999-12-31"));
  const prev30 = stat.filter((s) => inRange(s, d60, d30));
  const vol = (arr: typeof stat) => arr.reduce((t, s) => t + Number(s.weight) * Number(s.reps), 0);
  const volPct = prev30.length && cur30.length ? ((vol(cur30) - vol(prev30)) / vol(prev30)) * 100 : null;

  const recentRows = (recent ?? []) as { id: string; workout_date: string | null; note: string | null; cycle_id: string; cycles: unknown }[];
  const nextRow = ((next ?? []) as typeof recentRows)[0] ?? null;

  return (
    <>
      <h1>Привет, {name}</h1>
      <p className="muted" style={{ margin: "-8px 0 18px" }}>Продолжай — ты на правильном пути!</p>

      <div className="kpi-grid">
        <div className="card kpi">
          <div className="t">Текущая программа</div>
          <div className="v">{cycle?.name ?? "Нет программы"}</div>
          <span className="s">{cycle ? `${fmt(cycle.weeks_count, 0)} нед.` : "Создай план в Дневнике"}</span>
          {cycle && <Link className="sm-link" style={{ marginTop: 8, display: "inline-block" }} href={`/cycles/${cycle.id}`}>Подробнее</Link>}
        </div>
        <div className="card kpi">
          <div className="t">Общий прогресс</div>
          <div className="v">{gainPct === null ? "—" : `${gainPct > 0 ? "+" : ""}${gainPct.toFixed(1)}%`}</div>
          <span className="s">от первого замера</span>
        </div>
        <div className="card kpi">
          <div className="t">Завершено тренировок</div>
          <div className="v">{fmt(wCount ?? 0, 0)}</div>
          <span className="s">записей в дневнике</span>
        </div>
        <div className="card kpi">
          <div className="t">Текущий вес</div>
          <div className="v">{wLast ? `${fmt(wLast)} кг` : "—"}</div>
          {wLast && wPrev && wLast !== wPrev && (
            <span className={wLast > wPrev ? "s up" : "s down"}>
              {wLast > wPrev ? "↑" : "↓"} {fmt(Math.abs(wLast - wPrev))} кг к прошлому замеру
            </span>
          )}
        </div>
      </div>

      <div className="dash-grid">
        <aside className="banner">
          <h2>Сила<br />в деталях</h2>
          <p>Планируй. Выполняй. Расти.</p>
          <Link href="/diary" className="banner-btn">Перейти к тренировкам</Link>
        </aside>

        <section className="card">
          <h3>Ближайшая тренировка</h3>
          {nextRow ? (
            <>
              <b>{planName(nextRow) ?? "План"}</b>
              <p className="muted" style={{ margin: "6px 0 12px" }}>
                {nextRow.workout_date}{nextRow.note ? ` · ${nextRow.note}` : ""}
              </p>
              <Link href={`/cycles/${nextRow.cycle_id}`} className="primary banner-btn" style={{ margin: 0 }}>
                Начать тренировку
              </Link>
            </>
          ) : (
            <p className="muted">Запланируй дату тренировки в Дневнике — и она появится здесь</p>
          )}
        </section>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h3>Последние тренировки</h3>
          {recentRows.length ? recentRows.map((r) => (
            <Link key={r.id} href={`/cycles/${r.cycle_id}`} className="w-row">
              <span className="ico"><BoltIcon /></span>
              <span>
                <b>{planName(r) ?? "План"}</b>
                <span className="muted">{r.note ?? "Тренировка"} · {r.workout_date ?? "дата не задана"}</span>
              </span>
              <span className="chev"><ChevronIcon /></span>
            </Link>
          )) : (
            <p className="muted">Пока нет ни одной тренировки</p>
          )}
        </section>

        <section className="card">
          <h3>Твой прогресс</h3>
          {weights.length >= 2 ? (
            <>
              <Line values={weights} height={150} gradId="dash" />
              <div className="mini-metrics">
                <div><span className="muted">Вес</span><b>{wLast ? `${fmt(wLast)} кг` : "—"}</b></div>
                <div><span className="muted">Объём · 30 дн.</span>
                  <b className={volPct === null ? "" : volPct >= 0 ? "up" : "down"}>
                    {volPct === null ? "—" : `${volPct > 0 ? "+" : ""}${volPct.toFixed(0)}%`}
                  </b>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">Отметь вес в Характеристиках — график появится здесь</p>
          )}
        </section>
      </div>
    </>
  );
}
