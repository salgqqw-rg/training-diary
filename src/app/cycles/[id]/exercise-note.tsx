"use client";

import { useState, useTransition } from "react";
import { saveExerciseNote } from "@/lib/actions";

// Свободные заметки к упражнению (вместо быстрого ввода подходов)
export function ExerciseNote({ cycleId, exerciseId, initial }: { cycleId: string; exerciseId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("cycle_id", cycleId);
      fd.set("id", exerciseId);
      fd.set("note", value);
      await saveExerciseNote(fd);
      setSaved(value.trim());
    });

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="fd-form" style={{ marginTop: 8 }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Заметки к упражнению"
        rows={2}
        maxLength={2000}
        disabled={pending}
        style={{ flex: 1, minWidth: 180, resize: "vertical" }}
        aria-label="Заметки к упражнению"
      />
      <button className="sm primary" disabled={pending || value.trim() === saved}>
        {pending ? "Сохраняю…" : "Сохранить"}
      </button>
    </form>
  );
}
