import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { loadUserSets } from "@/lib/user-sets";
import { toCsv } from "@/lib/csv";

// Выгрузка своих данных в CSV (открывается в Excel): ?type=sets | measurements | daily
const MEASURE_COLS = ["weight", "height", "bicep_l", "bicep_r", "shoulders", "chest", "waist", "thigh_l", "thigh_r", "calf_l", "calf_r"];
const DAILY_COLS = ["sleep_h", "steps", "kcal", "protein_g", "fat_g", "carbs_g", "note"];

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return new Response("Нужен вход", { status: 401 });

  const supabase = await createClient();
  const type = new URL(request.url).searchParams.get("type") ?? "sets";
  let name: string;
  let csv: string;

  if (type === "sets") {
    const sets = (await loadUserSets(supabase, user.id)).sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.cycleName.localeCompare(b.cycleName) ||
        String(a.workoutId).localeCompare(String(b.workoutId)) || a.name.localeCompare(b.name) || a.setNumber - b.setNumber,
    );
    name = "trainings";
    csv = toCsv(
      ["Дата", "Цикл", "Неделя", "Тренировка", "Упражнение", "Подход", "Вес, кг", "Повторы", "RIR", "RPE", "Отдых, с"],
      sets.map((s) => [s.date, s.cycleName, s.week, s.workoutNote, s.name, s.setNumber, s.weight, s.reps, s.rir, s.rpe, s.rest]),
    );
  } else if (type === "measurements") {
    const rows = await fetchAll<Record<string, unknown>>((from, to) =>
      supabase.from("measurements").select("*").eq("user_id", user.id).order("id").range(from, to));
    rows.sort((a, b) => String(a.measured_on ?? a.month).localeCompare(String(b.measured_on ?? b.month)));
    name = "measurements";
    csv = toCsv(
      ["Дата", "Вес, кг", "Рост, см", "Бицепс л., см", "Бицепс пр., см", "Плечи, см", "Грудь, см", "Талия, см", "Бедро л., см", "Бедро пр., см", "Икра л., см", "Икра пр., см"],
      rows.map((r) => [String(r.measured_on ?? r.month ?? "").slice(0, 10), ...MEASURE_COLS.map((c) => r[c])]),
    );
  } else if (type === "daily") {
    const rows = await fetchAll<Record<string, unknown>>((from, to) =>
      supabase.from("daily_logs").select("*").eq("user_id", user.id).order("id").range(from, to));
    rows.sort((a, b) => String(a.log_date).localeCompare(String(b.log_date)));
    name = "nutrition-sleep";
    csv = toCsv(
      ["Дата", "Сон, ч", "Шаги", "Ккал", "Белки, г", "Жиры, г", "Углеводы, г", "Заметка"],
      rows.map((r) => [r.log_date, ...DAILY_COLS.map((c) => r[c])]),
    );
  } else {
    return new Response("Неизвестный тип выгрузки", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solo-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
