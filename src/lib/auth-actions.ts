"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Адрес приложения (учитывает прокси — туннель, Vercel)
async function appOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? ""),
    password: String(fd.get("password") ?? ""),
  });
  if (error) redirect("/login?error=" + encodeURIComponent("Неверный email или пароль"));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(fd: FormData) {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (confirm && password !== confirm) {
    redirect("/register?error=" + encodeURIComponent("Пароли не совпадают"));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(fd.get("email") ?? ""),
    password,
    options: { data: { display_name: String(fd.get("name") ?? "").trim() } },
  });
  if (error) redirect("/register?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// Вход через Google (один клик — авторизация в аккаунте Google)
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await appOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect("/login?error=" + encodeURIComponent("Google не настроен: " + error.message));
  if (data.url) redirect(data.url);
}

// Восстановление пароля: шлём письмо со ссылкой на форму нового пароля
export async function resetPassword(fd: FormData) {
  const supabase = await createClient();
  const origin = await appOrigin();
  const email = String(fd.get("email") ?? "").trim();
  if (email) {
    // Сообщение об отправке показываем всегда, чтобы не раскрывать, есть ли аккаунт
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    });
  }
  redirect("/forgot-password?sent=1");
}

// Смена пароля по ссылке из письма (сессия выдаётся после перехода по ссылке)
export async function updatePassword(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=" + encodeURIComponent("Ссылка устарела — запроси письмо заново"));

  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password !== confirm) {
    redirect("/update-password?error=" + encodeURIComponent("Пароли не совпадают"));
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/update-password?error=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/");
}
