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

const goto = (key: "error" | "ok", msg: string, tab = "clients"): never =>
  redirect(`/clients?tab=${tab}&${key}=${encodeURIComponent(msg)}`);

// Тренер приглашает подопечного по email
export async function inviteTrainee(fd: FormData) {
  const { supabase, user } = await requireUser();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email) goto("error", "Укажите email подопечного");

  // Точное совпадение через функцию (миграция 26): email в profiles напрямую не читается
  const { data: traineeId } = await supabase.rpc("find_user_by_email", { e: email });

  if (traineeId) {
    const { error } = await supabase
      .from("coach_links")
      .insert({ coach_id: user.id, trainee_id: traineeId, status: "pending" });
    if (error) {
      goto("error", error.code === "23505"
        ? "Заявка уже существует: подопечный должен подтвердить её у себя"
        : "Не удалось отправить заявку");
    }
    revalidatePath("/clients");
    goto("ok", "Заявка отправлена — подопечный подтвердит её на странице «Подопечные»");
  }
  goto("error", "Пользователь с таким email не найден — пусть сначала зарегистрируется");
}

// Подопечный принимает или отклоняет заявку тренера
export async function respondInvite(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(fd.get("id") ?? "");
  const accept = String(fd.get("answer")) === "accept";

  if (accept) {
    const { data: done } = await supabase
      .from("coach_links")
      .update({ status: "active" })
      .eq("id", id)
      .eq("status", "pending")
      .neq("requested_by", user.id)
      .select("id");
    if (!done?.length) goto("error", "Не удалось принять заявку: возможно, её уже отменили");
    revalidatePath("/clients");
    revalidatePath("/", "layout");
  } else {
    await supabase.from("coach_links").delete().eq("id", id).neq("requested_by", user.id);
  }
  revalidatePath("/clients");
}

// Разорвать связь может любая из сторон
export async function removeLink(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("coach_links").delete().eq("id", String(fd.get("id") ?? ""));
  revalidatePath("/clients");
}

// Тренер составляет тренировочный план (цикл) подопечному:
// цикл создаётся с user_id = подопечный, поэтому сразу появляется в его дневнике
export async function createTraineeCycle(fd: FormData) {
  const { supabase, user } = await requireUser();
  const traineeId = String(fd.get("trainee_id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const weeks = Number(fd.get("weeks"));

  if (!traineeId || !name || !weeks || weeks < 1 || weeks > 52) {
    goto("error", "Укажите подопечного, название и количество недель (1–52)", "plans");
  }

  // Проверяем активную связь: RLS не пропустит чужой цикл, но для понятной ошибки — проверим сами
  const { data: link } = await supabase
    .from("coach_links")
    .select("id")
    .eq("coach_id", user.id)
    .eq("trainee_id", traineeId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) goto("error", "Активная связь с этим подопечным не найдена", "plans");

  const { data: created, error } = await supabase
    .from("cycles")
    .insert({ user_id: traineeId, created_by: user.id, name, weeks_count: weeks })
    .select("id")
    .single();

  if (created) {
    revalidatePath("/clients");
    revalidatePath("/diary");
    redirect(`/cycles/${created.id}`);
  }
  goto("error", "Не удалось создать план — попробуйте ещё раз", "plans");
}
