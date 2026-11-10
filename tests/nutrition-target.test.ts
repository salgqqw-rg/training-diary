import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManualTarget } from "../src/lib/nutrition.ts";

const t = (kcal: string, protein = "", fat = "", carbs = "") => parseManualTarget({ kcal, protein, fat, carbs });

test("parseManualTarget: калории и БЖУ вводятся как есть", () => {
  assert.deepEqual(t("2100", "150", "70", "230"), { ok: true, kcal: 2100, protein_g: 150, fat_g: 70, carbs_g: 230 });
});

test("parseManualTarget: без калорий они считаются из БЖУ (Б×4 + Ж×9 + У×4)", () => {
  assert.deepEqual(t("", "150", "70", "230"), { ok: true, kcal: 2150, protein_g: 150, fat_g: 70, carbs_g: 230 });
});

test("parseManualTarget: только калории — без БЖУ", () => {
  assert.deepEqual(t("1800"), { ok: true, kcal: 1800, protein_g: null, fat_g: null, carbs_g: null });
});

test("parseManualTarget: ошибки ввода", () => {
  assert.equal(t("").ok, false);                      // ничего не указано
  assert.equal(t("2000", "150", "", "230").ok, false); // БЖУ не полностью
  assert.equal(t("2000", "150.5", "70", "230").ok, false);
  assert.equal(t("2000", "1000", "70", "230").ok, false);
  assert.equal(t("2000.5").ok, false);
  assert.equal(t("300").ok, false);
  assert.equal(t("12000").ok, false);
  assert.equal(t("abc").ok, false);
});
