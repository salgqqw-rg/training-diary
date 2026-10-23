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
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(fd.get("email") ?? ""),
    password: String(fd.get("password") ?? ""),
    options: { data: { display_name: String(fd.get("name") ?? "").trim() } },
  });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
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
