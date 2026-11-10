"use client";

import { useState } from "react";
import { addSupplements } from "@/lib/daily-actions";

// Одна или несколько позиций: «+» добавляет строку, «✕» убирает. Каждая строка — свой тип, название, дозировка, даты.
export function SupplementForm() {
  const [ids, setIds] = useState([0]);
  const [next, setNext] = useState(1);

  return (
    <form action={addSupplements} className="stack">
      {ids.map((id) => (
        <div key={id} className="stack" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: ids.length > 1 ? "1px solid var(--line)" : undefined }}>
          <div className="row f-grid">
            <label className="span2">Тип
              <select name="kind" defaultValue="supplement" style={{ width: "100%" }}>
                <option value="supplement">Добавка</option>
                <option value="bac">БАД</option>
                <option value="course">Курс ААС</option>
              </select>
            </label>
            <label className="span2" style={{ flex: 2 }}>Название
              <input name="name" required maxLength={100} placeholder="Например: витамин D3" style={{ width: "100%" }} />
            </label>
            <label className="span2" style={{ flex: 2 }}>Дозировка
              <input name="dosage" maxLength={100} placeholder="Например: 5000 МЕ/день" style={{ width: "100%" }} />
            </label>
          </div>
          <div className="row f-grid">
            <label>Начало<input name="start_date" type="date" /></label>
            <label>Окончание<input name="end_date" type="date" /></label>
            <label className="span2" style={{ flex: 1 }}>Заметка
              <input name="note" maxLength={300} placeholder="Необязательно" style={{ width: "100%" }} />
            </label>
            {ids.length > 1 && (
              <button type="button" className="sm danger" style={{ alignSelf: "flex-end" }} aria-label="Убрать строку"
                onClick={() => setIds(ids.filter((i) => i !== id))}>✕</button>
            )}
          </div>
        </div>
      ))}
      <div className="row">
        <button type="button" onClick={() => { setIds([...ids, next]); setNext(next + 1); }}>+ Ещё</button>
        <button className="primary">{ids.length > 1 ? `Добавить все (${ids.length})` : "Добавить"}</button>
      </div>
    </form>
  );
}
