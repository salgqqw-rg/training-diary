import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCycle, deleteCycle, togglePublic } from "@/lib/actions";
import { ConfirmButton } from "@/components/confirm-button";

// «Дневник» — управление тренировочными программами (бывш. «Мои циклы»)
export default async function DiaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, weeks_count, is_public, created_by")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <h1>Дневник</h1>

      <div className="card">
        <h3>Новый цикл</h3>
        <form action={createCycle} className="row">
          <input name="name" required placeholder="Например: Сила, блок 1" style={{ flex: 2, minWidth: 200 }} />
          <input name="weeks" type="number" min={1} max={52} defaultValue={4} style={{ width: 90 }} title="Количество недель" aria-label="Количество недель" />
          <span className="muted" style={{ alignSelf: "center", fontSize: 13 }}>недель</span>
          <button className="primary">Создать</button>
        </form>
      </div>

      {(cycles ?? []).map((c) => (
        <div key={c.id} className="card cycle-row">
          <Link href={`/cycles/${c.id}`}><b>{c.name}</b></Link>
          <span className="muted">
            {c.created_by && c.created_by !== user.id && <span className="up">от тренера · </span>}
            {c.weeks_count} нед. · {c.is_public ? "публичный" : "приватный"}
          </span>
          <div className="row">
            <form action={togglePublic}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="is_public" value={String(c.is_public)} />
              <button className="sm">{c.is_public ? "Скрыть" : "Опубликовать"}</button>
            </form>
            <form action={deleteCycle}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton className="sm danger" message={`Удалить цикл «${c.name}» со всеми тренировками и подходами? Это нельзя отменить.`}>Удалить</ConfirmButton>
            </form>
          </div>
        </div>
      ))}
      {!cycles?.length && <p className="muted">Циклов пока нет</p>}
    </>
  );
}
