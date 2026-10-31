"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clampWeight, clampReps, clampRir, clampRpe, clampRest } from "@/lib/sets";

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
  const week = num(fd, "week");
  const { data } = await supabase.from("workouts").insert({
    cycle_id: cycleId,
    week_number: week,
    workout_date: str(fd, "date") || null,
    note: str(fd, "note") || null,
  }).select("id").single();
  revalidatePath(`/cycles/${cycleId}`);
  // сразу открываем новую тренировку
  if (data) redirect(`/cycles/${cycleId}?week=${week}&workout=${data.id}`);
}

// Копия тренировки в выбранную неделю и дату: упражнения и подходы переносятся, блокировка снимается
export async function duplicateWorkout(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  const week = num(fd, "week");
  const { data: src } = await supabase.from("workouts").select("note").eq("id", str(fd, "id")).maybeSingle();
  if (!src || !week) return;
  const { data: wo } = await supabase.from("workouts").insert({
    cycle_id: cycleId,
    week_number: week,
    workout_date: str(fd, "date") || null,
    note: src.note,
  }).select("id").single();
  if (!wo) return;
  const { data: exs } = await supabase.from("exercises").select("id, name, note").eq("workout_id", str(fd, "id")).order("created_at");
  for (const ex of exs ?? []) {
    const { data: ne } = await supabase.from("exercises")
      .insert({ cycle_id: cycleId, workout_id: wo.id, name: ex.name, note: ex.note }).select("id").single();
    if (!ne) continue;
    const { data: sets } = await supabase.from("workout_sets")
      .select("set_number, weight, reps, rir, rpe, rest_sec").eq("exercise_id", ex.id).order("set_number");
    if (sets?.length) {
      await supabase.from("workout_sets").insert(sets.map((s: any) => ({ ...s, cycle_id: cycleId, exercise_id: ne.id })));
    }
  }
  revalidatePath(`/cycles/${cycleId}`);
  redirect(`/cycles/${cycleId}?week=${week}&workout=${wo.id}`);
}

export async function setWorkoutTimes(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  const t = (k: string) => (/^\d{2}:\d{2}$/.test(str(fd, k)) ? str(fd, k) : null);
  await supabase.from("workouts")
    .update({ start_time: t("start"), end_time: t("end") })
    .eq("id", str(fd, "id"));
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

  const { data: ex, error } = await supabase
    .from("exercises")
    .insert({ cycle_id: cycleId, workout_id: str(fd, "workout_id"), name })
    .select("id")
    .single();
  if (error || !ex) { revalidatePath(`/cycles/${cycleId}`); return; }

  // Сразу создаём строки подходов: «подходов» × повторов — вес пока 0, заполняется в таблице
  const setsN = Math.min(Math.max(Number(fd.get("sets")) || 0, 0), 20);
  const repsN = Math.min(Math.max(Number(fd.get("reps")) || 0, 0), 50);
  if (setsN > 0) {
    await supabase.from("workout_sets").insert(
      Array.from({ length: setsN }, (_, i) => ({
        cycle_id: cycleId,
        exercise_id: ex.id,
        set_number: i + 1,
        weight: 0,
        reps: repsN,
        rir: null,
        rpe: null,
      })),
    );
  }
  revalidatePath(`/cycles/${cycleId}`);
}

export async function deleteExercise(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  await supabase.from("exercises").delete().eq("id", str(fd, "id"));
  revalidatePath(`/cycles/${cycleId}`);
}

export async function saveExerciseNote(fd: FormData) {
  const { supabase } = await requireUser();
  const note = str(fd, "note").slice(0, 2000);
  await supabase.from("exercises").update({ note: note || null }).eq("id", str(fd, "id"));
  revalidatePath(`/cycles/${str(fd, "cycle_id")}`);
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
    weight: clampWeight(fd.get("weight")),
    reps: clampReps(fd.get("reps")),
    rir: clampRir(fd.get("rir")),
    rpe: clampRpe(fd.get("rpe")),
    rest_sec: clampRest(fd.get("rest")),
  });
  revalidatePath(`/cycles/${cycleId}`);
}

export async function deleteSet(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  await supabase.from("workout_sets").delete().eq("id", str(fd, "id")).eq("locked", false);
  revalidatePath(`/cycles/${cycleId}`);
}

// Сохранить изменения подходов прямо из таблицы (вес, повт, RIR, RPE, номер)
export async function updateSetsBulk(fd: FormData) {
  const { supabase } = await requireUser();
  const cycleId = str(fd, "cycle_id");
  let rows: {
    id: string; set_number?: number; weight?: number; reps?: number;
    rir?: number | null; rpe?: number | null; rest?: number | null;
  }[] = [];
  try { rows = JSON.parse(String(fd.get("rows") ?? "[]")); } catch { return; }
  if (!cycleId || !Array.isArray(rows)) return;

  const lock = str(fd, "lock") === "1"; // «Сохранить» фиксирует подходы навсегда

  for (const r of rows) {
    if (!r?.id) continue;
    const patch: Record<string, number | boolean | null> = {};
    if (r.set_number !== undefined) patch.set_number = Math.max(1, Math.min(99, Math.round(Number(r.set_number) || 1)));
    if (r.weight !== undefined) patch.weight = clampWeight(r.weight);
    if (r.reps !== undefined) patch.reps = clampReps(r.reps);
    if (r.rir !== undefined) patch.rir = clampRir(r.rir);
    if (r.rpe !== undefined) patch.rpe = clampRpe(r.rpe);
    if (r.rest !== undefined) patch.rest_sec = clampRest(r.rest);
    if (!Object.keys(patch).length) continue;
    if (lock) patch.locked = true;
    await supabase.from("workout_sets").update(patch).eq("id", String(r.id)).eq("locked", false);
  }
  revalidatePath(`/cycles/${cycleId}`);
}
