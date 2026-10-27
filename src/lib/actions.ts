"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === null || String(v).trim() === "" ? null : Number(v);
};

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Права проверяет база (RLS), здесь только базовая валидация
export async function createCycle(fd: FormData) {
  const { supabase, user } = await requireUser();
  const name = str(fd, "name");
  const weeks = num(fd, "weeks");
  if (!name || !weeks || weeks < 1 || weeks > 52) return;
  await supabase.from("cycles").insert({ user_id: user.id, name, weeks_count: weeks });
  revalidatePath("/diary");
}

export async function deleteCycle(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("cycles").delete().eq("id", str(fd, "id"));
  revalidatePath("/diary");
}

export async function togglePublic(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const current = str(fd, "is_public") === "true";
  await supabase.from("cycles").update({ is_public: !current }).eq("id", id);
  revalidatePath("/diary");
  revalidatePath("/feed");
  revalidatePath(`/cycles/${id}`);
}

export async function addWorkout(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  await supabase.from("workouts").insert({
    cycle_id: cycleId,
    week_number: num(fd, "week"),
    workout_date: str(fd, "date") || null,
    note: str(fd, "note") || null,
  });
  revalidatePath(`/cycles/${cycleId}`);
}

export async function deleteWorkout(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  await supabase.from("workouts").delete().eq("id", str(fd, "id"));
  revalidatePath(`/cycles/${cycleId}`);
}

export async function addExercise(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  const name = str(fd, "name");
  if (!name) return;
  await supabase.from("exercises").insert({
    cycle_id: cycleId,
    workout_id: str(fd, "workout_id"),
    name,
  });
  revalidatePath(`/cycles/${cycleId}`);
}

export async function deleteExercise(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  await supabase.from("exercises").delete().eq("id", str(fd, "id"));
  revalidatePath(`/cycles/${cycleId}`);
}

export async function addSet(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  const exerciseId = str(fd, "exercise_id");
  const { count } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", exerciseId);
  await supabase.from("workout_sets").insert({
    cycle_id: cycleId,
    exercise_id: exerciseId,
    set_number: (count ?? 0) + 1,
    weight: num(fd, "weight") ?? 0,
    reps: num(fd, "reps") ?? 0,
    rir: num(fd, "rir"),
    rpe: num(fd, "rpe"),
  });
  revalidatePath(`/cycles/${cycleId}`);
}

export async function deleteSet(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  await supabase.from("workout_sets").delete().eq("id", str(fd, "id"));
  revalidatePath(`/cycles/${cycleId}`);
}

// Быстрый ввод серией: «80x8, 82.5x6 @2» — вес x повторения [@RIR].
// Разбираем строку и записываем все подходы одним действием
export async function addSetsBulk(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  const exerciseId = str(fd, "exercise_id");
  const raw = str(fd, "series");
  if (!cycleId || !exerciseId) return;

  const tokens = raw.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  const rows: {
    cycle_id: string; exercise_id: string; set_number: number;
    weight: number; reps: number; rir: number | null; rpe: null;
  }[] = [];

  const { count } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", exerciseId);
  let n = count ?? 0;

  for (const tok of tokens) {
    const m = tok.match(/^(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d{1,3})(?:\s*@\s*(\d{1,2}))?/);
    if (!m) continue;
    const weight = Number(m[1].replace(",", "."));
    const reps = Number(m[2]);
    if (!Number.isFinite(weight) || !reps) continue;
    n += 1;
    rows.push({
      cycle_id: cycleId,
      exercise_id: exerciseId,
      set_number: n,
      weight,
      reps,
      rir: m[3] !== undefined && m[3] !== "" ? Number(m[3]) : null,
      rpe: null,
    });
  }
  if (!rows.length) return;

  await supabase.from("workout_sets").insert(rows);
  revalidatePath(`/cycles/${cycleId}`);
}
