import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { today as getToday } from "@/lib/today";
import { saveDailyLog, deleteDailyLog, addSupplement, deleteSupplement } from "@/lib/daily-actions";
import { loadPlan } from "@/lib/nutrition-target";
import { FoodDay, type MealEntryDTO } from "./food-day";
import { Line } from "@/components/chart";

const FIELDS: { key: string; label: string; step: string }[] = [
  { key: "sleep_h", label: "Сон, ч", step: "0.1" },
  { key: "steps", label: "Шаги", step: "1" },
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

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string; metric?: string; error?: string; ok?: string; tab?: string }>;
}) {
  const { user: targetParam, date: dateParam, metric: metricParam, error, ok, tab: tabParam } = await searchParams;
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

  const selDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? "") ? (dateParam as string) : await getToday();

  const [{ data: rows }, { data: mealRows }, { data: suppRows }, planData] = await Promise.all([
    supabase.from("daily_logs").select("*").eq("user_id", targetId).order("log_date", { ascending: false }),
    supabase
      .from("meal_entries")
      .select("id, meal, name, grams, kcal, protein_g, fat_g, carbs_g")
      .eq("user_id", targetId)
      .eq("log_date", selDate)
      .order("created_at"),
    supabase.from("supplements").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
    loadPlan(supabase, targetId),
  ]);

  const logs = (rows ?? []) as Record<string, unknown>[];
  const supplements = (suppRows ?? []) as Record<string, unknown>[];
  const entries = (mealRows ?? []) as unknown as MealEntryDTO[];
  const dayLog = logs.find((r) => r.log_date === selDate);
  const canEdit = isSelf;

  // Динамика за последние 30 записей: показатели, где есть хотя бы две точки
  const recent = logs.slice(0, 30).reverse();
  const seriesOf = (key: string) =>
    recent
      .map((r) => ({ day: String(r.log_date), v: r[key] === null || r[key] === undefined ? NaN : Number(r[key]) }))
      .filter((p) => Number.isFinite(p.v));
  const chartable = FIELDS.filter((f) => seriesOf(f.key).length >= 2);
  const metric = chartable.find((f) => f.key === metricParam) ?? chartable[0];
  const pts = metric ? seriesOf(metric.key) : [];
  const avg = pts.length ? pts.reduce((t, p) => t + p.v, 0) / pts.length : 0;
  const shortDay = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);
  const userQ = isSelf ? "" : `&user=${encodeURIComponent(targetId)}`;
  const metricHref = (k: string) => `/daily?tab=history&metric=${k}${userQ}`;
  // Разделы-вкладки; «Сон и шаги» редактирует только владелец
  const TABS = [
    { key: "food", label: "Питание" },
    ...(canEdit ? [{ key: "sleep", label: "Сон и шаги" }] : []),
    { key: "supplements", label: "Добавки и курсы" },
    { key: "history", label: "Динамика и история" },
  ];
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "food";
  const tabHref = (k: string) => `/daily?tab=${k}${userQ}${dateParam ? `&date=${selDate}` : ""}`;

  return (
    <>
      <h1>Питание и сон</h1>
      {!isSelf && <p className="muted">Дневник: <b>{target?.display_name ?? "подопечный"}</b> · режим просмотра</p>}
      {isCoachView && <p><Link href="/clients">← к подопечным</Link></p>}
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      <div className="workout-subtabs" role="tablist" aria-label="Разделы">
        {TABS.map((t) => (
          <Link key={t.key} href={tabHref(t.key)} scroll={false} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : undefined}>{t.label}</Link>
        ))}
      </div>

      {/* ======== Дневник питания (как в FatSecret) ======== */}
      {tab === "food" && (
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Питание</h3>
          <form method="get" className="row" style={{ gap: 8 }}>
            {!isSelf && <input type="hidden" name="user" value={targetId} />}
            <input type="date" name="date" defaultValue={selDate} style={{ width: 150 }} />
            <button className="sm">{new Date(`${selDate}T00:00:00Z`).toLocaleDateString("ru-RU", { weekday: "short", timeZone: "UTC" })} Показать</button>
          </form>
        </div>
        <FoodDay date={selDate} canEdit={canEdit} entries={entries} target={planData?.result ?? null} />
      </div>
      )}

      {/* ======== Сон, шаги и заметка ======== */}
      {tab === "sleep" && canEdit && (
        <div className="card">
          <h3>Сон, шаги и заметка за день</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Калории и БЖУ считаются автоматически из дневника питания. Повторное заполнение обновит запись.
          </p>
          <form action={saveDailyLog}>
            <div className="row">
              <label>Дата
                <input name="log_date" type="date" required defaultValue={selDate} />
              </label>
              <label>Сон, ч
                <input name="sleep_h" type="number" step="0.1" min={0} defaultValue={dayLog ? String(dayLog.sleep_h ?? "") : ""} style={{ width: 110 }} />
              </label>
              <label>Шаги
                <input name="steps" type="number" step="1" min={0} defaultValue={dayLog ? String(dayLog.steps ?? "") : ""} style={{ width: 130 }} />
              </label>
            </div>
            <label style={{ marginTop: 8 }}>Заметка (самочувствие, что-то важное…)
              <input
                name="note"
                defaultValue={dayLog && typeof dayLog.note === "string" ? dayLog.note : ""}
                style={{ width: "100%" }}
              />
            </label>
            <div style={{ marginTop: 10 }}>
              <button className="primary">{dayLog ? "Обновить день" : "Сохранить"}</button>
            </div>
          </form>
        </div>
      )}

      {tab === "supplements" && (
      <div className="card">
        <h3>Добавки, БАДы и курсы</h3>
        {canEdit && (
          <form action={addSupplement} className="stack">
            <div className="row">
              <label>Тип
                <select name="kind" defaultValue="supplement" style={{ width: "100%" }}>
                  <option value="supplement">Добавка</option>
                  <option value="bac">БАД</option>
                  <option value="course">Курс ААС</option>
                </select>
              </label>
              <label style={{ flex: 2 }}>Название
                <input name="name" required maxLength={100} placeholder="Например: витамин D3" style={{ width: "100%" }} />
              </label>
              <label style={{ flex: 2 }}>Дозировка
                <input name="dosage" maxLength={100} placeholder="Например: 5000 МЕ/день" style={{ width: "100%" }} />
              </label>
            </div>
            <div className="row">
              <label>Начало
                <input name="start_date" type="date" />
              </label>
              <label>Окончание
                <input name="end_date" type="date" />
              </label>
              <label style={{ flex: 1 }}>Заметка
                <input name="note" maxLength={300} placeholder="Необязательно" style={{ width: "100%" }} />
              </label>
              <button style={{ alignSelf: "flex-end" }}>Добавить</button>
            </div>
          </form>
        )}
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
                            <button className="sm danger">✕</button>
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
      </div>
      )}

      {tab === "history" && (
      <>
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
                    <td>{String(r.log_date)}</td>
                    {FIELDS.map((f) => <td key={f.key}>{fmt(r[f.key])}</td>)}
                    <td>{typeof r.note === "string" && r.note ? r.note : "—"}</td>
                    {canEdit && (
                      <td>
                        <Link href={`/daily?tab=sleep&date=${String(r.log_date)}`}>Изменить</Link>
                        {" "}
                        <form action={deleteDailyLog} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={String(r.id)} />
                          <button className="sm danger">✕</button>
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
          Кликните дату — откроется день: еда из дневника питания, сон, шаги и заметка.
        </p>
      </div>
      </>
      )}
    </>
  );
}
