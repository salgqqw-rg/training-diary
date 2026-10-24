"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fatSecretFood } from "@/lib/fatsecret";

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
  let kcal100 = num(fd, "kcal100");
  let p100 = num(fd, "p100");
  let f100 = num(fd, "f100");
  let c100 = num(fd, "c100");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !MEALS.has(meal) || grams <= 0) return;
  if (!name && !ref) return;

  if (ref.startsWith("fs:")) {
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
