"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fatSecretFood } from "@/lib/fatsecret";
import { scaleMeal } from "@/lib/daily-math";

const MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim().replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Пересчитываем КБЖУ дня из приёмов пищи и складываем в daily_logs
async function syncDayLog(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, date: string) {
  const { data: rows } = await supabase
    .from("meal_entries")
    .select("kcal, protein_g, fat_g, carbs_g")
    .eq("user_id", userId)
    .eq("log_date", date);
  const sum = (k: "kcal" | "protein_g" | "fat_g" | "carbs_g") =>
    r1((rows ?? []).reduce((t, r) => t + Number(r[k] ?? 0), 0));
  await supabase.from("daily_logs").upsert(
    {
      user_id: userId,
      log_date: date,
      kcal: sum("kcal"),
      protein_g: sum("protein_g"),
      fat_g: sum("fat_g"),
      carbs_g: sum("carbs_g"),
    },
    { onConflict: "user_id,log_date" },
  );
}

// Добавить продукт в приём пищи.
// food_ref: "fs:<id>" — из базы FatSecret, "uf:<id>" — свой продукт, "" — ручной ввод
export async function addMealEntry(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  const meal = String(fd.get("meal") ?? "");
  const grams = num(fd, "grams");
  const ref = String(fd.get("food_ref") ?? "").trim();
  let name = String(fd.get("name") ?? "").trim().slice(0, 150);
  const brand = String(fd.get("brand") ?? "").trim().slice(0, 50);
  let kcal100 = num(fd, "kcal100");
  let p100 = num(fd, "p100");
  let f100 = num(fd, "f100");
  let c100 = num(fd, "c100");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !MEALS.has(meal) || grams <= 0) return;
  if (!name && !ref) return;

  if (ref.startsWith("of:")) {
    // Каталог Open Food Facts в нашей базе (таблица food_catalog)
    const { data: cf } = await supabase
      .from("food_catalog")
      .select("name, brand, kcal, protein_g, fat_g, carbs_g")
      .eq("code", ref.slice(3))
      .maybeSingle();
    if (!cf) return;
    if (!name) name = cf.brand ? `${cf.name} · ${cf.brand}` : cf.name;
    kcal100 = Number(cf.kcal);
    p100 = Number(cf.protein_g);
    f100 = Number(cf.fat_g);
    c100 = Number(cf.carbs_g);
  } else if (ref.startsWith("fs:")) {
    const f = await fatSecretFood(ref.slice(3));
    if (!f) return;
    if (!name) name = f.name;
    kcal100 = f.kcal100;
    p100 = f.p100;
    f100 = f.f100;
    c100 = f.c100;
  } else if (ref.startsWith("uf:")) {
    // Продукт может быть добавлен любым пользователем — фильтр по user_id не ставим (RLS: чтение всей библиотеки)
    const { data: uf } = await supabase
      .from("user_foods")
      .select("name, kcal, protein_g, fat_g, carbs_g")
      .eq("id", ref.slice(3))
      .maybeSingle();
    if (!uf) return;
    if (!name) name = uf.name;
    kcal100 = Number(uf.kcal);
    p100 = Number(uf.protein_g);
    f100 = Number(uf.fat_g);
    c100 = Number(uf.carbs_g);
  }
  if (!name) return;

  if (!ref) {
    // Ручной ввод: значения могли быть на порцию — приводим к 100 г, в базе всё хранится на 100 г
    if (String(fd.get("per")) === "serving") {
      const serving = num(fd, "serving");
      if (serving <= 0) return;
      const m = 100 / serving;
      kcal100 *= m; p100 *= m; f100 *= m; c100 *= m;
    }
    if (brand) name = `${name} · ${brand}`.slice(0, 150);
  }

  const k = grams / 100;
  await supabase.from("meal_entries").insert({
    user_id: user.id,
    log_date: date,
    meal,
    name: name.slice(0, 150),
    grams: r1(grams),
    kcal: r1(kcal100 * k),
    protein_g: r1(p100 * k),
    fat_g: r1(f100 * k),
    carbs_g: r1(c100 * k),
  });

  // Галочка «сохранить в общую библиотеку» — значения на 100 г.
  // Дубликатов в библиотеке не создаём: если продукт с таким названием уже есть у кого-то — переиспользуем его
  if (String(fd.get("save_custom")) === "1" && name.length <= 100) {
    const libName = name.slice(0, 100);
    const { data: existing } = await supabase
      .from("user_foods")
      .select("id")
      .ilike("name", libName)
      .limit(1);
    if (!existing?.length) {
      await supabase.from("user_foods").upsert(
        { user_id: user.id, name: libName, kcal: r1(kcal100), protein_g: r1(p100), fat_g: r1(f100), carbs_g: r1(c100) },
        { onConflict: "user_id,name" },
      );
    }
  }

  await syncDayLog(supabase, user.id, date);
  revalidatePath("/daily");
}

