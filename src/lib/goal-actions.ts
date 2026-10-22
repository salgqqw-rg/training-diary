"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const goto = (key: "error" | "ok", msg: string): never =>
  redirect(`/goals?${key}=${encodeURIComponent(msg)}`);

// Поставить цель
export async function addGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(fd.get("title") ?? "").trim().slice(0, 150);
  if (!title) goto("error", "Опишите цель");
  const details = String(fd.get("details") ?? "").trim().slice(0, 500) || null;
  const dueDate = String(fd.get("due_date") ?? "").trim() || null;

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title, details, due_date: dueDate,
  });
  if (error) {
    goto("error", error.code === "42P01"
      ? "Таблица не создана: выполните supabase/migration_06_goals.sql в Supabase"
      : "Не удалось сохранить цель: " + error.message);
  }
  revalidatePath("/goals");
}

// Отметить выполненной / вернуть в работу
export async function toggleGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(fd.get("id") ?? "");
  const done = String(fd.get("done")) === "true";
  await supabase
    .from("goals")
    .update({ status: done ? "done" : "active", done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/goals");
}

// Отказаться от цели (срок вышел / планы изменились)
export async function dropGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("goals")
    .update({ status: "dropped", done_at: null })
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/goals");
}

export async function deleteGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("goals")
    .delete()
    .eq("id", String(fd.get("id") ?? ""))
    .eq("user_id", user.id);
  revalidatePath("/goals");
}
