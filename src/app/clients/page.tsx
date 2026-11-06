import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { inviteTrainee, respondInvite, removeLink, createTraineeCycle } from "@/lib/coach-actions";

type Side = { id: string; display_name: string };
type RawLink = { id: string; status: string; requested_by: string; note: string | null; trainee?: unknown; coach?: unknown };

const asSide = (v: unknown): Side | null =>
  Array.isArray(v) ? (v[0] as Side) ?? null : (v as Side) ?? null;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; tab?: string }>;
}) {
  const { error, ok, tab: tabParam } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // Связи, где я тренер, и где я подопечный
  const [{ data: asCoach }, { data: asTrainee }] = await Promise.all([
    supabase
      .from("coach_links")
      .select("id, status, requested_by, note, trainee:profiles!coach_links_trainee_id_fkey(id, display_name)")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("coach_links")
      .select("id, status, requested_by, note, coach:profiles!coach_links_coach_id_fkey(id, display_name)")
      .eq("trainee_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Email связанных людей отдаёт функция (миграция 26): напрямую из profiles он закрыт
  const { data: emails } = await supabase.rpc("linked_emails");
  const emailById = new Map<string, string | null>();
  for (const e of (emails ?? []) as { id: string; email: string | null }[]) emailById.set(e.id, e.email);

  const clients = (asCoach as unknown as RawLink[] ?? []).map((l) => ({
    id: l.id,
    status: l.status,
    requestedBy: l.requested_by,
    note: l.note,
    side: asSide(l.trainee),
  }));
  const coaches = (asTrainee as unknown as RawLink[] ?? []).map((l) => ({
    id: l.id,
    status: l.status,
    requestedBy: l.requested_by,
    note: l.note,
    side: asSide(l.coach),
  }));
  // Заявку подтверждает сторона, которая её не отправляла
  const incoming = clients.filter((c) => c.status === "pending" && c.requestedBy !== user.id); // подопечные хотят ко мне
  const listedClients = clients.filter((c) => !incoming.includes(c));
  const requests = coaches.filter((c) => c.status === "pending" && c.requestedBy !== user.id); // тренеры зовут меня
  const sent = coaches.filter((c) => c.status === "pending" && c.requestedBy === user.id); // я просился к тренеру
  const myCoaches = coaches.filter((c) => c.status === "active");

  // Циклы активных подопечных — RLS отдаёт их подтверждённому тренеру
  const activeIds = clients.filter((c) => c.status === "active").map((c) => c.side?.id).filter((x): x is string => !!x);
  const traineeById = new Map(clients.filter((c) => c.status === "active").map((c) => [c.side?.id, c.side]));
  const { data: traineeCycles } = activeIds.length
    ? await supabase
        .from("cycles")
        .select("id, name, weeks_count, user_id, created_by")
        .in("user_id", activeIds)
        .order("created_at", { ascending: false })
    : { data: null };

  // Разделы-вкладки: «План» только при наличии активных подопечных, у «Тренеры» — число заявок
  const TABS = [
    { key: "clients", label: incoming.length ? `Подопечные (${incoming.length})` : "Подопечные" },
    ...(activeIds.length > 0 ? [{ key: "plans", label: "Планы и циклы" }] : []),
    { key: "coaches", label: requests.length ? `Мои тренеры (${requests.length})` : "Мои тренеры" },
  ];
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "clients";

  return (
    <>
      <h1>Подопечные</h1>
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      <div className="workout-subtabs" role="tablist" aria-label="Разделы">
        {TABS.map((t) => (
          <Link key={t.key} href={`/clients?tab=${t.key}`} scroll={false} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : undefined}>{t.label}</Link>
        ))}
      </div>

      {tab === "clients" && (
      <div className="card">
        <h3>Пригласить подопечного</h3>
        <form action={inviteTrainee} className="row">
          <input name="email" type="email" required placeholder="email подопечного" style={{ flex: 1, minWidth: 220 }} />
          <button className="primary">Отправить заявку</button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>
          Подопечный подтвердит заявку на этой странице, после чего вы увидите все его циклы и прогресс.
        </p>
      </div>
      )}

      {tab === "coaches" && requests.length > 0 && (
        <div className="card">
          <h3>Заявки от тренеров</h3>
          {requests.map((r) => (
            <div key={r.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <b>{r.side?.display_name}</b>
              <div className="row">
                <form action={respondInvite}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="answer" value="accept" />
                  <button className="sm primary">Принять</button>
                </form>
                <form action={respondInvite}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="answer" value="decline" />
                  <button className="sm danger">Отклонить</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "clients" && incoming.length > 0 && (
        <div className="card">
          <h3>Хотят заниматься с вами</h3>
          {incoming.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <div className="row between">
                <b>{r.side?.display_name}</b>
                <div className="row">
                  <form action={respondInvite}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="answer" value="accept" />
                    <button className="sm primary">Принять</button>
                  </form>
                  <form action={respondInvite}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="answer" value="decline" />
                    <button className="sm danger">Отклонить</button>
                  </form>
                </div>
              </div>
              {r.note && <p className="muted" style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{r.note}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === "clients" && (
      <div className="card">
        <h3>Мои подопечные</h3>
        {listedClients.length === 0 && <p className="muted">Пока никого нет. Пригласите по email или оставьте <Link href="/coaches?tab=mine">анкету в каталоге</Link>.</p>}
        {listedClients.map((c) => (
          <div key={c.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
            <div>
              <b>{c.side?.display_name}</b> <span className="muted">{c.side && emailById.get(c.side.id)}</span>
              {c.status === "pending" && <span className="muted"> · ждёт подтверждения</span>}
            </div>
            <div className="row">
              {c.status === "active" && (
                <>
                  <span className="muted">связь активна</span>
                  <Link href={`/goals?user=${c.side?.id}`} className="sm-link">Цели</Link>
                  <Link href={`/daily?user=${c.side?.id}`} className="sm-link">Питание и сон</Link>
                  <Link href={`/measurements?user=${c.side?.id}`} className="sm-link">Замеры</Link>
                </>
              )}
              <form action={removeLink}>
                <input type="hidden" name="id" value={c.id} />
                <button className="sm danger">{c.status === "active" ? "Отвязать" : "Отменить"}</button>
              </form>
            </div>
          </div>
        ))}
      </div>
      )}

      {tab === "coaches" && myCoaches.length > 0 && (
        <div className="card">
          <h3>Мои тренеры</h3>
          {myCoaches.map((c) => (
            <div key={c.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <b>{c.side?.display_name}</b>
              <form action={removeLink}>
                <input type="hidden" name="id" value={c.id} />
                <button className="sm danger">Отвязать</button>
              </form>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 13 }}>Тренер видит все ваши циклы и прогресс в режиме просмотра.</p>
        </div>
      )}

      {tab === "coaches" && sent.length > 0 && (
        <div className="card">
          <h3>Отправленные заявки</h3>
          {sent.map((c) => (
            <div key={c.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
              <span><b>{c.side?.display_name}</b> <span className="muted">· ждёт ответа тренера</span></span>
              <form action={removeLink}>
                <input type="hidden" name="id" value={c.id} />
                <button className="sm danger">Отменить</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {tab === "coaches" && requests.length === 0 && sent.length === 0 && myCoaches.length === 0 && (
        <p className="muted">Тренера у вас пока нет. <Link href="/coaches">Найти тренера в каталоге</Link></p>
      )}

      {tab === "plans" && activeIds.length > 0 && (
        <>
          <div className="card">
            <h3>Составить план подопечному</h3>
            <form action={createTraineeCycle} className="stack">
              <select name="trainee_id" required style={{ maxWidth: 320 }}>
                {clients
                  .filter((c) => c.status === "active")
                  .map((c) => (
                    <option key={c.id} value={c.side?.id}>{c.side?.display_name}</option>
                  ))}
              </select>
              <div className="row">
                <input name="name" required placeholder="Например: Массонабор, осень" style={{ flex: 2, minWidth: 200 }} />
                <input name="weeks" type="number" min={1} max={52} defaultValue={4} style={{ width: 90 }} title="Количество недель" aria-label="Количество недель" />
                <span className="muted" style={{ alignSelf: "center", fontSize: 13 }}>недель</span>
                <button className="primary">Составить план</button>
              </div>
            </form>
            <p className="muted" style={{ fontSize: 13 }}>
              План сразу появится в дневнике подопечного, а вы сможете наполнять его тренировками и подходами.
            </p>
          </div>

          <div className="card">
            <h3>Циклы подопечных</h3>
            {(traineeCycles ?? []).map((cy) => {
              const side = traineeById.get(cy.user_id);
              return (
                <div key={cy.id} className="row between" style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
                  <Link href={`/cycles/${cy.id}`}>
                    <b>{cy.name}</b>
                    {cy.created_by === user.id && <span className="up"> · составлен вами</span>}
                  </Link>
                  <span className="muted">{side?.display_name} · {cy.weeks_count} нед.</span>
                </div>
              );
            })}
            {!traineeCycles?.length && <p className="muted">Циклов у подопечных пока нет</p>}
          </div>
        </>
      )}
    </>
  );
}
