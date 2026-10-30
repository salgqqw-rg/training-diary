// Проверка формулы: node --experimental-strip-types scripts/check-nutrition.mjs
import assert from "node:assert/strict";
import { calcPlan } from "../src/lib/nutrition.ts";

const now = new Date("2026-10-29T00:00:00Z");
const base = { sex: "male", birthDate: "1996-10-29", heightCm: 180, weightKg: 80, goalWeightKg: 80, activity: "moderate" };

// 30 лет, 80 кг, 180 см: BMR = 800 + 1125 - 150 + 5 = 1780; TDEE = 1780 * 1.55 = 2759
const keep = calcPlan({ ...base, goal: "maintain", paceKgWeek: 0 }, now);
assert.ok(keep.ok);
assert.equal(keep.age, 30); assert.equal(keep.bmr, 1780); assert.equal(keep.tdee, 2759); assert.equal(keep.kcal, 2759);

// сброс 0.5 кг/нед = -550 ккал/день, 10 кг -> 20 недель
const cut = calcPlan({ ...base, goal: "lose", goalWeightKg: 70, paceKgWeek: 0.5 }, now);
assert.ok(cut.ok); assert.equal(cut.kcal, 2209); assert.equal(cut.weeks, 20); assert.equal(cut.protein_g, 160);

// набор +0.25 кг/нед = +275 ккал/день
const bulk = calcPlan({ ...base, goal: "gain", goalWeightKg: 85, paceKgWeek: 0.25 }, now);
assert.ok(bulk.ok); assert.equal(bulk.kcal, 3034);

// безопасный минимум для женщины
const low = calcPlan({ sex: "female", birthDate: "1996-10-29", heightCm: 155, weightKg: 50, goalWeightKg: 45, activity: "sedentary", goal: "lose", paceKgWeek: 1 }, now);
assert.ok(low.ok); assert.equal(low.kcal, 1200); assert.equal(low.clamped, true);

// ошибки ввода
assert.equal(calcPlan({ ...base, goal: "lose", goalWeightKg: 90, paceKgWeek: 0.5 }, now).ok, false);
assert.equal(calcPlan({ ...base, goal: "lose", goalWeightKg: 70, paceKgWeek: 0.6 }, now).ok, false);
assert.equal(calcPlan({ ...base, birthDate: "2015-01-01", goal: "maintain", paceKgWeek: 0 }, now).ok, false);
console.log("nutrition: ok");
