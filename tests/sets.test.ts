import { test } from "node:test";
import assert from "node:assert/strict";
import { clampReps, clampRest, clampRir, clampRpe, clampWeight, parseSeries } from "../src/lib/sets.ts";

test("clamp: отрицательные и мусорные значения не проходят", () => {
  assert.equal(clampWeight(-5), 0);
  assert.equal(clampWeight("abc"), 0);
  assert.equal(clampWeight("82,5"), 82.5);
  assert.equal(clampWeight(99999), 1000);
  assert.equal(clampReps(-3), 0);
  assert.equal(clampReps(8.6), 9);
  assert.equal(clampReps(5000), 100);
  assert.equal(clampRir(""), null);
  assert.equal(clampRir(15), 10);
  assert.equal(clampRir(2.6), 3); // в базе RIR — целое
  assert.equal(clampRpe(0), 1);
  assert.equal(clampRpe("8.5"), 8.5);
  assert.equal(clampRest(-1), 0);
  assert.equal(clampRest(99999), 3600);
  assert.equal(clampRest(null), null);
});

test("parseSeries: формат «вес x повторы @RIR»", () => {
  assert.deepEqual(parseSeries("80x8, 82.5x6 @2"), [
    { weight: 80, reps: 8, rir: null },
    { weight: 82.5, reps: 6, rir: 2 },
  ]);
  assert.deepEqual(parseSeries("100×5;102,5 X 3"), [
    { weight: 100, reps: 5, rir: null },
    { weight: 102.5, reps: 3, rir: null },
  ]);
  assert.deepEqual(parseSeries("мусор, 60x0, x5"), []);
  assert.equal(parseSeries("5000x5")[0].weight, 1000);
});
