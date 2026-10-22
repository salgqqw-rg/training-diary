import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addGoal, toggleGoal, dropGoal, deleteGoal } from "@/lib/goal-actions";

type GoalRow = {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  status: string;
  done_at: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const dateText = (d: string | null) => (d ? d : "—");

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; error?: string; ok?: string }>;
}) {
  const { user: targetParam, error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Свои цели или цели подопечного (?user=)
  const targetId = targetParam ?? user.id;
  const isSelf = targetId === user.id;
  if (!isSelf) {
    const { data: link } = await supabase
      .from("coach_links")
      .select("id")
      .eq("coach_id", user.id)
      .eq("trainee_id", targetId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) redirect("/clients?error=" + encodeURIComponent("Цели доступны только для ваших подопечных"));
  }

  const target = isSelf
    ? { display_name: null }
    : (await supabase.from("profiles").select("display_name").eq("id", targetId).maybeSingle()).data;

  const { data: rows } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", targetId)
    .order("status", { ascending: false })
    .order("created_at", { ascending: false });

  const goals = (rows ?? []) as GoalRow[];
  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "done");
  const dropped = goals.filter((g) => g.status === "dropped");

  return (
    <>
      <h1>Цели</h1>
      {!isSelf && <p className="muted">Цели: <b>{target?.display_name ?? "подопечный"}</b> · режим просмотра</p>}
      {!isSelf && <p><Link href="/clients">← к подопечным</Link></p>}
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      {isSelf && (
        <div className="card">
          <h3>Новая цель</h3>
          <form action={addGoal} className="stack">
            <label>Что хотите достичь
              <input name="title" required maxLength={150} placeholder="Например: вес 80 кг к декабрю" style={{ width: "100%" }} />
            </label>
            <div className="row">
              <label>Срок
                <input name="due_date" type="date" min={today()} />
              </label>
              <label style={{ flex: 1 }}>Как поймёте, что цель достигнута (необязательно)
                <input name="details" maxLength={500} style={{ width: "100%" }} />
              </label>
            </div>
            <button className="primary">Поставить цель</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Активные цели</h3>
        {active.length === 0 && <p className="muted">Активных целей нет</p>}
        {active.map((g) => (
          <div key={g.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
            <div>
              <b>{g.title}</b>
              {g.due_date && <span className="muted"> · до {dateText(g.due_date)}</span>}
              {g.details && <p className="muted" style={{ margin: "2px 0 0" }}>{g.details}</p>}
            </div>
            {isSelf && (
              <div className="row">
                <form action={toggleGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="done" value="true" />
                  <button className="sm primary">✓ Достигнуто</button>
                </form>
                <form action={dropGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="sm">Отказаться</button>
                </form>
                <form action={deleteGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="sm danger">✕</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div className="card">
          <h3>Достигнутые</h3>
          {done.map((g) => (
            <div key={g.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <div>
                <b>{g.title}</b>
                <span className="up"> · выполнено{g.done_at ? ` ${new Date(g.done_at).toISOString().slice(0, 10)}` : ""}</span>
              </div>
              {isSelf && (
                <div className="row">
                  <form action={toggleGoal}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="done" value="false" />
                    <button className="sm">Вернуть в работу</button>
                  </form>
                  <form action={deleteGoal}>
                    <input type="hidden" name="id" value={g.id} />
                    <button className="sm danger">✕</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dropped.length > 0 && (
        <div className="card">
          <h3>Отменённые</h3>
          {dropped.map((g) => (
            <div key={g.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <div>
                <span className="muted">{g.title}</span>
              </div>
              {isSelf && (
                <div className="row">
                  <form action={toggleGoal}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="done" value="false" />
                    <button className="sm">Вернуть в работу</button>
                  </form>
                  <form action={deleteGoal}>
                    <input type="hidden" name="id" value={g.id} />
                    <button className="sm danger">✕</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
