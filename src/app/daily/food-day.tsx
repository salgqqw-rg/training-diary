"use client";

import { useEffect, useState } from "react";
import { addMealEntry, deleteMealEntry, updateMealEntry, repeatMealEntry, copyMeals } from "@/lib/food-actions";

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

// Недавний продукт для быстрого повтора: последняя запись с этим названием
export type RecentDTO = { id: string; name: string; grams: number; kcal: number };

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
const kc = (n: number) => (n >= 100 || Number.isInteger(n) ? Math.round(n) : f1(n));

type Target = { kcal: number; protein_g: number; fat_g: number; carbs_g: number };

// Итоги дня. На телефоне панель липнет к верху экрана, пока листаешь приёмы пищи
function Summary({ entries, target }: { entries: MealEntryDTO[]; target: Target | null }) {
  const sum = (k: "kcal" | "protein_g" | "fat_g" | "carbs_g") => entries.reduce((t, e) => t + Number(e[k] ?? 0), 0);
  const kcal = sum("kcal");
  const left = target ? Math.round(target.kcal - kcal) : null;
  const macros = [
    { l: "Белки", v: sum("protein_g"), t: target?.protein_g },
    { l: "Жиры", v: sum("fat_g"), t: target?.fat_g },
    { l: "Углеводы", v: sum("carbs_g"), t: target?.carbs_g },
  ];
  return (
    <div className="fd-sum">
      <div className="fd-macros">
        <div>
          <span className="lbl">Ккал</span>
          <b className="fd-big">{Math.round(kcal)}</b>
          {target && <small className="muted"> / {target.kcal}</small>}
          {target && <i className="fd-bar thin"><u className={kcal > target.kcal ? "over" : ""} style={{ width: `${Math.min(100, (kcal / target.kcal) * 100)}%` }} /></i>}
        </div>
        {macros.map((m) => (
          <div key={m.l}>
            <span className="lbl">{m.l}</span>
            <b>{m.v >= 100 ? Math.round(m.v) : f1(m.v)}</b>
            {m.t ? <small className="muted"> / {m.t} г</small> : <small className="muted u"> г</small>}
            {m.t ? <i className="fd-bar thin"><u className={m.v > m.t ? "over" : ""} style={{ width: `${Math.min(100, (m.v / m.t) * 100)}%` }} /></i> : null}
          </div>
        ))}
      </div>
      {left !== null && (
        <p className={left < 0 ? "fd-left over" : "fd-left"}>{left >= 0 ? `осталось ${left} ккал` : `выше нормы на ${-left} ккал`}</p>
      )}
    </div>
  );
}

