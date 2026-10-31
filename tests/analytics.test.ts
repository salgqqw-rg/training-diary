import { test } from "node:test";
import assert from "node:assert/strict";
import { bestByExercise, buildStats, estimate1RM, newRecords, seriesByDate, weekStart, weeklyVolume } from "../src/lib/analytics.ts";

const s = (name: string, weight: number, reps: number, date: string, rir: number | null = null) => ({ name, weight, reps, rir, date });

test("estimate1RM: формула Эпли с поправкой на RIR", () => {
  assert.equal(estimate1RM(100, 1, 0), 100 * (1 + 1 / 30));
  assert.ok(estimate1RM(100, 5, 2) > estimate1RM(100, 5, null));
});

test("seriesByDate: вес — максимум за дату, объём — сумма", () => {
  const sets = [s("Жим лёжа", 80, 8, "2026-10-01"), s("жим лежа", 85, 5, "2026-10-01"), s("Жим лёжа", 90, 3, "2026-10-08"), s("Присед", 100, 5, "2026-10-01")];
  assert.deepEqual(seriesByDate(sets, "Жим лежа", "weight"), [
    { date: "2026-10-01", value: 85 }, { date: "2026-10-08", value: 90 },
  ]);
  assert.equal(seriesByDate(sets, "Жим лежа", "volume")[0].value, 80 * 8 + 85 * 5);
  assert.deepEqual(seriesByDate([s("X", 0, 5, "2026-10-01")], "X", "weight"), []);
});

test("bestByExercise: упражнения не смешиваются, свежие сверху", () => {
  const res = bestByExercise([s("Присед", 140, 5, "2026-09-01"), s("Жим", 100, 5, "2026-10-20"), s("Жим", 105, 3, "2026-10-27")]);
  assert.deepEqual(res.map((r) => r.name), ["Жим", "Присед"]);
  assert.equal(res[0].weight, 105);
  assert.equal(res[0].weightReps, 3);
});

test("newRecords: только там, где раньше уже были подходы и результат вырос", () => {
  const sets = [
    s("Жим", 100, 5, "2026-08-01"), s("Жим", 110, 5, "2026-10-20"),
    s("Тяга", 120, 5, "2026-10-20"),                     // раньше не делал — не «рекорд»
    s("Присед", 140, 5, "2026-08-01"), s("Присед", 130, 5, "2026-10-20"), // стал слабее
  ];
  const r = newRecords(sets, "2026-10-01");
  assert.deepEqual(r.map((x) => x.name), ["Жим"]);
});

test("weekStart / weeklyVolume: недели с понедельника, пустые недели заполняются нулями", () => {
  assert.equal(weekStart("2026-10-31"), "2026-10-26"); // суббота
  assert.equal(weekStart("2026-10-26"), "2026-10-26");
  const v = weeklyVolume([{ weight: 100, reps: 5, date: "2026-10-27" }, { weight: 50, reps: 10, date: "2026-10-12" }], "2026-10-31", 3);
  assert.deepEqual(v.map((x) => x.week), ["2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(v.map((x) => x.volume), [500, 0, 500]);
});

test("buildStats: прирост по неделям цикла", () => {
  const st = buildStats([
    { exercise: "Жим", week: 1, weight: 100, reps: 5, rir: null },
    { exercise: "жим", week: 3, weight: 110, reps: 5, rir: 1 },
  ]);
  assert.equal(st.length, 1);
  assert.equal(Math.round(st[0].progressPct ?? 0), 10);
});
