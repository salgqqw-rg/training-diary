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
  redirect(`/clients?${key}=${encodeURIComponent(msg)}`);

// Тренер приглашает подопечного по email
export async function inviteTrainee(fd: FormData) {
  const { supabase, user } = await requireUser();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email) goto("error", "Укажите email подопечного");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (profile) {
    const { error } = await supabase
      .from("coach_links")
      .insert({ coach_id: user.id, trainee_id: profile.id });
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
    await supabase
      .from("coach_links")
      .update({ status: "active" })
      .eq("id", id)
      .eq("trainee_id", user.id)
      .eq("status", "pending");
    revalidatePath("/clients");
    revalidatePath("/", "layout");
  } else {
    await supabase.from("coach_links").delete().eq("id", id).eq("trainee_id", user.id);
  }
  revalidatePath("/clients");
}

// Разорвать связь может любая из сторон
export async function removeLink(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("coach_links").delete().eq("id", String(fd.get("id") ?? ""));
  revalidatePath("/clients");
}
