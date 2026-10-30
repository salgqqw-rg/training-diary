import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStats, type SetRow } from "@/lib/stats";
import { CATALOG, norm } from "@/lib/exercise-catalog";
import {
  addWorkout, deleteWorkout, addExercise, deleteExercise,
} from "@/lib/actions";
import Link from "next/link";
import { QuickSets } from "./quick-sets";
import { SetsTable } from "./sets-table";
import { ConfirmButton } from "@/components/confirm-button";

// «2026-10-29» → «29 окт., чт» (в UTC, чтобы дата не «плыла» из-за часового пояса)
const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" });
};

export default async function CyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
  let authorName: string | null = null;
  if (cycle.created_by && cycle.created_by !== user?.id) {
    const { data: author } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", cycle.created_by)
      .maybeSingle();
    authorName = author?.display_name ?? null;
  }
  const ownerName = cycle.owner?.display_name ?? null;

  const [{ data: workouts }, { data: exercises }, { data: sets }] = await Promise.all([
    supabase.from("workouts").select("*").eq("cycle_id", id).order("created_at"),
    supabase.from("exercises").select("*").eq("cycle_id", id).order("created_at"),
    supabase.from("workout_sets").select("*").eq("cycle_id", id).order("set_number"),
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
  const { data: mine } = user
    ? await supabase.from("user_exercises").select("id, name, base_key").eq("owner_id", user.id).is("base_key", null)
    : { data: null };
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

      {weeks.map((week) => (
        <section key={week} className="card">
          <h2>Неделя {week}</h2>

          {(workouts ?? []).filter((w) => w.week_number === week).map((wo) => (
            <div key={wo.id} className="workout">
              <div className="row between">
                <div className="workout-head">
                  <b>{wo.workout_date ? fmtDay(wo.workout_date) : "Без даты"}</b>
                  {wo.note && <span className="muted">{wo.note}</span>}
                </div>
                {canEdit && (
                  <form action={deleteWorkout}>
                    <input type="hidden" name="id" value={wo.id} />
                    <input type="hidden" name="cycle_id" value={id} />
                    <ConfirmButton className="sm danger" message="Удалить тренировку со всеми упражнениями и подходами?">Удалить</ConfirmButton>
                  </form>
                )}
              </div>

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
                    const exSets = (sets ?? []).filter((s) => s.exercise_id === ex.id);
                    if (exSets.length === 0) return null;
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
                        }))}
                      />
                    );
                  })()}

                  {canEdit && (
                    <QuickSets cycleId={id} exerciseId={ex.id} />
                  )}
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
            </div>
          ))}

          {canEdit && (
            <details className="addrow" style={{ marginTop: 10 }}>
              <summary>+ тренировка</summary>
              <form action={addWorkout} className="row">
                <input type="hidden" name="cycle_id" value={id} />
                <input type="hidden" name="week" value={week} />
                <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <input name="note" placeholder="Заметка, например «грудь + трицепс»" style={{ flex: 1 }} />
                <button className="sm primary">Добавить</button>
              </form>
            </details>
          )}
        </section>
      ))}

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
    </>
  );
}
