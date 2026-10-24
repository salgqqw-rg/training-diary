"use client";

import { useEffect, useState } from "react";
import { addMealEntry, deleteMealEntry } from "@/lib/food-actions";

export type MealEntryDTO = {
  id: string;
  meal: string;
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

type SearchItem = { ref: string; name: string; sub: string; kcal100: number };

const MEALS: { key: string; label: string }[] = [
  { key: "breakfast", label: "Завтрак" },
  { key: "lunch", label: "Обед" },
  { key: "dinner", label: "Ужин" },
  { key: "snack", label: "Перекус" },
];

const f1 = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return String(v).replace(".", ",");
};

function Totals({ entries }: { entries: MealEntryDTO[] }) {
  const sum = (k: "kcal" | "protein_g" | "fat_g" | "carbs_g") =>
    entries.reduce((t, e) => t + Number(e[k] ?? 0), 0);
  const cells = [
    { lbl: "Ккал", v: sum("kcal") },
    { lbl: "Белки", v: sum("protein_g"), s: " г" },
    { lbl: "Жиры", v: sum("fat_g"), s: " г" },
    { lbl: "Углеводы", v: sum("carbs_g"), s: " г" },
  ];
  return (
    <div className="fd-totals">
      {cells.map((c) => (
        <div key={c.lbl} className="fd-t">
          <span className="lbl">{c.lbl}</span>
          <b>{c.v >= 100 || !c.s ? Math.round(c.v) : f1(c.v)}{c.s ?? ""}</b>
        </div>
      ))}
    </div>
  );
}

export function FoodDay({
  date,
  canEdit,
  entries,
}: {
  date: string;
  canEdit: boolean;
  entries: MealEntryDTO[];
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setItems(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`);
        const j = (await res.json()) as { items?: SearchItem[] };
        setItems(j.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <Totals entries={entries} />

      {canEdit && (
        <div className="fd-add">
          <div className="row" style={{ marginBottom: 8 }}>
            <b>Добавить продукт</b>
            <button
              className="sm"
              type="button"
              onClick={() => setManual((v) => !v)}
            >
              {manual ? "← поиск" : "ввести вручную"}
            </button>
          </div>

          {manual ? (
            <form action={addMealEntry} className="stack" style={{ marginBottom: 0 }}>
              <input type="hidden" name="log_date" value={date} />
              <div className="row">
                <label>Приём
                  <select name="meal" defaultValue="breakfast" style={{ width: "100%" }}>
                    {MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </label>
                <label style={{ flex: 2 }}>Наименование
                  <input name="name" required maxLength={150} placeholder="Например: овсянка" />
                </label>
              </div>
              <div className="row">
                <label>Ккал/100 г<input name="kcal100" type="number" step="0.1" min={0} style={{ width: 110 }} /></label>
                <label>Белки<input name="p100" type="number" step="0.1" min={0} style={{ width: 90 }} /></label>
                <label>Жиры<input name="f100" type="number" step="0.1" min={0} style={{ width: 90 }} /></label>
                <label>Углев.<input name="c100" type="number" step="0.1" min={0} style={{ width: 90 }} /></label>
                <label>Масса, г<input name="grams" type="number" step="1" min={1} defaultValue={100} style={{ width: 100 }} /></label>
              </div>
              <label className="fd-check">
                <input type="checkbox" name="save_custom" value="1" defaultChecked />
                <span>сохранить в свою базу продуктов</span>
              </label>
              <button className="primary" style={{ alignSelf: "flex-start" }}>Добавить</button>
            </form>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Найти продукт: например, «творог»"
                style={{ width: "100%" }}
              />
              {loading && <p className="muted" style={{ fontSize: 13 }}>Ищу…</p>}
              {items !== null && !loading && (
                <div className="fd-results">
                  {items.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Ничего не найдено</p>}
                  {items.map((it) => (
                    <div key={it.ref} className="fd-item">
                      <div className="fd-item-info">
                        <b>{it.name}</b>
                        <span className="muted">{it.sub}</span>
                      </div>
                      <form action={addMealEntry} className="fd-form">
                        <input type="hidden" name="log_date" value={date} />
                        <input type="hidden" name="food_ref" value={it.ref} />
                        <input type="hidden" name="name" value={it.name} />
                        <select name="meal" defaultValue="breakfast" className="fd-meal-sel" aria-label="Приём пищи">
                          {MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                        <input name="grams" type="number" step="1" min={1} defaultValue={100} style={{ width: 74 }} aria-label="Граммов" />
                        <button className="sm primary">+</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              {items === null && !loading && (
                <p className="muted" style={{ fontSize: 13 }}>Набери название — появятся продукты с КБЖУ на 100 г</p>
              )}
            </>
          )}
        </div>
      )}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.key);
        return (
          <div key={m.key} className="fd-meal">
            <h4>{m.label}</h4>
            {list.length === 0 && <p className="muted" style={{ fontSize: 13, margin: "2px 0 0" }}>Пусто</p>}
            {list.map((e) => (
              <div key={e.id} className="fd-entry">
                <span>{e.name}</span>
                <small className="muted">
                  {f1(e.grams)} г · {e.kcal >= 100 || Number.isInteger(e.kcal) ? Math.round(e.kcal) : f1(e.kcal)} ккал
                  {" "}· Б {f1(e.protein_g)} · Ж {f1(e.fat_g)} · У {f1(e.carbs_g)}
                </small>
                {canEdit && (
                  <form action={deleteMealEntry} style={{ display: "inline", flexShrink: 0 }}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="log_date" value={date} />
                    <button className="sm danger">✕</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
