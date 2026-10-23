import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCycle, deleteCycle, togglePublic } from "@/lib/actions";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, weeks_count, is_public")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <h1>Мои циклы</h1>

      <div className="card">
        <h3>Новый цикл</h3>
        <form action={createCycle} className="row">
          <input name="name" required placeholder="Например: Сила, блок 1" style={{ flex: 2, minWidth: 200 }} />
          <input name="weeks" type="number" min={1} max={52} defaultValue={4} style={{ width: 90 }} />
          <button className="primary">Создать</button>
        </form>
      </div>

      {(cycles ?? []).map((c) => (
        <div key={c.id} className="card row between">
          <Link href={`/cycles/${c.id}`}><b>{c.name}</b></Link>
          <span className="muted">{c.weeks_count} нед. · {c.is_public ? "публичный" : "приватный"}</span>
          <div className="row">
            <form action={togglePublic}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="is_public" value={String(c.is_public)} />
              <button className="sm">{c.is_public ? "Скрыть" : "Опубликовать"}</button>
            </form>
            <form action={deleteCycle}>
              <input type="hidden" name="id" value={c.id} />
              <button className="sm danger">Удалить</button>
            </form>
          </div>
        </div>
      ))}
      {!cycles?.length && <p className="muted">Циклов пока нет</p>}
    </>
  );
}
