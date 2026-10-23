import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  saveMeasurement, deleteMeasurement, uploadProgressPhotos, deleteProgressPhoto,
} from "@/lib/measure-actions";

// Группы замеров: удобное структурирование по частям тела
const GROUPS: { title: string; fields: { key: string; label: string; unit?: string }[] }[] = [
  { title: "Основные", fields: [
    { key: "weight", label: "Вес", unit: "кг" },
    { key: "height", label: "Рост", unit: "см" },
  ]},
  { title: "Руки", fields: [
    { key: "bicep_l", label: "Бицепс слева", unit: "см" },
    { key: "bicep_r", label: "Бицепс справа", unit: "см" },
  ]},
  { title: "Торс", fields: [
    { key: "shoulders", label: "Плечи", unit: "см" },
    { key: "chest", label: "Грудь", unit: "см" },
    { key: "waist", label: "Талия", unit: "см" },
  ]},
  { title: "Ноги", fields: [
    { key: "thigh_l", label: "Бедро слева", unit: "см" },
    { key: "thigh_r", label: "Бедро справа", unit: "см" },
    { key: "calf_l", label: "Икра слева", unit: "см" },
    { key: "calf_r", label: "Икра справа", unit: "см" },
  ]},
];

const ALL_FIELDS = GROUPS.flatMap((g) => g.fields);

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD по местному времени
const monthText = (m: string) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? m
    : d.toLocaleString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
};

type MeasRow = { [k: string]: unknown; measured_on?: string; month?: string };
type PhotoRow = { id: string; month: string; url: string; path: string };

// Дельта с прошлой записью: строка вида "+0.4" / "−1.2" и цвет
function delta(cur: unknown, prev: unknown) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null;
  const diff = Number(cur) - Number(prev);
  if (Math.abs(diff) < 0.05) return { text: "0", cls: "muted" };
  const sign = diff > 0 ? "+" : "−";
  return { text: sign + Math.abs(diff).toFixed(1), cls: diff > 0 ? "up" : "down" };
}

export default async function MeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string; error?: string; ok?: string }>;
}) {
  const { user: targetParam, date: editDate, error, ok } = await searchParams;
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

  // Список по датам, свежие сверху; даты без замеров скрыты
  const [{ data: rows }, { data: photos }] = await Promise.all([
    supabase.from("measurements").select("*").eq("user_id", targetId).order("month", { ascending: false }),
    supabase.from("progress_photos").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
  ]);

  const measurements = (rows ?? []) as MeasRow[];
  // Свежие даты сверху (measured_on; до миграции — по месяцу)
  const dayKey = (r: MeasRow) => String(r.measured_on ?? r.month ?? "").slice(0, 10);
  measurements.sort((a, b) => (dayKey(a) < dayKey(b) ? 1 : -1));
  const photoRows = (photos ?? []) as PhotoRow[];
  const photosByMonth = new Map<string, PhotoRow[]>();
  for (const p of photoRows) {
    const list = photosByMonth.get(p.month) ?? [];
    list.push(p);
    photosByMonth.set(p.month, list);
  }

  // Если редактируем конкретную дату — подставим значения в форму
  const editing = editDate ? measurements.find((r) => String(r.measured_on) === editDate) : undefined;

  const canEdit = isSelf;
  const backLink = isCoachView ? "/clients" : null;
  const chip = (v: unknown) => (v === null || v === undefined ? "—" : String(v).replace(".", ","));

  return (
    <>
      <h1>Характеристики</h1>
      {!isSelf && <p className="muted">Замеры: <b>{target?.display_name ?? "подопечный"}</b> · режим просмотра</p>}
      {backLink && <p><Link href={backLink}>← к подопечным</Link></p>}
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      {canEdit && (
        <div className="card">
          <h3>{editDate ? "Изменить замер" : "Новое измерение"}</h3>
          <form action={saveMeasurement}>
            <div className="row" style={{ marginTop: 6 }}>
              <label>Дата измерения
                <input name="date" type="date" required defaultValue={editDate ?? today()} style={{ maxWidth: 180 }} />
              </label>
              {!editDate && <button className="primary" type="submit">Сохранить</button>}
            </div>
            {editDate && <button className="primary" type="submit">Обновить</button>}
            {GROUPS.map((g) => (
              <div key={g.title} className="m-group">
                <div className="m-group-label">{g.title}</div>
                <div className="m-grid">
                  {g.fields.map((f) => (
                    <label key={f.key} className="m-field">
                      {f.label}
                      <input
                        name={f.key}
                        type="number"
                        step="0.1"
                        min={0}
                        placeholder={f.unit}
                        defaultValue={editing ? String(editing[f.key] ?? "") : ""}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
              Пустые поля сохранятся как «—». Повторный ввод за ту же дату обновит запись.
            </p>
          </form>
        </div>
      )}

      <div className="card">
        <h3>История замеров</h3>
        {measurements.length === 0 && <p className="muted">Замеров пока нет</p>}
        {measurements.map((r, i) => {
          const prev = measurements[i + 1]; // предыдущая по времени запись
          const day = String(r.measured_on ?? "").slice(0, 10);
          const wDelta = delta(r.weight, prev?.weight);
          return (
            <div key={String(r.id)} className="m-entry">
              <div className="between">
                <div>
                  <b style={{ fontSize: 15.5 }}>{fmtDate(day)}</b>
                  {wDelta && JSON.stringify(r.weight) !== "null" && (
                    <span className={`muted`} style={{ fontSize: 13, marginLeft: 10 }}>
                      вес <span className={wDelta.cls}>{wDelta.text === "0" ? "без изменений" : wDelta.text}</span> · {chip(r.weight)} кг
                    </span>
                  )}
                </div>
                {canEdit && (
                  <span className="row" style={{ gap: 8 }}>
                    <Link className="sm-link" href={`/measurements?date=${day}`}>Изменить</Link>
                    <form action={deleteMeasurement}>
                      <input type="hidden" name="id" value={String(r.id)} />
                      <button className="sm danger">✕</button>
                    </form>
                  </span>
                )}
              </div>
              {GROUPS.map((g) => (
                <div key={g.title} className="m-group">
                  <div className="m-group-label">{g.title}</div>
                  <div className="m-grid">
                    {g.fields.map((f) => {
                      const d = delta(r[f.key], prev?.[f.key]);
                      return (
                        <div key={f.key} className="m-chip">
                          <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                            <span className="m-label">{f.label}</span>
                            {d && d.text !== "0" && <span className={`${d.cls} m-delta`}>{d.text}</span>}
                          </div>
                          <div className="v">
                            {chip(r[f.key])}{r[f.key] !== null && r[f.key] !== undefined && <small> {f.unit}</small>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="card">
          <h3>Фото формы</h3>
          <form action={uploadProgressPhotos} className="row">
            <label>Месяц
              <input name="month" type="month" required defaultValue={today().slice(0, 7)} />
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
