import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const fmt = (n: number, max = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: max });

// Классификация упражнения в группу мышц по названию (грубая, но наглядная)
function muscleGroup(name: string): string {
  const s = name.toLowerCase().replace("ё", "е");
  const has = (...kw: string[]) => kw.some((k) => s.includes(k));
  if (has("ног", "присед", "выпад", "жим ногами", "квадри", "сгибание", "разгибание", "ягодиц", "икры", "голень")) return "Ноги";
  if (has("плеч", "жим стоя", "жим сидя", "над головой", "мах", "шраг", "арнольд")) return "Плечи";
  if (has("бицепс", "трицепс", "предплеч", "молот", "франц", "брусь", "ена по", "гана на бицепс")) return "Руки";
  if (has("груд", "отжим", "лежа", "развод", "кроссовер", "жим с")) return "Грудь";
  if (has("тяга", "подтяг", "гребля", "станов", "гиперэкстенз")) return "Спина";
  return "Прочее";
}

const ORDER = ["Грудь", "Спина", "Плечи", "Руки", "Ноги", "Прочее"] as const;
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

// «Статистика» — общие показатели, распределение по мышцам, активность по дням
export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: cycles } = await supabase.from("cycles").select("id").eq("user_id", user.id);
  const ids = (cycles ?? []).map((c) => c.id);

  const [{ data: workouts }, { data: sets }] = ids.length
    ? await Promise.all([
        supabase.from("workouts").select("workout_date").in("cycle_id", ids),
        supabase.from("workout_sets")
          .select("weight, reps, exercises(name)").in("cycle_id", ids),
      ])
    : [{ data: null }, { data: null }];

  const rows = ((sets ?? []) as any[]).map((s) => ({
    name: s.exercises?.name ?? "",
    volume: Number(s.weight) * Number(s.reps),
  }));
  const wos = (workouts ?? []) as { workout_date: string | null }[];

  if (!rows.length && !wos.length) {
    return (
      <>
        <h1>Статистика</h1>
        <p className="muted">
          Статистика появится после тренировок — запиши их в <Link href="/diary">Дневнике</Link>
        </p>
      </>
    );
  }

  const volume = rows.reduce((t, r) => t + r.volume, 0);

  // Группы мышц: доля подходов
  const muscle = new Map<string, number>();
  for (const r of rows) if (r.name) muscle.set(muscleGroup(r.name), (muscle.get(muscleGroup(r.name)) ?? 0) + 1);
  const totalSets = [...muscle.values()].reduce((a, b) => a + b, 0) || 1;
  const mRows = ORDER.map((g) => ({ g, pct: Math.round(((muscle.get(g) ?? 0) / totalSets) * 100) }))
    .filter((r) => r.pct > 0);
  const mMax = Math.max(...mRows.map((r) => r.pct), 1);

  // Активность по дням недели (последние 8 недель записанных тренировок)
  const cutDate = new Date(Date.now() - 56 * 864e5).toISOString().slice(0, 10);
  const perDay = new Array(7).fill(0) as number[];
  for (const w of wos) {
    if (!w.workout_date || w.workout_date < cutDate) continue;
    const dow = (new Date(w.workout_date + "T00:00:00").getDay() + 6) % 7; // Пн = 0
    perDay[dow]++;
  }
  const dMax = Math.max(...perDay, 1);

  return (
    <>
      <h1>Статистика</h1>

      <div className="kpi-grid">
        <div className="card kpi">
          <div className="t">Тренировок</div>
          <div className="v">{fmt(wos.length, 0)}</div>
          <span className="s">записей в дневнике</span>
        </div>
        <div className="card kpi">
          <div className="t">Общий объём</div>
          <div className="v">{fmt(volume, 0)} кг</div>
          <span className="s">вес × повторы по всем подходам</span>
        </div>
        <div className="card kpi">
          <div className="t">Подходов</div>
          <div className="v">{fmt(rows.length, 0)}</div>
          <span className="s">за всё время</span>
        </div>
      </div>

      {mRows.length > 0 && (
        <div className="card">
          <h3>Группы мышц</h3>
          {mRows.map((r) => (
            <div key={r.g} className="m-row">
              <span className="mn">{r.g}</span>
              <span className="m-track"><span className="m-fill" style={{ width: `${(r.pct / mMax) * 100}%` }} /></span>
              <span className="mp">{r.pct}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Тренировочная активность</h3>
        {wos.some((w) => w.workout_date) ? (
          <div className="w-bars">
            {perDay.map((n, i) => (
              <div key={i} className="b" title={`${WD[i]}: ${n}`}>
                <span className="val">{n > 0 ? n : ""}</span>
                <span
                  className={`bar${n === 0 ? " zero" : ""}${n > 0 && n === dMax ? " peak" : ""}`}
                  style={{ height: `${Math.max((n / dMax) * 100, 4)}%` }}
                />
                <span className="lbl">{WD[i]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Укажи даты тренировок — увидишь, какой день недели самый загруженный</p>
        )}
        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Записанные тренировки за последние 8 недель, по дням недели</p>
      </div>
    </>
  );
}
