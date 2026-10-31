import { test } from "node:test";
import assert from "node:assert/strict";
import { dayInTz, isValidTz, shiftDay } from "../src/lib/dates.ts";

test("dayInTz: ночью в Новосибирске дата уже новая, в UTC — ещё вчерашняя", () => {
  const d = new Date("2026-10-30T20:30:00Z"); // 03:30 31 октября по UTC+7
  assert.equal(dayInTz(d, "Asia/Novosibirsk"), "2026-10-31");
  assert.equal(dayInTz(d, "UTC"), "2026-10-30");
});

test("dayInTz: неизвестный пояс не роняет, считается как UTC", () => {
  assert.equal(isValidTz("Mars/Olympus"), false);
  assert.equal(dayInTz(new Date("2026-01-01T12:00:00Z"), "Mars/Olympus"), "2026-01-01");
});

test("shiftDay: переходы через месяц и год", () => {
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDay("2026-01-01", -30), "2025-12-02");
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
});
