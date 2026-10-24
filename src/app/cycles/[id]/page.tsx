import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStats, type SetRow } from "@/lib/stats";
import {
  addWorkout, deleteWorkout, addExercise, deleteExercise, addSet, deleteSet,
} from "@/lib/actions";

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
  const names = [...new Set((exercises ?? []).map((e) => e.name))];
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
                <b>{wo.workout_date ?? "Без даты"} {wo.note}</b>
                {canEdit && (
                  <form action={deleteWorkout}>
                    <input type="hidden" name="id" value={wo.id} />
                    <input type="hidden" name="cycle_id" value={id} />
                    <button className="sm danger">Удалить</button>
                  </form>
                )}
              </div>

              {(exercises ?? []).filter((e) => e.workout_id === wo.id).map((ex) => (
                <div key={ex.id} className="exercise">
                  <div className="row between">
                    <b>{ex.name}</b>
                    {canEdit && (
                      <form action={deleteExercise}>
                        <input type="hidden" name="id" value={ex.id} />
                        <input type="hidden" name="cycle_id" value={id} />
                        <button className="sm danger">✕</button>
                      </form>
                    )}
                  </div>

                  {(sets ?? []).some((s) => s.exercise_id === ex.id) && (
                    <table>
                      <thead>
                        <tr><th>#</th><th>Вес</th><th>Повт.</th><th>RIR</th><th>RPE</th><th></th></tr>
                      </thead>
                      <tbody>
                        {(sets ?? []).filter((s) => s.exercise_id === ex.id).map((s) => (
                          <tr key={s.id}>
                            <td>{s.set_number}</td>
                            <td>{Number(s.weight)}</td>
                            <td>{s.reps}</td>
                            <td>{s.rir ?? "—"}</td>
                            <td>{s.rpe ?? "—"}</td>
                            <td>
                              {canEdit && (
                                <form action={deleteSet}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <input type="hidden" name="cycle_id" value={id} />
                                  <button className="sm danger">✕</button>
                                </form>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {canEdit && (
                    <details className="addrow">
                      <summary>+ подход</summary>
                      <form action={addSet} className="row">
                        <input type="hidden" name="cycle_id" value={id} />
                        <input type="hidden" name="exercise_id" value={ex.id} />
                        <input name="weight" type="number" step="0.5" placeholder="Вес" style={{ width: 90 }} />
                        <input name="reps" type="number" placeholder="Повт." style={{ width: 80 }} />
                        <input name="rir" type="number" min={0} max={10} placeholder="RIR" style={{ width: 70 }} />
                        <input name="rpe" type="number" step="0.5" min={1} max={10} placeholder="RPE" style={{ width: 70 }} />
                        <button className="sm primary">Добавить</button>
                      </form>
                    </details>
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
                <input name="date" type="date" />
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