export async function deleteMealEntry(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  await supabase
    .from("meal_entries")
    .delete()
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) await syncDayLog(supabase, user.id, date);
  revalidatePath("/daily");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_COLS = "meal, name, grams, kcal, protein_g, fat_g, carbs_g";

// Изменить массу уже добавленного продукта: КБЖУ пересчитываются пропорционально
export async function updateMealEntry(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  const grams = num(fd, "grams");
  if (!DATE.test(date) || grams <= 0 || grams > 10000) return;
  const { data: e } = await supabase
    .from("meal_entries")
    .select("grams, kcal, protein_g, fat_g, carbs_g")
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id)
    .maybeSingle();
  if (!e) return;
  const n = scaleMeal({ grams: Number(e.grams), kcal: Number(e.kcal), protein_g: Number(e.protein_g), fat_g: Number(e.fat_g), carbs_g: Number(e.carbs_g) }, grams);
  await supabase.from("meal_entries").update(n).eq("id", String(fd.get("id"))).eq("user_id", user.id);
  await syncDayLog(supabase, user.id, date);
  revalidatePath("/daily");
}

// Повторить продукт из недавних: та же запись, тот же вес, выбранные день и приём
export async function repeatMealEntry(fd: FormData) {
  const { supabase, user } = await requireUser();
  const date = String(fd.get("log_date") ?? "").trim();
  const meal = String(fd.get("meal") ?? "");
  if (!DATE.test(date) || !MEALS.has(meal)) return;
  const { data: e } = await supabase
    .from("meal_entries")
    .select(ENTRY_COLS)
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id)
    .maybeSingle();
  if (!e) return;
  await supabase.from("meal_entries").insert({ ...e, user_id: user.id, log_date: date, meal });
  await syncDayLog(supabase, user.id, date);
  revalidatePath("/daily");
}

// Скопировать приём пищи (или весь день, если meal пустой) с другой даты
// shortcut: до 100 записей за раз; повторное нажатие создаст дубли, защиты нет
export async function copyMeals(fd: FormData) {
  const { supabase, user } = await requireUser();
  const from = String(fd.get("from") ?? "").trim();
  const to = String(fd.get("log_date") ?? "").trim();
  const meal = String(fd.get("meal") ?? "");
  if (!DATE.test(from) || !DATE.test(to) || from === to || (meal && !MEALS.has(meal))) return;
  let q = supabase.from("meal_entries").select(ENTRY_COLS).eq("user_id", user.id).eq("log_date", from);
  if (meal) q = q.eq("meal", meal);
  const { data: rows } = await q.order("created_at").limit(100);
  if (!rows?.length) return;
  await supabase.from("meal_entries").insert(rows.map((r) => ({ ...r, user_id: user.id, log_date: to })));
  await syncDayLog(supabase, user.id, to);
  revalidatePath("/daily");
}
