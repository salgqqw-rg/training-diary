import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isLove } from "@/lib/love";
import { today as getToday } from "@/lib/today";
import { shiftDay } from "@/lib/dates";
import { Line } from "@/components/chart";
import { loadUserSets } from "@/lib/user-sets";
import { newRecords } from "@/lib/analytics";
import { loadStreak } from "@/lib/streak";
import { StreakBadge } from "@/components/streak-badge";
import { ChevronIcon, BoltIcon, CalendarIcon, AwardIcon } from "@/components/icons";

const fmt = (n: number, max = 1) =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: max });

// «31 октября» из «2026-10-31» (UTC, чтобы часовой пояс сервера не сдвигал день)
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type WoRow = { id: string; workout_date: string | null; note: string | null; cycle_id: string; week_number: number; cycles: unknown };
const WO_SELECT = "id, workout_date, note, cycle_id, week_number, cycles(name)";
const woHref = (w: { cycle_id: string; week_number: number; id: string }) => `/cycles/${w.cycle_id}?week=${w.week_number}&workout=${w.id}`;

export default async function HomePage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: cycles }, { data: measures }, allSets] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("cycles").select("id, name, weeks_count").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("measurements").select("weight, measured_on").eq("user_id", user.id).order("measured_on"),
    loadUserSets(supabase, user.id), // постранично: у Supabase лимит 1000 строк на запрос
  ]);

  const name = profile?.display_name ?? "чемпион";
  const cycle = cycles?.[0];
  const ids = (cycles ?? []).map((c) => c.id);

  const today = await getToday();
  const d30 = shiftDay(today, -30);
  const d60 = shiftDay(today, -60);
  const streak = await loadStreak(supabase, user.id, today, allSets);

  // Текущая неделя (пн–вс) для ленты на карточке «Сегодня»
  const weekStart = shiftDay(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  const headDate = new Date(`${today}T00:00:00Z`)
    .toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const [recentRes, nextRes, countRes, weekRes] = ids.length
    ? await Promise.all([
        supabase.from("workouts").select(WO_SELECT)
          .in("cycle_id", ids).order("workout_date", { ascending: false, nullsFirst: false }).limit(5),
        supabase.from("workouts").select(WO_SELECT)
          .in("cycle_id", ids).gte("workout_date", today).order("workout_date").limit(1),
        // проведённые: дата не позже сегодня (или не указана); будущие планы не считаем
        supabase.from("workouts").select("id", { count: "exact", head: true }).in("cycle_id", ids)
          .or(`workout_date.is.null,workout_date.lte.${today}`),
        supabase.from("workouts").select("workout_date").in("cycle_id", ids)
          .gte("workout_date", weekDays[0]).lte("workout_date", weekDays[6]),
      ])
    : ([null, null, null, null] as const);
  const recentRows = (recentRes?.data ?? []) as WoRow[];
  const nextRow = ((nextRes?.data ?? []) as WoRow[])[0] ?? null;
  const wCount = countRes?.count ?? null;
  const weekDates = new Set(((weekRes?.data ?? []) as { workout_date: string | null }[]).map((w) => w.workout_date));

  const planName = (r: { cycles: unknown }) =>
    (Array.isArray(r.cycles) ? r.cycles[0]?.name : (r.cycles as { name?: string } | null)?.name);

  // Упражнения ближайшей тренировки: порядок из базы, подходы и вес из плана
  const { data: nextEx } = nextRow
    ? await supabase.from("exercises").select("name").eq("workout_id", nextRow.id).order("created_at")
    : { data: null };
  const plan = ((nextEx ?? []) as { name: string }[]).map((e) => {
    const ss = allSets.filter((s) => s.workoutId === nextRow?.id && s.name === e.name).sort((a, b) => a.setNumber - b.setNumber);
    return { name: e.name, n: ss.length, reps: ss[0]?.reps ?? 0, kg: Math.max(0, ...ss.map((s) => s.weight)) };
  });
  const planSets = plan.reduce((t, p) => t + p.n, 0);

  // Вес: история, текущий, дельта
  const weights = (measures ?? []).map((m) => Number(m.weight)).filter((w) => w > 0);
  const wLast = weights.at(-1) ?? null;
  const wPrev = weights.at(-2) ?? null;
  const wFirst = weights[0] ?? null;
  const gainPct = wFirst && wLast && wFirst !== wLast
    ? ((wLast - wFirst) / wFirst) * 100 : null;

  // Только прошедшие подходы с весом: плановые веса будущих тренировок в объём не входят
  const facts = allSets.filter((s) => s.weight > 0 && s.reps > 0 && s.date <= today);
  const vol = (arr: typeof facts) => arr.reduce((t, s) => t + s.weight * s.reps, 0);
  const cur30 = facts.filter((s) => s.date >= d30);
  const prev30 = facts.filter((s) => s.date >= d60 && s.date < d30);
  const volPct = prev30.length && cur30.length ? ((vol(cur30) - vol(prev30)) / vol(prev30)) * 100 : null;
  const volByWorkout = new Map<string, number>();
  for (const s of facts) if (s.workoutId) volByWorkout.set(s.workoutId, (volByWorkout.get(s.workoutId) ?? 0) + s.weight * s.reps);
  const records = newRecords(facts, d30).slice(0, 3);

  // Куда ведёт главная кнопка: ближайшая тренировка → текущая программа → Программы
  const startHref = nextRow ? woHref(nextRow) : cycle ? `/cycles/${cycle.id}` : "/diary";
  const weekOfCycle = cycle && nextRow?.cycle_id === cycle.id ? nextRow.week_number : null;

  // Личные стикеры розовой темы: каждый день один из трёх (public/love/1-3.webp)
  const love = isLove(user.email);
  const sticker = `/love/${(Number(today.slice(8)) % 3) + 1}.webp`;

  return (
    <>
      <header className="home-head">
        <div>
          <div className="eyebrow">{headDate}</div>
          <h1>Привет, {name}</h1>
          {love
            ? <p className="love-msg">Я тебя очень сильно люблю, котенок! ♥♥♥</p>
            : <p className="muted">Продолжай — ты на правильном пути!</p>}
        </div>
        {love && (
          <div className="home-aside">
            <img className="love-sticker" src={sticker} alt="" />
          </div>
        )}
      </header>

      <div className="home-bar">
        <StreakBadge {...streak} />
        <Link href="/diary" className="btn-ghost"><CalendarIcon />Запланировать</Link>
      </div>

      <div className="dash-grid">
        <section className="card">
          {nextRow ? (
            <>
              <div className="h-top">
                <span className="h-chip">{nextRow.workout_date === today ? "Сегодня" : nextRow.workout_date ? dayLabel(nextRow.workout_date) : "Скоро"}</span>
                <span className="muted">{planName(nextRow) ?? "План"} · неделя {nextRow.week_number}</span>
              </div>
              <h2 className="h-title">{nextRow.note || "Тренировка"}</h2>
              {planSets > 0 && <p className="muted" style={{ margin: 0 }}>{planSets} подходов</p>}
              {plan.length > 0 && (
                <ul className="h-exl">
                  {plan.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      <span className="h-n">{i + 1}</span>
                      <b>{p.name}</b>
                      <span className="muted">{p.n > 0 && p.reps > 0 ? `${p.n} × ${p.reps}` : ""}</span>
                      <span className="h-kg">{p.kg > 0 ? `${fmt(p.kg)} кг` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="banner-actions">
                <Link href={startHref} className="primary banner-btn"><BoltIcon />Начать тренировку</Link>
                <Link href={`/cycles/${nextRow.cycle_id}`} className="btn-ghost">Открыть программу</Link>
              </div>
            </>
          ) : (
            <div className="empty-box">
              <b>Пока ничего не запланировано</b>
              <p>Запланируй дату тренировки в разделе «Тренировки» — и она появится здесь.</p>
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

        <div className="h-col">
          <section className="card">
            <div className="card-head"><h3>Твой прогресс</h3><Link className="sm-link" href="/progress">Подробнее →</Link></div>
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
                <p className="muted" style={{ margin: "0 0 14px" }}>Отметь вес в «Теле и целях» — график появится здесь</p>
                <Link href="/measurements" className="btn-ghost" style={{ color: "var(--acc)" }}>Отметить вес</Link>
              </>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Новые рекорды</h3>
              <Link className="sm-link" href="/progress?tab=overview">Все →</Link>
            </div>
            {records.length ? records.map((r) => (
              <div key={r.name} className="h-rec">
                <span className="ico"><AwardIcon /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <b>{r.name}</b>
                  <span className="muted">1RM · {dayLabel(r.date)} · было {fmt(r.previous, 0)} кг</span>
                </span>
                <span className="h-kg">{fmt(r.e1rm, 0)} кг</span>
              </div>
            )) : (
              <p className="muted">Рекорд появится, когда расчётный 1RM в упражнении превысит прежний результат</p>
            )}
          </section>
        </div>
      </div>

      <section className="card h-kpis" aria-label="Показатели">
        <Link className="h-kpi" href={cycle ? `/cycles/${cycle.id}` : "/diary"}>
          <span className="t">Программа</span>
          <span className="v txt">{cycle?.name ?? "Нет программы"}</span>
          <span className="s">{cycle ? (weekOfCycle ? `неделя ${weekOfCycle} из ${fmt(cycle.weeks_count, 0)}` : `${fmt(cycle.weeks_count, 0)} нед.`) : "Создай план в «Программах»"}</span>
        </Link>
        <Link className="h-kpi" href="/measurements">
          <span className="t">Вес с начала</span>
          <span className={gainPct === null ? "v empty" : "v"}>{gainPct === null ? "—" : `${gainPct > 0 ? "+" : ""}${gainPct.toFixed(1)}%`}</span>
          <span className="s">от первого замера</span>
        </Link>
        <Link className="h-kpi" href="/diary">
          <span className="t">Проведено тренировок</span>
          <span className="v acc">{fmt(wCount ?? 0, 0)}</span>
          <span className="s">без будущих планов</span>
        </Link>
        <Link className="h-kpi" href="/measurements">
          <span className="t">Текущий вес</span>
          <span className={wLast ? "v" : "v empty"}>{wLast ? `${fmt(wLast)} кг` : "—"}</span>
          {wLast && wPrev && wLast !== wPrev
            ? <span className={wLast > wPrev ? "s up" : "s down"}>{wLast > wPrev ? "↑" : "↓"} {fmt(Math.abs(wLast - wPrev))} кг к прошлому замеру</span>
            : <span className="s">{wLast ? "без изменений" : "добавь первый замер"}</span>}
        </Link>
      </section>

      <section className="card h-wide">
        <div className="card-head">
          <h3>Последние тренировки</h3>
          <Link className="sm-link" href="/diary">Все →</Link>
        </div>
        {recentRows.length ? recentRows.map((r) => {
          const v = volByWorkout.get(r.id);
          return (
            <Link key={r.id} href={woHref(r)} className="w-row">
              <span className="ico"><BoltIcon /></span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <b>{planName(r) ?? "План"}</b>
                <span className="muted">
                  {r.note ?? "Тренировка"} · {r.workout_date ? dayLabel(r.workout_date) : "дата не задана"}{v ? ` · ${fmt(v, 0)} кг` : ""}
                </span>
              </span>
              <span className="chev"><ChevronIcon /></span>
            </Link>
          );
        }) : (
          <p className="muted">Пока нет ни одной тренировки</p>
        )}
      </section>
    </>
  );
}
