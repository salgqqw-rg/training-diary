#!/usr/bin/env node
// Переносит ключи из .env.local в Vercel (Production). Значения нигде не печатаются.
// Запускается из deploy.bat; нужен вход в Vercel (npx vercel login) и папка, привязанная к проекту (.vercel).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FATSECRET_CLIENT_ID",
  "FATSECRET_CLIENT_SECRET",
];

const file = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(file)) {
  console.error("Не найден .env.local в папке проекта.");
  process.exit(1);
}
const env = {};
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

let failed = false;
for (const key of KEYS) {
  if (!env[key]) {
    console.log(`пропуск ${key}: нет в .env.local`);
    continue;
  }
  // значение уходит в stdin команды, --force перезаписывает уже существующую переменную
  const r = spawnSync("npx", ["--yes", "vercel", "env", "add", key, "production", "--force"], {
    input: env[key], shell: true, encoding: "utf8",
  });
  const out = String(r.stderr || r.stdout);
  if (r.status === 0) console.log(`ok ${key}`);
  else if (/already exists/i.test(out)) console.log(`уже есть в Vercel, оставляю: ${key}`);
  else { failed = true; console.error(`ОШИБКА ${key}: ${String(r.stderr || r.stdout).trim().slice(0, 300)}`); }
}
process.exit(failed ? 1 : 0);
