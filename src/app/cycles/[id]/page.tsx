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

  // RLS отдаёт цикл только владельцу или если он публичный
  const { data: cycle } = await supabase.from("cycles").select("*").eq("id", id).maybeSingle();
  if (!cycle) notFound();
  const isOwner = user?.id === cycle.user_id;

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
        {!isOwner && " · режим просмотра"}
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
                {isOwner && (
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
                    {isOwner && (
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
                              {isOwner && (
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

                  {isOwner && (
                    <form action={addSet} className="row">
                      <input type="hidden" name="cycle_id" value={id} />
                      <input type="hidden" name="exercise_id" value={ex.id} />
                      <input name="weight" type="number" step="0.5" placeholder="Вес" style={{ width: 90 }} />
                      <input name="reps" type="number" placeholder="Повт." style={{ width: 80 }} />
                      <input name="rir" type="number" min={0} max={10} placeholder="RIR" style={{ width: 70 }} />
                      <input name="rpe" type="number" step="0.5" min={1} max={10} placeholder="RPE" style={{ width: 70 }} />
                      <button className="sm">+ подход</button>
                    </form>
                  )}
                </div>
              ))}

              {isOwner && (
                <form action={addExercise} className="row">
                  <input type="hidden" name="cycle_id" value={id} />
                  <input type="hidden" name="workout_id" value={wo.id} />
                  <input name="name" list="names" required placeholder="Упражнение" style={{ flex: 1 }} />
                  <button className="sm">+ упражнение</button>
                </form>
              )}
            </div>
          ))}

          {isOwner && (
            <form action={addWorkout} className="row" style={{ marginTop: 10 }}>
              <input type="hidden" name="cycle_id" value={id} />
              <input type="hidden" name="week" value={week} />
              <input name="date" type="date" />
              <input name="note" placeholder="Заметка, например «грудь + трицепс»" style={{ flex: 1 }} />
              <button className="sm primary">+ тренировка</button>
            </form>
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
