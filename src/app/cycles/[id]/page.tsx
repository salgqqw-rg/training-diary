import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { today as getToday } from "@/lib/today";
import { buildStats, type SetRow } from "@/lib/stats";
import { CATALOG, norm } from "@/lib/exercise-catalog";
import {
  addWorkout, setWorkoutTimes, deleteWorkout, addExercise, deleteExercise, duplicateWorkout,
} from "@/lib/actions";
import Link from "next/link";
import { ExerciseNote } from "./exercise-note";
import { SetsTable } from "./sets-table";
import { RestTimer } from "@/components/rest-timer";
import { fetchAll } from "@/lib/fetch-all";
import { pickPrevious, type Previous } from "@/lib/previous";
import { ConfirmButton } from "@/components/confirm-button";

// минуты между «ЧЧ:ММ»; если конец раньше начала — тренировка перешла через полночь
const minutesBetween = (a: string, b: string) => {
  const m = (t: string) => { const [h, mi] = t.split(":").map(Number); return h * 60 + mi; };
  const d = m(b) - m(a);
  return d >= 0 ? d : d + 1440;
};
const fmtMin = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} ч ${n % 60} мин` : `${n} мин`);

// «2026-10-29» → «29 окт., чт» (в UTC, чтобы дата не «плыла» из-за часового пояса)
const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" });
};

export default async function CyclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string; workout?: string; tab?: string; view?: string }> }) {
  const { id } = await params;
  const { week: weekParam, workout: workoutParam, tab: tabParam, view: viewParam } = await searchParams;
  const statsView = viewParam === "stats";
  const infoTab = tabParam === "info";
  const supabase = await createClient();
  const user = await getUser();
  const todayStr = await getToday();

  // RLS отдаёт цикл владельцу, его тренеру (в режиме просмотра) или если цикл публичный.
  // Ссылка на profiles названа явно — в cycles теперь дваForeignKey на profiles (user_id и created_by)
  const { data: cycle } = await supabase
    .from("cycles")
    .select("*, owner:profiles!cycles_user_id_fkey(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!cycle) notFound();
  const isOwner = user?.id === cycle.user_id;
  const isAuthor = !!user && cycle.created_by === user.id;
  // Редактировать может владелец, тренер-автор плана или тренер подопечного (права проверит RLS)
  const canEdit = isOwner || isAuthor;

  // Имя тренера, составившего план (если он не мы)
  const ownerName = cycle.owner?.display_name ?? null;

  const [{ data: author }, { data: mine }, { data: workouts }, { data: exercises }, sets] = await Promise.all([
    cycle.created_by && cycle.created_by !== user?.id
      ? supabase.from("profiles").select("display_name").eq("id", cycle.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("user_exercises").select("id, name, base_key").eq("owner_id", user.id).is("base_key", null)
      : Promise.resolve({ data: null }),
    supabase.from("workouts").select("*").eq("cycle_id", id).order("created_at"),
    supabase.from("exercises").select("*").eq("cycle_id", id).order("created_at"),
    // постранично: в длинном цикле больше 1000 подходов, а Supabase отдаёт не больше тысячи за запрос
    fetchAll<any>((from, to) =>
      supabase.from("workout_sets").select("*").eq("cycle_id", id).order("set_number").order("id").range(from, to)),
  ]);

  const weekByWorkout = new Map<string, number>((workouts ?? []).map((w): [string, number] => [w.id, w.week_number]));
  const exById = new Map<string, { name: string; workout_id: string }>(
    (exercises ?? []).map((e): [string, { name: string; workout_id: string }] => [e.id, e])
  );
  const rows: SetRow[] = (sets ?? []).map((s) => {
    const ex = exById.get(s.exercise_id);
    return {
      exercise: ex?.name ?? "",
      week: (ex && weekByWorkout.get(ex.workout_id)) ?? 0,
      weight: Number(s.weight),
      reps: s.reps,
      rir: s.rir,
    };
  });
  const stats = buildStats(rows);
  // Подсказки при вводе: каталог + свои упражнения + уже использованные в цикле
  const authorName: string | null = (author as { display_name?: string } | null)?.display_name ?? null;
  const libKey = new Map<string, string>([
    ...CATALOG.map((c): [string, string] => [norm(c.name), c.slug]),
    ...(mine ?? []).map((m: { id: string; name: string }): [string, string] => [norm(m.name), m.id]),
  ]);
  const names = [...new Set([
    ...(exercises ?? []).map((e) => e.name),
    ...(mine ?? []).map((m: { name: string }) => m.name),
    ...CATALOG.map((c) => c.name),
  ])];
  const weeks = Array.from({ length: cycle.weeks_count }, (_, i) => i + 1);
  // Открытая неделя: из ссылки ?week=N, иначе последняя, где уже есть тренировки, иначе первая
  const woCount = new Map<number, number>();
  for (const w of workouts ?? []) woCount.set(w.week_number, (woCount.get(w.week_number) ?? 0) + 1);
  const asked = Number(weekParam);
  const curWeek = weeks.includes(asked) ? asked : (weeks.filter((w) => woCount.has(w)).at(-1) ?? 1);
  // Тренировки открытой недели по дате; открыта одна — из ?workout=ID или первая
  const weekWorkouts = (workouts ?? []).filter((w) => w.week_number === curWeek)
    .sort((x, y) => (x.workout_date ?? "9999").localeCompare(y.workout_date ?? "9999"));
  const curWorkoutId = weekWorkouts.find((w) => w.id === workoutParam)?.id ?? weekWorkouts[0]?.id;

  // «В прошлый раз»: подходы из последней прошлой тренировки с теми же упражнениями
  const curWo = weekWorkouts.find((w) => w.id === curWorkoutId);
  const curNames = [...new Set((exercises ?? []).filter((e) => e.workout_id === curWorkoutId).map((e) => e.name))];
  let previous = new Map<string, Previous>();
  if (canEdit && curWo && curNames.length && !statsView && !infoTab) {
    const { data: prevRows } = await supabase
      .from("exercises")
      .select("name, workout_id, created_at, workouts(workout_date), workout_sets(weight, reps, set_number), cycles!inner(user_id)")
      .eq("cycles.user_id", cycle.user_id)
      .in("name", curNames)
      .neq("workout_id", curWo.id)
      .order("created_at", { ascending: false })
      .limit(300);
    previous = pickPrevious(
      ((prevRows ?? []) as any[]).map((r) => ({
        name: r.name,
        workoutId: r.workout_id,
        date: r.workouts?.workout_date ?? null,
        createdAt: r.created_at,
        sets: (r.workout_sets ?? []).map((s: any) => ({ weight: Number(s.weight), reps: Number(s.reps), setNumber: Number(s.set_number) })),
      })),
      curWo.id,
      curWo.workout_date ?? null,
    );
  }

  return (
    <>
      <h1>{cycle.name}</h1>
      <p className="muted">
        {cycle.weeks_count} нед. · {cycle.is_public ? "публичный" : "приватный"}
        {!isOwner && ownerName && ` · ${ownerName}`}
        {authorName && ` · план составил ${authorName}`}
        {isAuthor && !isOwner && " · ваш план для подопечного"}
        {!canEdit && " · режим просмотра"}
      </p>
      <datalist id="names">
        {names.map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="workout-subtabs" role="tablist" aria-label="Разделы цикла">
        <Link href={`?week=${curWeek}${curWorkoutId ? `&workout=${curWorkoutId}` : ""}`} scroll={false} role="tab" aria-selected={!statsView} className={!statsView ? "active" : undefined}>Тренировки</Link>
        <Link href="?view=stats" scroll={false} role="tab" aria-selected={statsView} className={statsView ? "active" : undefined}>Статистика</Link>
      </div>

      {!statsView && (
      <div className="weeks-layout">
      <nav className="weeks-nav" aria-label="Недели">
        <h3>Недели</h3>
        {weeks.map((w) => (
          <Link key={w} href={`?week=${w}`} scroll={false} className={w === curWeek ? "active" : undefined} aria-current={w === curWeek ? "page" : undefined}>
            Неделя {w}
            {woCount.has(w) && <span>{woCount.get(w)}</span>}
          </Link>
        ))}
      </nav>
      <div className="weeks-body">
      {weeks.filter((w) => w === curWeek).map((week) => (
        <section key={week} className="card">
          <h2>Неделя {week}</h2>

          {weekWorkouts.length > 0 && (
            <div className="workout-tabs" role="tablist" aria-label="Тренировки недели">
              {weekWorkouts.map((w, i) => (
                <Link key={w.id} href={`?week=${week}&workout=${w.id}`} scroll={false} role="tab"
                  className={w.id === curWorkoutId ? "active" : undefined} aria-selected={w.id === curWorkoutId}
                  title={w.note ?? undefined}>
                  <b>{w.note || `Тренировка ${i + 1}`}</b>
                  <small>{w.workout_date ? fmtDay(w.workout_date) : "Без даты"}</small>
                </Link>
              ))}
            </div>
          )}
          {weekWorkouts.length === 0 && <p className="muted">В этой неделе тренировок пока нет</p>}

          {weekWorkouts.filter((w) => w.id === curWorkoutId).map((wo) => (
            <div key={wo.id} className="workout">
              <div className="row between">
                <div className="workout-head">
                  <b>{wo.workout_date ? fmtDay(wo.workout_date) : "Без даты"}</b>
                  {wo.note && <span className="muted">{wo.note}</span>}
                </div>
                {canEdit && (
                  <div className="row">
                    <details className="addrow" style={{ margin: 0 }}>
                      <summary>Копировать</summary>
                      <form action={duplicateWorkout} className="row">
                        <input type="hidden" name="id" value={wo.id} />
                        <input type="hidden" name="cycle_id" value={id} />
                        <select name="week" defaultValue={week} aria-label="Неделя для копии">
                          {weeks.map((w) => <option key={w} value={w}>Неделя {w}</option>)}
                        </select>
                        <input name="date" type="date" defaultValue={todayStr} aria-label="Дата копии" />
                        <button className="sm primary">Создать копию</button>
                      </form>
                    </details>
                    <form action={deleteWorkout}>
                      <input type="hidden" name="id" value={wo.id} />
                      <input type="hidden" name="cycle_id" value={id} />
                      <ConfirmButton className="sm danger" message="Удалить тренировку со всеми упражнениями и подходами?">Удалить</ConfirmButton>
                    </form>
                  </div>
                )}
              </div>

              <div className="workout-subtabs" role="tablist" aria-label="Разделы тренировки">
                <Link href={`?week=${week}&workout=${wo.id}`} scroll={false} role="tab" aria-selected={!infoTab} className={!infoTab ? "active" : undefined}>Упражнения</Link>
                <Link href={`?week=${week}&workout=${wo.id}&tab=info`} scroll={false} role="tab" aria-selected={infoTab} className={infoTab ? "active" : undefined}>Данные тренировки</Link>
              </div>

              {infoTab && (
              <>
              {(() => {
                const st = String(wo.start_time ?? "").slice(0, 5);
                const en = String(wo.end_time ?? "").slice(0, 5);
                const exIds = new Set((exercises ?? []).filter((e) => e.workout_id === wo.id).map((e) => e.id));
                const restSec = (sets ?? []).filter((s) => exIds.has(s.exercise_id)).reduce((t, s) => t + (Number(s.rest_sec) || 0), 0);
                const total = st && en ? minutesBetween(st, en) : null;
                const rest = Math.round(restSec / 60);
                const net = total === null ? null : Math.max(0, total - rest);
                return (
                  <>
                    {canEdit && (
                      <form action={setWorkoutTimes} className="row" style={{ alignItems: "center", margin: "6px 0" }}>
                        <input type="hidden" name="id" value={wo.id} />
                        <input type="hidden" name="cycle_id" value={id} />
                        <span className="muted">Начало</span>
                        <input name="start" type="time" defaultValue={st} aria-label="Время начала" />
                        <span className="muted">Окончание</span>
                        <input name="end" type="time" defaultValue={en} aria-label="Время окончания" />
                        <button className="sm">Сохранить</button>
                      </form>
                    )}
                    {total !== null && (
                      <p className="muted workout-time">
                        Всего <b>{fmtMin(total)}</b> · отдых <b>{fmtMin(rest)}</b> · чистое время <b>{fmtMin(net ?? 0)}</b>
                      </p>
                    )}
                  </>
                );
              })()}
              </>
              )}

              {!infoTab && (
              <>
              {(exercises ?? []).filter((e) => e.workout_id === wo.id).map((ex) => (
                <div key={ex.id} className="exercise">
                  <div className="row between">
                    {libKey.has(norm(ex.name))
                      ? <Link href={`/exercises/${libKey.get(norm(ex.name))}`}><b>{ex.name}</b></Link>
                      : <b>{ex.name}</b>}
                    {canEdit && (
                      <form action={deleteExercise}>
                        <input type="hidden" name="id" value={ex.id} />
                        <input type="hidden" name="cycle_id" value={id} />
                        <ConfirmButton className="sm danger" aria-label={`Удалить упражнение «${ex.name}»`} message={`Удалить «${ex.name}» вместе с подходами?`}>✕</ConfirmButton>
                      </form>
                    )}
                  </div>

                  {(() => {
                    const p = previous.get(norm(ex.name));
                    return p ? (
                      <p className="muted prev-hint">
                        В прошлый раз ({fmtDay(p.date)}): <b>{p.sets.map((s) => `${s.weight}×${s.reps}`).join(" · ")}</b>
                      </p>
                    ) : null;
                  })()}

                  {(() => {
                    const exSets = (sets ?? []).filter((s: any) => s.exercise_id === ex.id);
                    if (exSets.length === 0 && !canEdit) return null;
                    return (
                      <SetsTable
                        key={`${ex.id}:${exSets.map((s) => s.id).join("-")}`}
                        cycleId={id}
                        exerciseId={ex.id}
                        canEdit={canEdit}
                        rows={exSets.map((s) => ({
                          id: s.id,
                          set_number: s.set_number,
                          weight: Number(s.weight),
                          reps: s.reps,
                          rir: s.rir === null ? null : Number(s.rir),
                          rpe: s.rpe === null ? null : Number(s.rpe),
                          rest: s.rest_sec === null || s.rest_sec === undefined ? null : Number(s.rest_sec),
                          locked: !!s.locked,
                        }))}
                      />
                    );
                  })()}

                  {canEdit
                    ? <ExerciseNote cycleId={id} exerciseId={ex.id} initial={ex.note ?? ""} />
                    : ex.note && <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{ex.note}</p>}
                </div>
              ))}

              {canEdit && (
                <details className="addrow">
                  <summary>+ упражнение</summary>
                  <form action={addExercise} className="row">
                    <input type="hidden" name="cycle_id" value={id} />
                    <input type="hidden" name="workout_id" value={wo.id} />
                    <input name="name" list="names" required placeholder="Название упражнения" style={{ flex: 1 }} />
                    <input name="sets" type="number" min={1} max={20} defaultValue={3} style={{ width: 52 }} title="Количество подходов" aria-label="Подходов" />
                    <span className="muted" style={{ alignSelf: "center", fontSize: 12 }}>подходов ×</span>
                    <input name="reps" type="number" min={1} max={50} defaultValue={8} style={{ width: 52 }} title="Повторений в подходе" aria-label="Повторений" />
                    <span className="muted" style={{ alignSelf: "center", fontSize: 12 }}>повт.</span>
                    <button className="sm primary">Добавить</button>
                  </form>
                </details>
              )}
              </>
              )}
            </div>
          ))}

          {canEdit && (
            <details className="addrow" style={{ marginTop: 10 }}>
              <summary>+ тренировка</summary>
              <form action={addWorkout} className="row">
                <input type="hidden" name="cycle_id" value={id} />
                <input type="hidden" name="week" value={week} />
                <input name="date" type="date" defaultValue={todayStr} />
                <input name="note" placeholder="Название, например «грудь + трицепс»" style={{ flex: 1 }} />
                <button className="sm primary">Добавить</button>
              </form>
            </details>
          )}
        </section>
      ))}
      </div>
      </div>
      )}

      {canEdit && !statsView && <RestTimer />}

      {statsView && (
      <section className="card">
        <h2>Статистика цикла</h2>
        {stats.length ? (
          <table>
            <thead>
              <tr><th>Упражнение</th><th>Макс. вес по неделям</th><th>Прирост</th><th>Лучший 1RM</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.points.map((p) => `Н${p.week}: ${p.maxWeight}`).join(" → ")}</td>
                  <td className={s.progressPct === null ? "" : s.progressPct >= 0 ? "up" : "down"}>
                    {s.progressPct === null ? "—" : `${s.progressPct >= 0 ? "+" : ""}${s.progressPct.toFixed(1)}%`}
                  </td>
                  <td>{Math.round(s.bestE1rm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Статистика появится, когда добавите подходы с весом и повторами</p>
        )}
      </section>
      )}
    </>
  );
}
