import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Возврат после авторизации Google: обмениваем код на сессию и отправляем в приложение
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Не удалось войти через Google")}`,
  );
}
