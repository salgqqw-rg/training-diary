import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isLove } from "@/lib/love";
import { today as getToday } from "@/lib/today";
import { shiftDay } from "@/lib/dates";
import { Line } from "@/components/chart";
import { fetchAll } from "@/lib/fetch-all";
import { ChevronIcon, BoltIcon, CalendarIcon } from "@/components/icons";

const fmt = (n: number, max = 1) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: max });

// «31 октября» из «2026-10-31» (UTC, чтобы часовой пояс сервера не сдвигал день)
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default async function HomePage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: cycles }, { data: measures }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("cycles").select("id, name, weeks_count").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("measurements").select("weight, measured_on").eq("user_id", user.id).order("measured_on"),
  ]);

  const name = profile?.display_name ?? "чемпион";
  const cycle = cycles?.[0];
  const ids = (cycles ?? []).map((c) => c.id);

  const today = await getToday();
  const d30 = shiftDay(today, -30);
  const d60 = shiftDay(today, -60);

  // Текущая неделя (пн–вс) для ленты на карточке «Ближайшая тренировка»
  const weekStart = shiftDay(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  const headDate = new Date(`${today}T00:00:00Z`)
    .toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  type SetRow = { weight: number; reps: number; created_at: string };
  const [recentRes, nextRes, sets, countRes, weekRes] = ids.length
    ? await Promise.all([
        supabase.from("workouts").select("id, workout_date, note, cycle_id, cycles(name)")
          .in("cycle_id", ids).order("workout_date", { ascending: false, nullsFirst: false }).limit(5),
        supabase.from("workouts").select("id, workout_date, note, cycle_id, cycles(name)")
          .in("cycle_id", ids).gte("workout_date", today).order("workout_date").limit(1),
        // постранично: у Supabase лимит 1000 строк на запрос
        fetchAll<SetRow>((from, to) =>
          supabase.from("workout_sets").select("weight, reps, created_at").in("cycle_id", ids)
            .gte("created_at", d60).order("id").range(from, to)),
        // проведённые: дата не позже сегодня (или не указана); будущие планы не считаем
        supabase.from("workouts").select("id", { count: "exact", head: true }).in("cycle_id", ids)
          .or(`workout_date.is.null,workout_date.lte.${today}`),
        supabase.from("workouts").select("workout_date").in("cycle_id", ids)
          .gte("workout_date", weekDays[0]).lte("workout_date", weekDays[6]),
      ])
    : ([null, null, [] as SetRow[], null, null] as const);
  const recent = recentRes?.data ?? null;
  const next = nextRes?.data ?? null;
  const wCount = countRes?.count ?? null;
  const weekDates = new Set(((weekRes?.data ?? []) as { workout_date: string | null }[]).map((w) => w.workout_date));

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

  // Куда ведёт главная кнопка: ближайшая тренировка → текущая программа → Дневник
  const startHref = nextRow ? `/cycles/${nextRow.cycle_id}` : cycle ? `/cycles/${cycle.id}` : "/diary";

  return (
    <>
      <header className="home-head">
        <div>
          <div className="eyebrow">{headDate}</div>
          <h1>Привет, {name}</h1>
          {isLove(user.email)
            ? <p className="love-msg">Я тебя очень сильно люблю, котенок! ♥♥♥</p>
            : <p className="muted">Продолжай — ты на правильном пути!</p>}
        </div>
        <Link href={startHref} className="banner-btn head-cta"><BoltIcon />Начать тренировку</Link>
      </header>

      <div className="dash-grid">
        <aside className="banner">
          <svg className="banner-art" viewBox="0 0 340 240" fill="none" strokeOpacity=".38" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="170" cy="120" r="108" strokeOpacity=".12" />
            <circle cx="170" cy="120" r="74" strokeOpacity=".16" />
            <path d="M14 120h312" />
            <rect x="66" y="44" width="24" height="152" rx="7" />
            <rect x="100" y="68" width="18" height="104" rx="5" />
            <rect x="250" y="44" width="24" height="152" rx="7" />
            <rect x="222" y="68" width="18" height="104" rx="5" />
          </svg>
          <h2>Сила<br />в деталях</h2>
          <p>Планируй. Выполняй. Расти.</p>
          <div className="banner-actions">
            <Link href="/diary" className="banner-btn">Перейти к тренировкам</Link>
            {cycle && <Link href={`/cycles/${cycle.id}`} className="btn-ghost">Моя программа</Link>}
          </div>
        </aside>

        <section className="card">
          <div className="card-head">
            <h3>Ближайшая тренировка</h3>
            <CalendarIcon style={{ color: "var(--muted)" }} />
          </div>
          {nextRow ? (
            <>
              <b>{planName(nextRow) ?? "План"}</b>
              <p className="muted" style={{ margin: "6px 0 12px" }}>
                {nextRow.workout_date ? dayLabel(nextRow.workout_date) : ""}{nextRow.note ? ` · ${nextRow.note}` : ""}
              </p>
              <Link href={`/cycles/${nextRow.cycle_id}`} className="primary banner-btn" style={{ margin: 0 }}>
                Начать тренировку
              </Link>
            </>
          ) : (
            <div className="empty-box">
              <b>Пока ничего не запланировано</b>
              <p>Запланируй дату тренировки в Дневнике — и она появится здесь.</p>
              <Link href="/diary" className="btn-ghost">Запланировать</Link>
            </div>
          )}
          <div className="week">
            <div className="eyebrow">Эта неделя</div>
            <div className="week-days">
              {weekDays.map((d, i) => {
                const has = weekDates.has(d);
                const cls = ["wd", d === today ? "today" : "", has && d <= today ? "done" : "", has && d > today ? "plan" : ""]
                  .filter(Boolean).join(" ");
                return (
                  <div key={d} className={cls}>
                    {WEEKDAYS[i]}
                    <i>{Number(d.slice(8))}</i>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="kpi-grid">
        <div className="card kpi">
          <div className="t">Текущая программа</div>
          <div className="v txt">{cycle?.name ?? "Нет программы"}</div>
          <span className="s">{cycle ? `${fmt(cycle.weeks_count, 0)} нед.` : "Создай план в Дневнике"}</span>
          {cycle && <Link className="sm-link" style={{ marginTop: 8, display: "inline-block" }} href={`/cycles/${cycle.id}`}>Подробнее →</Link>}
        </div>
        <div className="card kpi">
          <div className="t">Вес с начала</div>
          <div className={gainPct === null ? "v empty" : "v"}>{gainPct === null ? "—" : `${gainPct > 0 ? "+" : ""}${gainPct.toFixed(1)}%`}</div>
          <span className="s">от первого замера</span>
        </div>
        <div className="card kpi">
          <div className="t">Проведено тренировок</div>
          <div className="v acc">{fmt(wCount ?? 0, 0)}</div>
          <span className="s">без будущих планов</span>
        </div>
        <div className="card kpi">
          <div className="t">Текущий вес</div>
          <div className={wLast ? "v" : "v empty"}>{wLast ? `${fmt(wLast)} кг` : "—"}</div>
          {wLast && wPrev && wLast !== wPrev && (
            <span className={wLast > wPrev ? "s up" : "s down"}>
              {wLast > wPrev ? "↑" : "↓"} {fmt(Math.abs(wLast - wPrev))} кг к прошлому замеру
            </span>
          )}
          {!wLast && <Link className="sm-link" href="/measurements">Добавить замер →</Link>}
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h3>Последние тренировки</h3>
            <Link className="sm-link" href="/diary">Все →</Link>
          </div>
          {recentRows.length ? recentRows.map((r) => (
            <Link key={r.id} href={`/cycles/${r.cycle_id}`} className="w-row">
              <span className="ico"><BoltIcon /></span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <b>{planName(r) ?? "План"}</b>
                <span className="muted">{r.note ?? "Тренировка"} · {r.workout_date ? dayLabel(r.workout_date) : "дата не задана"}</span>
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
            <>
              <svg className="ghost-chart" viewBox="0 0 320 110" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path className="g1" d="M0 22h320M0 55h320M0 88h320" strokeDasharray="4 6" />
                <path className="g2" d="M0 78C40 70 70 84 110 60S190 52 230 38 290 30 320 20" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />
              </svg>
              <p className="muted" style={{ margin: "0 0 14px" }}>Отметь вес в Характеристиках — график появится здесь</p>
              <Link href="/measurements" className="btn-ghost" style={{ color: "var(--acc)" }}>Отметить вес</Link>
            </>
          )}
        </section>
      </div>
    </>
  );
}
