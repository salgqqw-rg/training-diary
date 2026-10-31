"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PRESETS = [60, 90, 120, 180];
const EVENT = "rest-start";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Запустить таймер отдыха из любого места страницы (0 — взять последнее значение) */
export function startRest(seconds = 0) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: seconds }));
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* звук необязателен */
  }
}

// Плавающий таймер отдыха между подходами. Считает по времени окончания, поэтому не отстаёт,
// когда экран гаснет или вкладка в фоне. По окончании — вибрация и короткий сигнал.
export function RestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const lastSec = useRef(90);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("rest-sec"));
      if (saved >= 10 && saved <= 3600) lastSec.current = saved;
    } catch { /* без памяти работаем со 90 с */ }
  }, []);

  const start = useCallback((sec: number) => {
    const s = sec > 0 ? Math.round(sec) : lastSec.current;
    lastSec.current = s;
    try { localStorage.setItem("rest-sec", String(s)); } catch { /* необязательно */ }
    setFinished(false);
    setOpen(false);
    setEndsAt(Date.now() + s * 1000);
    setLeft(s);
  }, []);

  useEffect(() => {
    const on = (e: Event) => start(Number((e as CustomEvent).detail) || 0);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [start]);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const rest = Math.ceil((endsAt - Date.now()) / 1000);
      if (rest > 0) { setLeft(rest); return; }
      setEndsAt(null);
      setFinished(true);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* не везде есть */ }
      beep();
      setTimeout(() => setFinished(false), 5000);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="rest-timer" role="timer" aria-label="Таймер отдыха">
      {endsAt !== null ? (
        <div className="rt-box">
          <b className="rt-time">{fmt(left)}</b>
          <button className="sm" onClick={() => setEndsAt((t) => (t ?? Date.now()) - 15000)} aria-label="Минус 15 секунд">−15</button>
          <button className="sm" onClick={() => setEndsAt((t) => (t ?? Date.now()) + 15000)} aria-label="Плюс 15 секунд">+15</button>
          <button className="sm danger" onClick={() => setEndsAt(null)}>Стоп</button>
        </div>
      ) : finished ? (
        <div className="rt-box done"><b>Отдых окончен — следующий подход</b></div>
      ) : open ? (
        <div className="rt-box">
          {PRESETS.map((p) => <button key={p} className="sm" onClick={() => start(p)}>{fmt(p)}</button>)}
          <button className="sm" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
        </div>
      ) : (
        <button className="rt-fab" onClick={() => setOpen(true)}>⏱ Отдых</button>
      )}
    </div>
  );
}
