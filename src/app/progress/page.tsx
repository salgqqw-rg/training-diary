import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { today as getToday } from "@/lib/today";
import { shiftDay } from "@/lib/dates";
import { Line } from "@/components/chart";
import { CATALOG } from "@/lib/exercise-catalog";
import { loadUserSets } from "@/lib/user-sets";
import { bestByExercise, METRICS, newRecords, seriesByDate, weeklyVolume, type Metric } from "@/lib/analytics";
import { GROUPS, groupFor, normName } from "@/lib/muscle-groups";

const fmt = (n: number, max = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: max });
const short = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const PERIODS = [
  { d: 30, label: "30 дней" },
  { d: 90, label: "3 месяца" },
  { d: 365, label: "1 год" },
  { d: 0, label: "Всё время" },
];

// «Прогресс»: вкладка «Упражнения» — график по выбранному упражнению, вкладка «Обзор» — общая статистика
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ex?: string; d?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");
  const todayStr = await getToday();

  const [allSets, { data: mine }] = await Promise.all([
    loadUserSets(supabase, user.id),
    supabase.from("user_exercises").select("name, muscle").eq("owner_id", user.id),
  ]);
  const facts = allSets.filter((s) => s.name && s.weight > 0 && s.reps > 0);
  const tab = sp.tab === "overview" ? "overview" : "exercises";

  const tabs = (
    <div className="tabs" style={{ margin: "0 0 14px" }}>
      <Link href="/progress" className={`tab${tab === "exercises" ? " on" : ""}`}>Упражнения</Link>
      <Link href="/progress?tab=overview" className={`tab${tab === "overview" ? " on" : ""}`}>Обзор</Link>
    </div>
  );

  if (!facts.length) {
    return (
      <>
        <h1>Прогресс</h1>
        {tabs}
        <p className="muted">
          Графики появятся, когда запишешь веса в <Link href="/diary">Дневнике</Link>
        </p>
      </>
    );
  }

  // ───────────── Обзор ─────────────
  if (tab === "overview") {
    const workoutDates = new Map<string, string>();
    for (const s of facts) if (s.workoutId) workoutDates.set(s.workoutId, s.date);
    const volume = facts.reduce((t, s) => t + s.weight * s.reps, 0);

    const muscleByName = new Map<string, string>([
      ...CATALOG.map((c): [string, string] => [normName(c.name), c.muscle]),
      ...((mine ?? []) as { name: string; muscle: string | null }[])
        .filter((m) => m.muscle)
        .map((m): [string, string] => [normName(m.name), m.muscle as string]),
    ]);
    const byGroup = new Map<string, number>();
    for (const s of facts) {
      const g = groupFor(s.name, muscleByName);
      byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
    }
    const mRows = GROUPS.map((g) => ({ g, pct: Math.round(((byGroup.get(g) ?? 0) / facts.length) * 100) }))
      .filter((r) => r.pct > 0);
    const mMax = Math.max(...mRows.map((r) => r.pct), 1);

    const cut8w = shiftDay(todayStr, -56);
    const perDay = new Array(7).fill(0) as number[];
    for (const date of workoutDates.values()) {
      if (date < cut8w) continue;
      perDay[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]++;
    }
    const dMax = Math.max(...perDay, 1);

    const weekly = weeklyVolume(facts, todayStr, 12);
    const wMax = Math.max(...weekly.map((w) => w.volume), 1);
    const records = newRecords(facts, shiftDay(todayStr, -30));

    return (
      <>
        <h1>Прогресс</h1>
        {tabs}

        <div className="kpi-grid">
          <div className="card kpi">
            <div className="t">Тренировок</div>
            <div className="v">{fmt(workoutDates.size, 0)}</div>
            <span className="s">с записанными подходами</span>
          </div>
          <div className="card kpi">
            <div className="t">Общий объём</div>
            <div className="v">{fmt(volume, 0)} кг</div>
            <span className="s">вес × повторы по всем подходам</span>
          </div>
          <div className="card kpi">
            <div className="t">Подходов</div>
            <div className="v">{fmt(facts.length, 0)}</div>
            <span className="s">за всё время</span>
          </div>
        </div>

        <div className="card">
          <h3>Объём по неделям</h3>
          <div className="w-bars">
            {weekly.map((w) => (
              <div key={w.week} className="b" title={`Неделя с ${short(w.week)}: ${fmt(w.volume, 0)} кг, ${w.sets} подходов`}>
                <span className="bar" style={{ height: `${Math.max((w.volume / wMax) * 100, 3)}%` }} />
                <span className="lbl">{short(w.week)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Последние 12 недель, неделя начинается с понедельника</p>
        </div>

        <div className="card">
          <h3>Новые рекорды за 30 дней</h3>
          {records.length ? records.slice(0, 8).map((r) => (
            <Link key={r.name} href={`/progress?ex=${encodeURIComponent(r.name)}&m=e1rm`} className="w-row">
              <span><b>{r.name}</b><span className="muted">{short(r.date)} · раньше {fmt(r.previous, 0)} кг</span></span>
              <span className="up">1RM ≈ {fmt(r.e1rm, 0)} кг</span>
            </Link>
          )) : <p className="muted">Пока без новых рекордов — они появятся, когда расчётный 1RM превысит прежний максимум</p>}
        </div>

        {mRows.length > 0 && (
          <div className="card">
            <h3>Группы мышц</h3>
            {mRows.map((r) => (
              <div key={r.g} className="m-row">
                <span className="mn">{r.g}</span>
                <span className="m-track"><span className="m-fill" style={{ width: `${(r.pct / mMax) * 100}%` }} /></span>
                <span className="mp">{r.pct}%</span>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Доля подходов за всё время</p>
          </div>
        )}

        <div className="card">
          <h3>Тренировочная активность</h3>
          <div className="w-bars">
            {perDay.map((n, i) => (
              <div key={i} className="b" title={`${WD[i]}: ${n}`}>
                <span className="val">{n > 0 ? n : ""}</span>
                <span className={`bar${n === 0 ? " zero" : ""}${n > 0 && n === dMax ? " peak" : ""}`} style={{ height: `${Math.max((n / dMax) * 100, 4)}%` }} />
                <span className="lbl">{WD[i]}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Тренировки за последние 8 недель, по дням недели</p>
        </div>
      </>
    );
  }

  // ───────────── Упражнения ─────────────
  const best = bestByExercise(facts);
  const names = best.map((b) => b.name);
  const selected = names.find((n) => normName(n) === normName(sp.ex ?? "")) ?? names[0];
  const metric: Metric = sp.m === "e1rm" || sp.m === "volume" ? sp.m : "weight";
  const days = PERIODS.some((p) => p.d === Number(sp.d)) ? Number(sp.d) : 0;
  const cut = days > 0 ? shiftDay(todayStr, -days) : "";
  const pts = seriesByDate(facts, selected, metric).filter((p) => !cut || p.date >= cut);
  const values = pts.map((p) => Math.round(p.value * 10) / 10);

  const lastV = values.at(-1) ?? null;
  const prevV = values.at(-2) ?? null;
  const delta = lastV !== null && prevV !== null && lastV !== prevV ? lastV - prevV : null;
  const href = (o: { ex?: string; d?: number; m?: string }) =>
    "/progress?" + new URLSearchParams({ ex: o.ex ?? selected, d: String(o.d ?? days), m: o.m ?? metric }).toString();

  return (
    <>
      <h1>Прогресс</h1>
      {tabs}

      <div className="card">
        <form method="get" action="/progress" className="row" style={{ marginBottom: 10 }}>
          <input type="hidden" name="d" value={days} />
          <input type="hidden" name="m" value={metric} />
          <select name="ex" defaultValue={selected} aria-label="Упражнение" style={{ flex: 1, minWidth: 200 }}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="sm">Показать</button>
        </form>

        <div className="chart-head">
          <div>
            <h3>{selected}</h3>
            <span className="muted" style={{ fontSize: 13 }}>{METRICS[metric].label}, {METRICS[metric].unit}</span>
          </div>
          <div className="chart-box">
            <div className="v">{lastV !== null ? `${fmt(lastV)} кг` : "—"}</div>
            {delta !== null && (
              <div className={`s ${delta > 0 ? "up" : "down"}`}>
                {delta > 0 ? "↑" : "↓"} {fmt(Math.abs(delta))} кг к прошлой тренировке
              </div>
            )}
          </div>
        </div>

        <div className="tabs" style={{ margin: "4px 0 8px" }}>
          {(Object.keys(METRICS) as Metric[]).map((m) => (
            <Link key={m} href={href({ m })} className={`tab${metric === m ? " on" : ""}`}>{METRICS[m].label}</Link>
          ))}
        </div>
        <div className="tabs" style={{ margin: "0 0 14px" }}>
          {PERIODS.map((p) => (
            <Link key={p.d} href={href({ d: p.d })} className={`tab${days === p.d ? " on" : ""}`}>{p.label}</Link>
          ))}
        </div>

        {values.length ? (
          <Line values={values} labels={pts.length >= 2 ? [short(pts[0].date), short(pts[pts.length - 1].date)] : undefined}
            height={280} gradId="prog" />
        ) : <p className="muted">За выбранный период нет подходов по этому упражнению</p>}
      </div>

      <div className="card">
        <h3>Лучшие результаты</h3>
        <div className="rec-grid">
          {best.slice(0, 8).map((b) => (
            <Link key={b.name} href={href({ ex: b.name })} className="rec">
              <span className="n">{b.name}</span>
              <b>{fmt(b.weight)} кг × {b.weightReps}</b>
              <span className="muted" style={{ fontSize: 12 }}>1RM ≈ {fmt(b.e1rm, 0)} кг</span>
            </Link>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Сверху — упражнения, которые вы делали недавно. Рекорды разных упражнений не сравниваются.</p>
      </div>
    </>
  );
}
