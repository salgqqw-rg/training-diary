"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MUSCLES, MUSCLE_KEYS, KINDS, norm, type Muscle } from "@/lib/exercise-meta";
import { ExerciseForm } from "./exercise-form";

export type LibItem = {
  key: string; // slug или uuid
  name: string;
  muscle: Muscle;
  kind: "base" | "isolation";
  equip: string;
  thumb: string | null;
  custom: boolean;
  record: string | null; // «рекорд 100 кг × 5»
};

export function Library({ items }: { items: LibItem[] }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all" | "mine">("all");
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const n = norm(q);
    return items.filter((i) => {
      if (muscle === "mine" ? !(i.custom || i.record) : muscle !== "all" && i.muscle !== muscle) return false;
      return !n || norm(`${i.name} ${MUSCLES[i.muscle]} ${i.equip}`).includes(n);
    });
  }, [items, q, muscle]);

  return (
    <>
      <div className="lib-bar">
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Найти упражнение: жим, присед, бицепс…" aria-label="Поиск упражнения"
        />
        <button className="primary" type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? "Закрыть" : "+ Своё упражнение"}
        </button>
      </div>

      {creating && (
        <section className="card">
          <h2>Новое упражнение</h2>
          <ExerciseForm
            key={q}
            submitText="Добавить в библиотеку"
            defaults={{ key: "", name: q.trim(), muscle: muscle !== "all" && muscle !== "mine" ? muscle : "chest", kind: "base", equipment: "", description: "", image_url: "", video_url: "" }}
          />
        </section>
      )}

      <div className="lib-chips" role="group" aria-label="Группа мышц">
        {([["all", "Все"], ["mine", "Мои"], ...MUSCLE_KEYS.map((m) => [m, MUSCLES[m]])] as [string, string][]).map(([k, label]) => (
          <button key={k} type="button" className={`lib-chip${muscle === k ? " on" : ""}`} aria-pressed={muscle === k} onClick={() => setMuscle(k as Muscle)}>{label}</button>
        ))}
      </div>

      <p className="muted lib-count">{list.length} из {items.length}</p>

      {list.length === 0 ? (
        <div className="card lib-empty">
          <p>Ничего не нашлось{q.trim() && <> по запросу «{q.trim()}»</>}.</p>
          <button type="button" className="primary" onClick={() => setCreating(true)}>
            {q.trim() ? `Создать «${q.trim()}»` : "Добавить своё упражнение"}
          </button>
        </div>
      ) : (
        <div className="lib-grid">
          {list.map((i) => (
            <Link key={i.key} href={`/exercises/${i.key}`} className="lib-card">
              <span className="lib-img">
                {i.thumb ? <img src={i.thumb} alt="" loading="lazy" /> : <span className="lib-ph">{MUSCLES[i.muscle]}</span>}
              </span>
              <b>{i.name}</b>
              <span className="muted lib-meta">
                {MUSCLES[i.muscle]} · {KINDS[i.kind]}{i.equip && ` · ${i.equip}`}
              </span>
              {i.custom && <span className="lib-tag">Своё</span>}
              {i.record && <span className="lib-rec">{i.record}</span>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
