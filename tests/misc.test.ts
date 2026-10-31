import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../src/lib/csv.ts";
import { groupFor, keywordGroup } from "../src/lib/muscle-groups.ts";
import { fetchAll } from "../src/lib/fetch-all.ts";

test("csv: экранирование, десятичная запятая, защита от формул", () => {
  assert.equal(csvCell(82.5), "82,5");
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('он сказал "да"'), '"он сказал ""да"""');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(-5), "-5"); // число не трогаем
  assert.equal(csvCell(null), "");
  assert.ok(toCsv(["a", "b"], [[1, "x"]]).startsWith("﻿a;b\r\n1;x\r\n"));
});

test("muscle-groups: каталог важнее слов в названии", () => {
  const cat = new Map([["жим узким хватом", "triceps"]]);
  assert.equal(groupFor("Жим узким хватом", cat), "Руки"); // по словам было бы «Грудь»
  assert.equal(groupFor("Присед со штангой", new Map()), "Ноги");
  assert.equal(keywordGroup("что-то непонятное"), "Прочее");
});

test("fetchAll: читает все страницы, а не первую тысячу", async () => {
  const all = Array.from({ length: 2500 }, (_, i) => i);
  const calls: number[] = [];
  const res = await fetchAll<number>(async (from, to) => { calls.push(from); return { data: all.slice(from, to + 1), error: null }; });
  assert.equal(res.length, 2500);
  assert.deepEqual(calls, [0, 1000, 2000]);
  await assert.rejects(fetchAll(async () => ({ data: null, error: { message: "boom" } })), /boom/);
});

import { pickPrevious } from "../src/lib/previous.ts";

test("pickPrevious: берёт свежую прошлую тренировку, игнорирует текущую и будущие", () => {
  const row = (workoutId: string, date: string | null, createdAt: string, w: number) => ({
    name: "Жим", workoutId, date, createdAt,
    sets: [{ weight: w, reps: 8, setNumber: 2 }, { weight: w - 5, reps: 8, setNumber: 1 }],
  });
  const rows = [
    row("old", "2026-10-01", "2026-10-01T10:00:00Z", 70),
    row("prev", "2026-10-15", "2026-10-15T10:00:00Z", 80),
    row("cur", "2026-10-20", "2026-10-20T10:00:00Z", 90),
    row("future", "2026-10-30", "2026-10-30T10:00:00Z", 100),
  ];
  const p = pickPrevious(rows, "cur", "2026-10-20").get("жим");
  assert.equal(p?.date, "2026-10-15");
  assert.deepEqual(p?.sets, [{ weight: 75, reps: 8 }, { weight: 80, reps: 8 }]); // по номеру подхода
  assert.equal(pickPrevious([row("a", "2026-10-01", "2026-10-01T00:00:00Z", 0)], "cur", null).size, 0); // подходов с весом нет
});