// Ручной ввод в стиле FatSecret: название, производитель, ценность на 100 г или на порцию.
// Поля называются kcal100/p100/f100/c100, но при per=serving значения — на порцию (пересчёт на сервере).
function ManualForm({ date, meal }: { date: string; meal: string }) {
  const [per, setPer] = useState<"100" | "serving">("100");
  const [serving, setServing] = useState("100");
  const [grams, setGrams] = useState("100");
  const num = (name: string, label: string) => (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: 0, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
      {label}
      <input name={name} type="number" inputMode="decimal" step="0.1" min={0} style={{ width: 120, margin: 0, textAlign: "right" }} />
    </label>
  );
  return (
    <form action={addMealEntry} className="stack" style={{ marginBottom: 0 }}>
      <input type="hidden" name="log_date" value={date} />
      <input type="hidden" name="meal" value={meal} />
      <div className="row f-grid">
        <label className="span2" style={{ flex: 2 }}>Наименование
          <input name="name" required maxLength={100} placeholder="Например: овсянка" />
        </label>
        <label className="span2" style={{ flex: 1 }}>Производитель
          <input name="brand" maxLength={50} placeholder="Необязательно" />
        </label>
      </div>
      <div className="row f-grid">
        <div className="seg" style={{ maxWidth: 280 }}>
          <label className="seg-opt">
            <input type="radio" name="per" value="100" checked={per === "100"} onChange={() => setPer("100")} />
            <span>На 100 г</span>
          </label>
          <label className="seg-opt">
            <input type="radio" name="per" value="serving" checked={per === "serving"} onChange={() => { setPer("serving"); setGrams(serving); }} />
            <span>На порцию</span>
          </label>
        </div>
        {per === "serving" && (
          <label>Размер порции, г
            <input name="serving" type="number" inputMode="decimal" step="0.1" min={0.1} required value={serving}
              onChange={(e) => { setServing(e.target.value); setGrams(e.target.value); }} style={{ width: 130 }} />
          </label>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Пищевая ценность {per === "100" ? "на 100 г" : `на порцию (${serving || "?"} г)`}
      </p>
      <div>
        {num("kcal100", "Калории, ккал")}
        {num("f100", "Жиры, г")}
        {num("c100", "Углеводы, г")}
        {num("p100", "Белки, г")}
      </div>
      <div className="row f-grid">
        <label>Сколько съедено, г
          <input name="grams" type="number" inputMode="decimal" step="0.1" min={0.1} required value={grams}
            onChange={(e) => setGrams(e.target.value)} style={{ width: 130 }} />
        </label>
      </div>
      <label className="fd-check">
        <input type="checkbox" name="save_custom" value="1" defaultChecked />
        <span>сохранить в общую библиотеку продуктов</span>
      </label>
      <button className="primary" style={{ alignSelf: "flex-start" }}>Добавить</button>
    </form>
  );
}

// Панель добавления под заголовком приёма: поиск, недавние продукты, копия вчерашнего, ручной ввод
function AddPanel({
  date, meal, label, recent, prev,
}: {
  date: string;
  meal: string;
  label: string;
  recent: RecentDTO[];
  prev: { date: string; count: number };
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

  if (manual) {
    return (
      <div className="fd-add">
        <div className="row between" style={{ marginBottom: 8 }}>
          <b>Свой продукт</b>
          <button className="sm" type="button" onClick={() => setManual(false)}>← поиск</button>
        </div>
        <ManualForm date={date} meal={meal} />
      </div>
    );
  }

  return (
    <div className="fd-add">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Найти продукт: например, «творог»"
        style={{ width: "100%" }}
        autoFocus
        enterKeyHint="search"
      />
      {loading && <p className="muted" style={{ fontSize: 13 }}>Ищу…</p>}
      {!loading && items?.some((it) => it.ref.startsWith("of:")) && (
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
          Содержит данные <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>
          {", "}
          <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">лицензия ODbL</a>
        </p>
      )}
      {!loading && items?.some((it) => it.ref.startsWith("fs:")) && (
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
          Данные <a href="https://platform.fatsecret.com" target="_blank" rel="noreferrer">fatsecret Platform API</a>
        </p>
      )}

      {items !== null && !loading && (
        <div className="fd-results">
          {items.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Ничего не найдено. Можно ввести продукт вручную.</p>}
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
                <input type="hidden" name="meal" value={meal} />
                <input name="grams" type="number" inputMode="decimal" step="1" min={1} defaultValue={100} style={{ width: 84 }} aria-label="Граммов" />
                <button className="sm primary" aria-label={`Добавить: ${it.name}`}>+</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {items === null && !loading && (
        <>
          {prev.count > 0 && (
            <form action={copyMeals} className="fd-copy">
              <input type="hidden" name="from" value={prev.date} />
              <input type="hidden" name="log_date" value={date} />
              <input type="hidden" name="meal" value={meal} />
              <button type="submit">Скопировать вчерашний {label.toLowerCase()} ({prev.count})</button>
            </form>
          )}
          {recent.length > 0 && (
            <div className="fd-results">
              <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Недавние</p>
              {recent.map((r) => (
                <form key={r.id} action={repeatMealEntry} className="fd-item fd-recent">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="log_date" value={date} />
                  <input type="hidden" name="meal" value={meal} />
                  <div className="fd-item-info">
                    <b>{r.name}</b>
                    <span className="muted">{f1(r.grams)} г · {kc(r.kcal)} ккал</span>
                  </div>
                  <button className="sm primary" aria-label={`Добавить: ${r.name}`}>+</button>
                </form>
              ))}
            </div>
          )}
          {recent.length === 0 && prev.count === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>Набери название: появятся продукты с КБЖУ на 100 г</p>
          )}
        </>
      )}

      <button className="sm fd-manual" type="button" onClick={() => setManual(true)}>Ввести продукт вручную</button>
    </div>
  );
}

export function FoodDay({
  date,
  canEdit,
  entries,
  target = null,
  recent = [],
  prev = { date: "", counts: {} },
}: {
  date: string;
  canEdit: boolean;
  entries: MealEntryDTO[];
  target?: Target | null;
  recent?: RecentDTO[];
  prev?: { date: string; counts: Record<string, number> };
}) {
  const [addTo, setAddTo] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const prevTotal = Object.values(prev.counts).reduce((t, n) => t + n, 0);

  return (
    <div className="fd-day">
      <Summary entries={entries} target={target} />

      {canEdit && entries.length === 0 && prevTotal > 0 && (
        <form action={copyMeals} className="fd-copy fd-copy-day">
          <input type="hidden" name="from" value={prev.date} />
          <input type="hidden" name="log_date" value={date} />
          <input type="hidden" name="meal" value="" />
          <button type="submit">Скопировать вчерашний день ({prevTotal})</button>
        </form>
      )}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.key);
        const sub = list.reduce((t, e) => t + Number(e.kcal), 0);
        const open = addTo === m.key;
        if (!canEdit && list.length === 0) return null;
        return (
          <section key={m.key} className="card fd-mc">
            <div className="fd-mh">
              <div>
                <h4>{m.label}</h4>
                {list.length > 0 && <small className="muted">{Math.round(sub)} ккал</small>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className={open ? "sm" : "sm primary"}
                  aria-expanded={open}
                  onClick={() => { setAddTo(open ? null : m.key); setEditId(null); }}
                >
                  {open ? "Готово" : "+ Добавить"}
                </button>
              )}
            </div>

            {list.length === 0 && !open && <p className="muted fd-empty">Пока пусто</p>}

            {list.map((e) => (
              <div key={e.id} className="fd-entry">
                <div className="fd-e-main">
                  <span>{e.name}</span>
                  <small className="muted">{kc(e.kcal)} ккал · Б {f1(e.protein_g)} · Ж {f1(e.fat_g)} · У {f1(e.carbs_g)}</small>
                </div>
                {canEdit && editId === e.id ? (
                  <form
                    className="fd-e-edit"
                    action={async (fd) => { await updateMealEntry(fd); setEditId(null); }}
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="log_date" value={date} />
                    <input name="grams" type="number" inputMode="decimal" step="1" min={1} max={10000} defaultValue={e.grams} autoFocus aria-label="Граммов" />
                    <button className="sm primary" aria-label="Сохранить массу">OK</button>
                    <button type="button" className="sm" aria-label="Отмена" onClick={() => setEditId(null)}>✕</button>
                  </form>
                ) : canEdit ? (
                  <button type="button" className="fd-g" onClick={() => setEditId(e.id)} aria-label={`Изменить массу: ${e.name}`}>{f1(e.grams)} г</button>
                ) : (
                  <span className="fd-g static">{f1(e.grams)} г</span>
                )}
                {canEdit && editId !== e.id && (
                  <form action={deleteMealEntry} style={{ flexShrink: 0 }}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="log_date" value={date} />
                    <button className="sm danger" aria-label={`Удалить: ${e.name}`}>✕</button>
                  </form>
                )}
              </div>
            ))}

            {open && (
              <AddPanel date={date} meal={m.key} label={m.label} recent={recent} prev={{ date: prev.date, count: prev.counts[m.key] ?? 0 }} />
            )}
          </section>
        );
      })}
    </div>
  );
}
