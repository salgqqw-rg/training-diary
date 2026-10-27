"use client";

import { useState, useTransition } from "react";
import { addSetsBulk } from "@/lib/actions";

// Кидают строку вида «80x8, 82.5x6 @2» — вес x повт [@RIR]
// Одна строка = сколько угодно подходов через запятую
export function QuickSets({ cycleId, exerciseId }: { cycleId: string; exerciseId: string }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  const parsedCount = value
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter((t) => /\d+\s*[xX×*]\s*\d{1,3}/.test(t)).length;

  const submit = () => {
    const series = value.trim();
    if (!series) return;
    start(async () => {
      const fd = new FormData();
      fd.set("cycle_id", cycleId);
      fd.set("exercise_id", exerciseId);
      fd.set("series", series);
      await addSetsBulk(fd);
      setValue("");
    });
  };

  return (
    <div className="quick-sets">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="fd-form"
        style={{ marginTop: 8 }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="80x8, 82.5x6 @2 — подходы через запятую"
          disabled={pending}
          style={{ flex: 1, minWidth: 180 }}
          aria-label="Подходы серией"
        />
        <button className="sm primary" disabled={pending || !value.trim()}>
          {pending ? "Пишу…" : `Записать${parsedCount > 0 ? ` (${parsedCount})` : ""}`}
        </button>
      </form>
    </div>
  );
}
