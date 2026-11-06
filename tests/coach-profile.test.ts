import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoachProfile } from "../src/lib/coach-profile.ts";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

test("parseCoachProfile: ограничивает стаж, формат и длину, галочка «в каталоге»", () => {
  const p = parseCoachProfile(form({
    about: "  Тренирую 10 лет  ", specialties: "  силовые   и \n похудение ", experience_years: "99",
    format: "toString", price: "x".repeat(300), city: "  Санкт-Петербург ", listed: "on",
  }));
  assert.equal(p.about, "Тренирую 10 лет");
  assert.equal(p.specialties, "силовые и похудение");
  assert.equal(p.experience_years, 60);
  assert.equal(p.format, "both");
  assert.equal(p.price.length, 100);
  assert.equal(p.city, "Санкт-Петербург");
  assert.equal(p.listed, true);

  const empty = parseCoachProfile(form({ experience_years: "", format: "online" }));
  assert.equal(empty.experience_years, null);
  assert.equal(empty.format, "online");
  assert.equal(empty.listed, false);
  assert.equal(parseCoachProfile(form({ experience_years: "-5" })).experience_years, 0);
});
