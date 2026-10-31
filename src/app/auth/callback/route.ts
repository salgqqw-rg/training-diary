import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Возврат после авторизации Google / ссылки сброса пароля:
// обмениваем одноразовый код на сессию и отправляем куда указано в next
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Ошибки от Supabase (например, просроченная ссылка) — показываем на странице входа
  const oauthError = searchParams.get("error") ?? searchParams.get("error_description");
  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Кода нет — возможно ссылка в hash-формате; страховка разберёт её в браузере
  return NextResponse.redirect(
    `${origin}/auth/recovery?next=${encodeURIComponent(next)}`,
  );
}
