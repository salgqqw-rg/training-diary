import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  saveMeasurement, deleteMeasurement, uploadProgressPhotos, deleteProgressPhoto,
} from "@/lib/measure-actions";

const FIELDS: { key: string; label: string }[] = [
  { key: "weight", label: "Вес, кг" },
  { key: "height", label: "Рост, см" },
  { key: "bicep_l", label: "Бицепс Л" },
  { key: "bicep_r", label: "Бицепс П" },
  { key: "shoulders", label: "Плечи" },
  { key: "chest", label: "Грудь" },
  { key: "thigh_l", label: "Бедро Л" },
  { key: "thigh_r", label: "Бедро П" },
  { key: "waist", label: "Талия" },
  { key: "calf_l", label: "Икра Л" },
  { key: "calf_r", label: "Икра П" },
];

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
const monthText = (m: string) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? m
    : d.toLocaleString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
};
const todayMonth = () => new Date().toISOString().slice(0, 7);

type MeasRow = { [k: string]: unknown };
type PhotoRow = { id: string; month: string; url: string; path: string };

export default async function MeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; month?: string; error?: string; ok?: string }>;
}) {
  const { user: targetParam, month: editMonth, error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Свои замеры или замеры подопечного (?user=)
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
    if (!link) redirect("/clients?error=" + encodeURIComponent("Замеры доступны только для ваших подопечных"));
    isCoachView = true;
  }

  const target = isSelf
    ? { display_name: "мои замеры" }
    : (await supabase.from("profiles").select("display_name").eq("id", targetId).maybeSingle()).data;

  const [{ data: rows }, { data: photos }] = await Promise.all([
    supabase.from("measurements").select("*").eq("user_id", targetId).order("month", { ascending: false }),
    supabase.from("progress_photos").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
  ]);

  const measurements = (rows ?? []) as MeasRow[];
  const photoRows = (photos ?? []) as PhotoRow[];
  const photosByMonth = new Map<string, PhotoRow[]>();
  for (const p of photoRows) {
    const list = photosByMonth.get(p.month) ?? [];
    list.push(p);
    photosByMonth.set(p.month, list);
  }

  // Если редактируем конкретный месяц — подставим значения в форму
  const editing = editMonth ? measurements.find((r) => r.month === `${editMonth}-01`) : undefined;

  const canEdit = isSelf;
  const backLink = isCoachView ? "/clients" : null;

  return (
    <>
      <h1>Характеристики</h1>
      {!isSelf && <p className="muted">Замеры: <b>{target?.display_name ?? "подопечный"}</b> · режим просмотра</p>}
      {backLink && <p><Link href={backLink}>← к подопечным</Link></p>}
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      {canEdit && (
        <div className="card">
          <h3>Замеры за месяц</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Повторное заполнение за тот же месяц обновит запись.
          </p>
          <form action={saveMeasurement}>
            <div className="row">
              <label>Месяц
                <input name="month" type="month" required defaultValue={editMonth ?? todayMonth()} />
              </label>
              {!editMonth && <button className="primary" type="submit">Сохранить</button>}
            </div>
            {editMonth && <button className="primary" type="submit">Обновить</button>}
            <div className="row" style={{ marginTop: 8 }}>
              {FIELDS.map((f) => (
                <label key={f.key}>{f.label}
                  <input
                    name={f.key}
                    type="number"
                    step="0.1"
                    min={0}
                    defaultValue={editing ? String(editing[f.key] ?? "") : ""}
                    style={{ width: 110 }}
                  />
                </label>
              ))}
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3>История по месяцам</h3>
        {measurements.length === 0 && <p className="muted">Замеров пока нет</p>}
        {measurements.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Месяц</th>
                  {FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {measurements.map((r) => {
                  const m = String(r.month).slice(0, 7);
                  return (
                    <tr key={String(r.id)}>
                      <td>{monthText(m)}</td>
                      {FIELDS.map((f) => <td key={f.key}>{fmt(r[f.key])}</td>)}
                      {canEdit && (
                        <td>
                          <Link href={`/measurements?month=${m}`}>Изменить</Link>
                          {" "}
                          <form action={deleteMeasurement} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={String(r.id)} />
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

      {canEdit && (
        <div className="card">
          <h3>Фото формы</h3>
          <form action={uploadProgressPhotos} className="row">
            <label>Месяц
              <input name="month" type="month" required defaultValue={todayMonth()} />
            </label>
            <label style={{ flex: 1 }}>Фото (до 10 МБ каждое, можно несколько)
              <input name="photos" type="file" accept="image/*" multiple />
            </label>
            <button className="primary">Загрузить</button>
          </form>

          {[...photosByMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([m, list]) => (
            <div key={m} style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
              <b>{monthText(m)}</b>
              <div className="row" style={{ gap: 10 }}>
                {list.map((p) => (
                  <div key={p.id} style={{ textAlign: "center" }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      <img src={p.url} alt={`Фото ${m}`} width={100} height={100}
                        style={{ objectFit: "cover", borderRadius: 8 }} />
                    </a>
                    <form action={deleteProgressPhoto}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="sm danger">✕</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {photoRows.length === 0 && <p className="muted">Фото пока нет</p>}
        </div>
      )}

      {!canEdit && photoRows.length > 0 && (
        <div className="card">
          <h3>Фото формы</h3>
          {[...photosByMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([m, list]) => (
            <div key={m} style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
              <b>{monthText(m)}</b>
              <div className="row" style={{ gap: 10 }}>
                {list.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                    <img src={p.url} alt={`Фото ${m}`} width={100} height={100}
                      style={{ objectFit: "cover", borderRadius: 8 }} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
