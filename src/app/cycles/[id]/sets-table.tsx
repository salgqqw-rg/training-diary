"use client";

import { useState, useTransition } from "react";
import { addSet, deleteSet, updateSetsBulk } from "@/lib/actions";
import { startRest } from "@/components/rest-timer";

type Row = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rir: number | null;
  rir_max: number | null; // верхняя граница диапазона RIR
  rpe: number | null;
  rest: number | null; // отдых после подхода, сек
};

type Local = { id: string; weight: string; reps: string; rir: string; rpe: string; rest: string };

const fmtRir = (r: { rir: number | null; rir_max: number | null }) =>
  r.rir === null ? "" : r.rir_max === null ? String(r.rir) : `${r.rir}-${r.rir_max}`;

// Таблица подходов упражнения: строки редактируются на месте,
// одна кнопка «Сохранить» отправляет все изменения (строки остаются редактируемыми), ✕ удаляет строку
export function SetsTable({
  cycleId,
  exerciseId,
  rows,
  canEdit,
}: {
  cycleId: string;
  exerciseId: string;
  rows: Row[];
  canEdit: boolean;
}) {
  const [local, setLocal] = useState<Local[]>(
    rows.map((r) => ({
      id: r.id,
      weight: String(r.weight ?? ""),
      reps: String(r.reps ?? ""),
      rir: fmtRir(r),
      rpe: r.rpe === null || r.rpe === undefined ? "" : String(r.rpe),
      rest: r.rest === null || r.rest === undefined ? "" : String(r.rest),
    })),
  );
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  if (!canEdit) {
    return (
      <table>
        <thead>
          <tr><th>#</th><th>Вес</th><th>Повт.</th><th>RIR</th><th>RPE</th><th>Отдых, с</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.set_number}</td>
              <td>{r.weight}</td>
              <td>{r.reps}</td>
              <td>{fmtRir(r) || "—"}</td>
              <td>{r.rpe ?? "—"}</td>
              <td>{r.rest ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const upd = (id: string, key: keyof Local, v: string) => {
    setSaved(false);
    setLocal((cur) => cur.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  };

  const saveRows = async () => {
    const fd = new FormData();
    fd.set("cycle_id", cycleId);
    fd.set("rows", JSON.stringify(
      local.map((r, i) => ({
        id: r.id,
        set_number: i + 1,
        weight: parseFloat(r.weight.replace(",", ".")) || 0,
        reps: parseInt(r.reps, 10) || 0,
        rir: r.rir, // строка: число или диапазон «1-2», разбирает сервер
        rpe: r.rpe.trim() === "" || isNaN(parseFloat(r.rpe)) ? null : parseFloat(r.rpe.replace(",", ".")),
        rest: r.rest.trim() === "" || isNaN(parseInt(r.rest, 10)) ? null : parseInt(r.rest, 10),
      })),
    ));
    await updateSetsBulk(fd);
  };

  const save = () => start(async () => { await saveRows(); setSaved(true); });

  // «+ подход»: новая строка копирует вес и повторы последней; правки таблицы сохраняются первыми
  const add = () =>
    start(async () => {
      if (local.length) await saveRows();
      const last = local[local.length - 1];
      const fd = new FormData();
      fd.set("cycle_id", cycleId);
      fd.set("exercise_id", exerciseId);
      fd.set("weight", last ? last.weight.replace(",", ".") : "0");
      fd.set("reps", last ? last.reps : "8");
      if (last?.rest) fd.set("rest", last.rest);
      await addSet(fd);
      startRest(Number(last?.rest) || 0); // отдых перед новым подходом
    });

  const remove = (id: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("cycle_id", cycleId);
      await deleteSet(fd);
    });

  const cell = "set-in";

  return (
    <>
      <table>
        <thead>
          <tr><th>#</th><th>Вес</th><th>Повт.</th><th>RIR</th><th>RPE</th><th>Отдых, с</th><th></th></tr>
        </thead>
        <tbody>
          {local.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td>
              <td><input className={cell} type="number" step="0.5" min={0} value={r.weight} disabled={pending} onChange={(e) => upd(r.id, "weight", e.target.value)} aria-label={`Вес, подход ${i + 1}`} /></td>
              <td><input className={cell} type="number" step="1" min={0} value={r.reps} disabled={pending} onChange={(e) => upd(r.id, "reps", e.target.value)} aria-label={`Повт., подход ${i + 1}`} /></td>
              <td><input className={cell} type="text" maxLength={5} value={r.rir} disabled={pending} placeholder="1-2" onChange={(e) => upd(r.id, "rir", e.target.value)} aria-label={`RIR, подход ${i + 1}`} /></td>
              <td><input className={cell} type="number" step="0.5" min={1} max={10} value={r.rpe} disabled={pending} placeholder="—" onChange={(e) => upd(r.id, "rpe", e.target.value)} aria-label={`RPE, подход ${i + 1}`} /></td>
              <td><input className={cell} type="number" step="5" min={0} max={3600} value={r.rest} disabled={pending} placeholder="—" onChange={(e) => upd(r.id, "rest", e.target.value)} aria-label={`Отдых, сек, подход ${i + 1}`} /></td>
              <td>
                <button className="sm danger" disabled={pending} onClick={() => remove(r.id)} aria-label="Удалить подход">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="sm" disabled={pending} onClick={add}>+ подход</button>
        <button className="sm primary" disabled={pending || local.length === 0} onClick={save}>
          {pending ? "Сохраняю…" : saved ? "Сохранено ✓" : "Сохранить подходы"}
        </button>
      </div>
    </>
  );
}
