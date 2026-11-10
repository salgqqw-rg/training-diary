import { test } from "node:test";
import assert from "node:assert/strict";
import { dayInTz, isValidTz, shiftDay, streakOf } from "../src/lib/dates.ts";

test("streakOf: считает дни подряд до сегодня включительно", () => {
  assert.deepEqual(streakOf(["2026-11-10", "2026-11-09", "2026-11-08"], "2026-11-10"), { count: 3, doneToday: true });
});

test("streakOf: сегодня без записи серию не рвёт, но и не растит", () => {
  assert.deepEqual(streakOf(["2026-11-09", "2026-11-08"], "2026-11-10"), { count: 2, doneToday: false });
});

test("streakOf: пропущенный вчерашний день обнуляет серию, дубли и будущие даты не мешают", () => {
  assert.deepEqual(streakOf(["2026-11-08"], "2026-11-10"), { count: 0, doneToday: false });
  assert.deepEqual(streakOf(["2026-11-10", "2026-11-10", "2026-11-12", "2026-11-08"], "2026-11-10"), { count: 1, doneToday: true });
  assert.deepEqual(streakOf([], "2026-11-10"), { count: 0, doneToday: false });
});

test("streakOf: серия идёт через границу месяца и года", () => {
  assert.equal(streakOf(["2027-01-01", "2026-12-31", "2026-12-30"], "2027-01-01").count, 3);
});

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
