import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { today as getToday } from "@/lib/today";
import { shiftDay } from "@/lib/dates";
import { activeOn, avgOf, recentFoods, weekOf } from "@/lib/daily-math";
import { saveDailyLog, deleteDailyLog, deleteSupplement, addWater, toggleSupplementCheck } from "@/lib/daily-actions";
import { loadPlan } from "@/lib/nutrition-target";
import { SupplementForm } from "./supplement-form";
import { FoodDay, type MealEntryDTO, type RecentDTO } from "./food-day";
import { Line } from "@/components/chart";
import { Bars } from "@/components/bars";

const FIELDS: { key: string; label: string; step: string }[] = [
  { key: "sleep_h", label: "Сон, ч", step: "0.1" },
  { key: "steps", label: "Шаги", step: "1" },
  { key: "water_ml", label: "Вода, мл", step: "50" },
  { key: "kcal", label: "Ккал", step: "1" },
  { key: "protein_g", label: "Белки, г", step: "0.1" },
  { key: "fat_g", label: "Жиры, г", step: "0.1" },
  { key: "carbs_g", label: "Углеводы, г", step: "0.1" },
];

const KINDS: Record<string, string> = {
  supplement: "Добавка",
  bac: "БАД",
  course: "Курс ААС",
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WATER_GOAL = 2000; // shortcut: норма воды одна для всех, личная настройка — когда попросят

// Подпись над полем: поля в строке выстраиваются по нижнему краю, без «подписи слева от поля»
const COL = { display: "flex", flexDirection: "column", gap: 5, margin: 0 } as const;

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
const ru = (n: number, d = 0) => n.toLocaleString("ru-RU", { maximumFractionDigits: d });

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string; metric?: string; error?: string; ok?: string; tab?: string; range?: string }>;
}) {
  const { user: targetParam, date: dateParam, metric: metricParam, error, ok, tab: tabParam, range: rangeParam } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // Свои записи или записи подопечного (?user=)
  const targetId = targetParam ?? user.id;
  const isSelf = targetId === user.id;
  let isCoachView = false;
  if (!isSelf) {
    const { data: link } = await supabase
      .from("coach_links")
      .select("id")
      .eq("coach_id", user.id)
      .eq("trainee_id", targetId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) redirect("/clients?error=" + encodeURIComponent("Дневник доступен только для ваших подопечных"));
    isCoachView = true;
  }

  const target = isSelf
    ? { display_name: null }
    : (await supabase.from("profiles").select("display_name").eq("id", targetId).maybeSingle()).data;

  const todayStr = await getToday();
  const selDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? "") ? (dateParam as string) : todayStr;
  const prevDay = shiftDay(selDate, -1);
  const canEdit = isSelf;

  const [{ data: rows }, { data: mealRows }, { data: suppRows }, planData, { data: recentRows }, { data: prevRows }, { data: checkRows }] = await Promise.all([
    supabase.from("daily_logs").select("*").eq("user_id", targetId).order("log_date", { ascending: false }),
    supabase
      .from("meal_entries")
      .select("id, meal, name, grams, kcal, protein_g, fat_g, carbs_g")
      .eq("user_id", targetId)
      .eq("log_date", selDate)
      .order("created_at"),
    supabase.from("supplements").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
    loadPlan(supabase, targetId),
    // Недавние продукты и вчерашний день нужны только владельцу: тренер ничего не добавляет
    canEdit
      ? supabase.from("meal_entries").select("id, name, grams, kcal").eq("user_id", targetId).order("created_at", { ascending: false }).limit(150)
      : Promise.resolve({ data: null }),
    canEdit
      ? supabase.from("meal_entries").select("meal").eq("user_id", targetId).eq("log_date", prevDay)
      : Promise.resolve({ data: null }),
    supabase.from("supplement_checks").select("supplement_id").eq("user_id", targetId).eq("log_date", selDate),
  ]);

  const logs = (rows ?? []) as Record<string, unknown>[];
  const supplements = (suppRows ?? []) as Record<string, unknown>[];
  const entries = (mealRows ?? []) as unknown as MealEntryDTO[];
  const dayLog = logs.find((r) => r.log_date === selDate);
  const kcalTarget = planData?.result?.kcal ?? null;
  const recent: RecentDTO[] = recentFoods(((recentRows ?? []) as { id: string; name: string; grams: number; kcal: number }[]))
    .map((r) => ({ id: String(r.id), name: String(r.name), grams: Number(r.grams), kcal: Number(r.kcal) }));
  const prevCounts: Record<string, number> = {};
  for (const r of (prevRows ?? []) as { meal: string }[]) prevCounts[r.meal] = (prevCounts[r.meal] ?? 0) + 1;
  const checked = new Set(((checkRows ?? []) as { supplement_id: string }[]).map((c) => String(c.supplement_id)));
  const activeSupps = supplements.filter((s) => activeOn(s as { start_date?: string | null; end_date?: string | null }, selDate));

  const userQ = isSelf ? "" : `&user=${encodeURIComponent(targetId)}`;
  const dayHref = (d: string) => `/daily?date=${d}${userQ}`;
  // Разделы-вкладки. Сон, шаги, вода и добавки за день теперь на вкладке «День»
  const TABS = [
    { key: "day", label: "День" },
    { key: "history", label: "Динамика" },
    { key: "supplements", label: "Добавки" },
  ];
  // Старые адреса (?tab=food, ?tab=sleep) открывают «День»
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "day";
  const tabHref = (k: string) => `/daily?tab=${k}${userQ}${dateParam ? `&date=${selDate}` : ""}`;

  // ---- Вкладка «День»: полоса недели
  const hasData = new Set(
    logs.filter((r) => Number(r.kcal) > 0 || Number(r.water_ml) > 0 || Number(r.sleep_h) > 0 || Number(r.steps) > 0).map((r) => String(r.log_date)),
  );
  const week = weekOf(selDate);
  const longDate = new Date(`${selDate}T00:00:00Z`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dayLabel = selDate === todayStr ? "Сегодня" : selDate === shiftDay(todayStr, -1) ? "Вчера" : selDate === shiftDay(todayStr, 1) ? "Завтра" : null;
  const water = Number(dayLog?.water_ml ?? 0);

  // ---- Вкладка «Динамика»: окно из 7 или 30 дней, заканчивающееся сегодня
  const range = rangeParam === "30" ? 30 : 7;
  const days = Array.from({ length: range }, (_, i) => shiftDay(todayStr, i - (range - 1)));
  const byDate = new Map(logs.map((r) => [String(r.log_date), r]));
  const inRange = days.map((d) => byDate.get(d));
  const kcalVals = inRange.map((r) => (Number(r?.kcal) > 0 ? Number(r?.kcal) : null));
  const dayLbl = (d: string) => (range === 7 ? WEEKDAYS[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7] : String(Number(d.slice(8))));
  const tiles = [
    { label: "Ккал", ...avgOf(inRange.map((r) => r?.kcal)), unit: "", note: kcalTarget ? `норма ${kcalTarget}` : "" },
    { label: "Белки", ...avgOf(inRange.map((r) => r?.protein_g)), unit: " г", note: planData?.result ? `норма ${planData.result.protein_g} г` : "" },
    { label: "Сон", ...avgOf(inRange.map((r) => r?.sleep_h)), unit: " ч", note: "" },
    { label: "Шаги", ...avgOf(inRange.map((r) => r?.steps)), unit: "", note: "" },
    { label: "Вода", ...avgOf(inRange.map((r) => r?.water_ml)), unit: " мл", note: `норма ${WATER_GOAL}` },
  ];
  const rangeHref = (n: number) => `/daily?tab=history&range=${n}${userQ}`;

  // Динамика одного показателя за последние 30 записей: показатели, где есть хотя бы две точки
  const recentLogs = logs.slice(0, 30).reverse();
  const seriesOf = (key: string) =>
    recentLogs
      .map((r) => ({ day: String(r.log_date), v: r[key] === null || r[key] === undefined ? NaN : Number(r[key]) }))
      .filter((p) => Number.isFinite(p.v));
  const chartable = FIELDS.filter((f) => seriesOf(f.key).length >= 2);
  const metric = chartable.find((f) => f.key === metricParam) ?? chartable[0];
  const pts = metric ? seriesOf(metric.key) : [];
  const avg = pts.length ? pts.reduce((t, p) => t + p.v, 0) / pts.length : 0;
  const shortDay = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);
  const metricHref = (k: string) => `/daily?tab=history&range=${range}&metric=${k}${userQ}`;

  return (
    <>
      <h1>Питание и сон</h1>
      {!isSelf && <p className="muted">Дневник: <b>{target?.display_name ?? "подопечный"}</b> · режим просмотра</p>}
      {isCoachView && <p><Link href="/clients">← к подопечным</Link></p>}
      {error && <p className="danger" role="alert">{error}</p>}
      {ok && <p className="up" role="status">{ok}</p>}

      <div className="workout-subtabs" role="tablist" aria-label="Разделы">
        {TABS.map((t) => (
          <Link key={t.key} href={tabHref(t.key)} scroll={false} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : undefined}>{t.label}</Link>
        ))}
      </div>

      {/* ======== День: еда, вода, сон и шаги, добавки ======== */}
      {tab === "day" && (
        <>
          <div className="dt-bar">
            <Link href={dayHref(prevDay)} className="dt-arr" aria-label="Предыдущий день">‹</Link>
            <div className="dt-mid">
              <b>{dayLabel ?? longDate.split(",")[0]}</b>
              <small className="muted">{dayLabel ? longDate : longDate.split(",").slice(1).join(",").trim()}</small>
            </div>
            {selDate < todayStr
              ? <Link href={dayHref(shiftDay(selDate, 1))} className="dt-arr" aria-label="Следующий день">›</Link>
              : <span className="dt-arr off" aria-hidden="true">›</span>}
          </div>
          <div className="dt-week">
            {week.map((d, i) => {
              const cls = `dt-day${d === selDate ? " on" : ""}${d === todayStr ? " today" : ""}`;
              const inner = (
                <>
                  <small>{WEEKDAYS[i]}</small>
                  <b>{Number(d.slice(8))}</b>
                  <i className={hasData.has(d) ? "has" : undefined} />
                </>
              );
              return d > todayStr
                ? <span key={d} className={`${cls} off`}>{inner}</span>
                : <Link key={d} href={dayHref(d)} className={cls} aria-current={d === selDate ? "date" : undefined} aria-label={`${Number(d.slice(8))} число${hasData.has(d) ? ", есть записи" : ""}`}>{inner}</Link>;
            })}
          </div>
          {selDate !== todayStr && <p style={{ margin: "0 0 12px" }}><Link href={dayHref(todayStr)} className="sm-link">К сегодняшнему дню →</Link></p>}

          <FoodDay date={selDate} canEdit={canEdit} entries={entries} target={planData?.result ?? null} recent={recent} prev={{ date: prevDay, counts: prevCounts }} />

          {/* Вода */}
          <section className="card">
            <div className="row between">
              <h3 style={{ margin: 0 }}>Вода</h3>
              <span className="muted"><b style={{ color: "var(--text)" }}>{ru(water)}</b> из {ru(WATER_GOAL)} мл</span>
            </div>
            <i className="fd-bar" style={{ margin: "10px 0 12px" }}><u style={{ width: `${Math.min(100, (water / WATER_GOAL) * 100)}%` }} /></i>
            {canEdit && (
              <form action={addWater} className="wt-btns">
                <input type="hidden" name="log_date" value={selDate} />
                <button name="delta" value="-250" aria-label="Убавить 250 мл">−250</button>
                <button name="delta" value="250" className="primary">+250 мл</button>
                <button name="delta" value="500" className="primary">+500 мл</button>
              </form>
            )}
          </section>

          {/* Сон, шаги, заметка */}
          <section className="card">
            <h3>Сон, шаги и заметка</h3>
            {canEdit ? (
              <form action={saveDailyLog}>
                <input type="hidden" name="log_date" value={selDate} />
                <div className="row" style={{ alignItems: "flex-end" }}>
                  <label style={COL}>Сон, ч
                    <input name="sleep_h" type="number" inputMode="decimal" step="0.1" min={0} max={24} defaultValue={dayLog ? String(dayLog.sleep_h ?? "") : ""} style={{ width: 110, margin: 0 }} />
                  </label>
                  <label style={COL}>Шаги
                    <input name="steps" type="number" inputMode="numeric" step="1" min={0} defaultValue={dayLog ? String(dayLog.steps ?? "") : ""} style={{ width: 130, margin: 0 }} />
                  </label>
                </div>
                <label style={{ marginTop: 8 }}>Заметка (самочувствие, что-то важное…)
                  <input name="note" defaultValue={dayLog && typeof dayLog.note === "string" ? dayLog.note : ""} style={{ width: "100%" }} />
                </label>
                <div style={{ marginTop: 10 }}>
                  <button className="primary">{dayLog && (dayLog.sleep_h != null || dayLog.steps != null || dayLog.note) ? "Обновить" : "Сохранить"}</button>
                </div>
              </form>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Сон: <b>{fmt(dayLog?.sleep_h)}</b> ч · Шаги: <b>{fmt(dayLog?.steps)}</b>
                {typeof dayLog?.note === "string" && dayLog.note ? <> · {dayLog.note}</> : null}
              </p>
            )}
          </section>

          {/* Добавки на этот день */}
          {activeSupps.length > 0 && (
            <section className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>{selDate === todayStr ? "Добавки на сегодня" : "Добавки за день"}</h3>
                <span className="muted">{activeSupps.filter((s) => checked.has(String(s.id))).length} из {activeSupps.length}</span>
              </div>
              <div className="sp-list">
                {activeSupps.map((s) => {
                  const on = checked.has(String(s.id));
                  const body = (
                    <>
                      <span className={on ? "sp-box on" : "sp-box"} aria-hidden="true">{on ? "✓" : ""}</span>
                      <span className="sp-t"><b>{String(s.name)}</b>{s.dosage ? <small className="muted">{String(s.dosage)}</small> : null}</span>
                    </>
                  );
                  return canEdit ? (
                    <form key={String(s.id)} action={toggleSupplementCheck}>
                      <input type="hidden" name="supplement_id" value={String(s.id)} />
                      <input type="hidden" name="log_date" value={selDate} />
                      <input type="hidden" name="checked" value={on ? "1" : "0"} />
                      <button className="sp-row" role="checkbox" aria-checked={on}>{body}</button>
                    </form>
                  ) : <div key={String(s.id)} className="sp-row static">{body}</div>;
                })}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "supplements" && (
      <div className="card">
        <h3>Добавки, БАДы и курсы</h3>
        {canEdit && <SupplementForm key={supplements.length} />}
        {supplements.length === 0 && <p className="muted">Пока ничего не добавлено</p>}
        {supplements.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Тип</th><th>Название</th><th>Дозировка</th><th>Период</th><th>Заметка</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {supplements.map((s) => {
                  const period = s.start_date || s.end_date
                    ? `${s.start_date ? String(s.start_date) : "…"} → ${s.end_date ? String(s.end_date) : "тек."}`
                    : "—";
                  return (
                    <tr key={String(s.id)}>
                      <td>{KINDS[String(s.kind)] ?? String(s.kind)}</td>
                      <td><b>{String(s.name)}</b></td>
                      <td>{s.dosage ? String(s.dosage) : "—"}</td>
                      <td>{period}</td>
                      <td>{s.note ? String(s.note) : "—"}</td>
                      {canEdit && (
                        <td>
                          <form action={deleteSupplement}>
                            <input type="hidden" name="id" value={String(s.id)} />
                            <button className="sm danger" aria-label={`Удалить: ${String(s.name)}`}>✕</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Отмечать, что принял, можно на вкладке «День»: добавка показывается там в дни своего периода.
        </p>
      </div>
      )}

      {/* ======== Динамика и история ======== */}
      {tab === "history" && (
      <>
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Калории по дням</h3>
          <div className="seg dy-range">
            {[7, 30].map((n) => (
              <Link key={n} href={rangeHref(n)} className={`dy-r${range === n ? " on" : ""}`} aria-current={range === n ? "true" : undefined}>{n} дн.</Link>
            ))}
          </div>
        </div>
        {kcalVals.some((v) => v !== null)
          ? <Bars values={kcalVals} labels={days.map(dayLbl)} target={kcalTarget ?? undefined} />
          : <p className="muted">За эти дни калорий нет: внесите еду на вкладке «День».</p>}
        <div className="dy-tiles">
          {tiles.map((t) => (
            <div key={t.label} className="dy-tile">
              <span className="lbl">{t.label}</span>
              <b>{t.n ? ru(t.avg, t.label === "Сон" ? 1 : 0) + t.unit : "—"}</b>
              <small className="muted">{t.n ? `в среднем · ${t.n} дн.` : "нет данных"}{t.note ? ` · ${t.note}` : ""}</small>
            </div>
          ))}
        </div>
      </div>

      {metric && (
        <div className="card">
          <h3>Динамика за последние {pts.length} зап.</h3>
          <div className="tabs" style={{ margin: "4px 0 12px", flexWrap: "wrap" }}>
            {chartable.map((f) => (
              <Link key={f.key} href={metricHref(f.key)} className={`tab${f.key === metric.key ? " on" : ""}`}>{f.label}</Link>
            ))}
          </div>
          <div className="chart-head">
            <div className="v">{avg.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}</div>
            <span className="muted" style={{ fontSize: 13 }}>в среднем · {metric.label}</span>
          </div>
          <Line values={pts.map((p) => p.v)} labels={[shortDay(pts[0].day), shortDay(pts.at(-1)!.day)]} height={200} gradId="daily" />
        </div>
      )}

      <div className="card">
        <h3>История по дням</h3>
        {logs.length === 0 && <p className="muted">Записей пока нет</p>}
        {logs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  {FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
                  <th>Заметка</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {logs.map((r) => (
                  <tr key={String(r.id)}>
                    <td><Link href={dayHref(String(r.log_date))}>{String(r.log_date)}</Link></td>
                    {FIELDS.map((f) => <td key={f.key}>{fmt(r[f.key])}</td>)}
                    <td>{typeof r.note === "string" && r.note ? r.note : "—"}</td>
                    {canEdit && (
                      <td>
                        <form action={deleteDailyLog} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={String(r.id)} />
                          <button className="sm danger" aria-label={`Удалить запись за ${String(r.log_date)}`}>✕</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Нажмите дату: откроется день с едой, водой, сном, шагами и заметкой.
        </p>
      </div>
      </>
      )}
    </>
  );
}
