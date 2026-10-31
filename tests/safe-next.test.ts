import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../src/lib/safe-next.ts";
import { MIN_PASSWORD, passwordError } from "../src/lib/password.ts";

test("safeNext пропускает только пути внутри сайта", () => {
  assert.equal(safeNext("/progress?ex=a"), "/progress?ex=a");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext(null, "/update-password"), "/update-password");
  assert.equal(safeNext("/a\nb"), "/");
});

test("пароль: короче минимума отклоняется", () => {
  assert.ok(passwordError("1234567"));
  assert.equal(passwordError("x".repeat(MIN_PASSWORD)), null);
  assert.ok(passwordError("x".repeat(73)));
});
