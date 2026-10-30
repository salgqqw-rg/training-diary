#!/usr/bin/env node
// Импорт продуктов Open Food Facts в таблицу food_catalog (Supabase).
//
// Запуск из папки training-diary-app:
//   node scripts/import-openfoodfacts.mjs                  — скачает и обработает потоком
//   node scripts/import-openfoodfacts.mjs C:\path\openfoodfacts-products.jsonl.gz   — из уже скачанного файла
//   node scripts/import-openfoodfacts.mjs --dry-run        — ничего не писать, только посчитать
//
// Нужно в .env.local: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.
// Страны задаются переменной OFF_COUNTRIES (через запятую), по умолчанию russia,belarus,kazakhstan.
// Источник и лицензия: Open Food Facts, ODbL 1.0 — на сайте должна быть ссылка на источник.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { Readable } from "node:stream";

const URL_DUMP = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";
const BATCH = 500;

// ---------- настройки ----------
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.find((a) => !a.startsWith("--"));
const countries = new Set(
  (process.env.OFF_COUNTRIES ?? "russia,belarus,kazakhstan")
    .split(",")
    .map((s) => `en:${s.trim().toLowerCase()}`)
    .filter((s) => s !== "en:"),
);

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dryRun && (!sbUrl || !sbKey)) {
  console.error("В .env.local нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = dryRun
  ? null
  : (await import("@supabase/supabase-js")).createClient(sbUrl, sbKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- разбор одной записи ----------
const r1 = (n) => Math.round(n * 10) / 10;
const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function toRow(p) {
  if (!p || !p.code) return null;
  const tags = Array.isArray(p.countries_tags) ? p.countries_tags : [];
  if (!tags.some((t) => countries.has(t))) return null;

  // Название: русское, иначе обычное. Для продуктов из России берём и латиницу тоже.
  const name = clean(p.product_name_ru) || clean(p.product_name);
  if (!name || name.length > 200) return null;

  const n = p.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]); // energy_100g в OFF — кДж
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = num(n["proteins_100g"]);
  const fat = num(n["fat_100g"]);
  const carbs = num(n["carbohydrates_100g"]);
  if (kcal === null || protein === null || fat === null || carbs === null) return null;

  // отсев явного мусора
  if (kcal < 0 || kcal > 900) return null;
  if (protein < 0 || fat < 0 || carbs < 0) return null;
  if (protein > 100 || fat > 100 || carbs > 100) return null;
  if (protein + fat + carbs > 105) return null;
  // ккал должны хотя бы грубо сходиться с БЖУ (4/9/4), иначе в базе опечатка
  const calc = protein * 4 + fat * 9 + carbs * 4;
  if (kcal > 0 && (calc > kcal * 1.6 + 30 || calc < kcal * 0.4 - 30)) return null;

  const brand = clean(String(p.brands ?? "").split(",")[0]) || null;
  return {
    code: String(p.code),
    name,
    brand,
    kcal: r1(kcal),
    protein_g: r1(protein),
    fat_g: r1(fat),
    carbs_g: r1(carbs),
    search: `${name} ${brand ?? ""}`.toLowerCase().trim(),
  };
}

// ---------- ввод: файл или скачивание потоком ----------
async function openStream() {
  if (fileArg) {
    console.log(`Читаю файл: ${fileArg}`);
    const raw = fs.createReadStream(fileArg);
    return fileArg.endsWith(".gz") ? raw.pipe(zlib.createGunzip()) : raw;
  }
  console.log(`Скачиваю ${URL_DUMP} (потоком, файл целиком на диск не сохраняется)`);
  const res = await fetch(URL_DUMP);
  if (!res.ok || !res.body) throw new Error(`Не удалось скачать: HTTP ${res.status}`);
  return Readable.fromWeb(res.body).pipe(zlib.createGunzip());
}

async function flush(rows) {
  if (!rows.length || dryRun) return;
  // одинаковые code внутри пачки не допускаются в upsert
  const uniq = [...new Map(rows.map((r) => [r.code, r])).values()];
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { error } = await supabase.from("food_catalog").upsert(uniq, { onConflict: "code" });
    if (!error) return;
    console.warn(`Пачка не записалась (попытка ${attempt}): ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw new Error("Не удалось записать пачку после 4 попыток — остановка.");
}

async function main() {
  console.log(`Страны: ${[...countries].join(", ")}${dryRun ? " · режим --dry-run" : ""}`);
  const rl = readline.createInterface({ input: await openStream(), crlfDelay: Infinity });

  let seen = 0, kept = 0, bad = 0, buf = [];
  const started = Date.now();
  for await (const line of rl) {
    if (!line) continue;
    seen++;
    if (seen % 200000 === 0) {
      const min = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`…просмотрено ${seen.toLocaleString("ru")}, подошло ${kept.toLocaleString("ru")} (${min} мин)`);
    }
    // дёшево отсекаем лишнее до JSON.parse
    let any = false;
    for (const c of countries) if (line.includes(`"${c}"`)) { any = true; break; }
    if (!any) continue;
    let p;
    try { p = JSON.parse(line); } catch { bad++; continue; }
    const row = toRow(p);
    if (!row) continue;
    kept++;
    buf.push(row);
    if (buf.length >= BATCH) { await flush(buf); buf = []; }
  }
  await flush(buf);

  console.log(`\nГотово. Просмотрено: ${seen.toLocaleString("ru")}, ${dryRun ? "подошло" : "загружено"}: ${kept.toLocaleString("ru")}, битых строк: ${bad}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
