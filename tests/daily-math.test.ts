import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleMeal, weekOf, activeOn, avgOf, recentFoods } from "../src/lib/daily-math.ts";

test("scaleMeal: граммы и КБЖУ меняются пропорционально", () => {
  const e = { name: "Творог", grams: 200, kcal: 180, protein_g: 36, fat_g: 10, carbs_g: 6 };
  assert.deepEqual(scaleMeal(e, 100), { name: "Творог", grams: 100, kcal: 90, protein_g: 18, fat_g: 5, carbs_g: 3 });
  assert.equal(scaleMeal(e, 150).kcal, 135);
});

test("weekOf: неделя с понедельника, воскресенье относится к своей неделе", () => {
  assert.deepEqual(weekOf("2026-11-09"), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.equal(weekOf("2026-11-15")[0], "2026-11-09");
  assert.equal(weekOf("2026-11-01")[0], "2026-10-26");
});

test("activeOn: открытые границы и обе даты включительно", () => {
  assert.equal(activeOn({}, "2026-11-09"), true);
  assert.equal(activeOn({ start_date: "2026-11-10" }, "2026-11-09"), false);
  assert.equal(activeOn({ end_date: "2026-11-09" }, "2026-11-09"), true);
  assert.equal(activeOn({ start_date: "2026-11-01", end_date: "2026-11-08" }, "2026-11-09"), false);
});

test("avgOf: пустые и нулевые дни не тянут среднее вниз", () => {
  assert.deepEqual(avgOf([2000, null, 0, 1000, undefined, "x"]), { avg: 1500, n: 2 });
  assert.deepEqual(avgOf([]), { avg: 0, n: 0 });
});

test("recentFoods: дубли по названию отбрасываются, лимит соблюдается", () => {
  const rows = [{ name: "Овсянка" }, { name: "овсянка " }, { name: "Яйцо" }, { name: "Кефир" }];
  assert.deepEqual(recentFoods(rows, 2).map((r) => r.name), ["Овсянка", "Яйцо"]);
});
