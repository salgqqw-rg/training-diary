"use client";

import { useEffect, useState } from "react";

const KEY = "consent-personal-data";

// Галочка «Согласен на обработку персональных данных».
// Выбор запоминается в браузере (localStorage); снять галочку = отозвать согласие.
export function ConsentCheck() {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setChecked(localStorage.getItem(KEY) !== null);
    } catch {
      /* хранилище недоступно — галочка просто не запомнится */
    }
    setReady(true);
  }, []);

  function toggle(v: boolean) {
    setChecked(v);
    try {
      if (v) localStorage.setItem(KEY, new Date().toISOString());
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  if (!ready) return null; // без мигания до чтения сохранённого значения

  return (
    <label className="consent">
      <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} />
      <span>
        Я согласен(на) с пользовательским соглашением и на обработку моих персональных данных
        <small>Данные тренировок, замеров и профиля используются только для работы дневника.</small>
      </span>
    </label>
  );
}
