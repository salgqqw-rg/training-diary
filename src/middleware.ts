import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Обновляет сессию на каждом запросе
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // текущий путь для серверного layout (голый полноэкранный вход/регистрация)
  response.headers.set("x-pathname", request.nextUrl.pathname);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          response.headers.set("x-pathname", request.nextUrl.pathname);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.getSession(); // обновляет токен только при истечении, без запроса в Supabase на каждый переход. shortcut: куки не сверяются с сервером, это делают RLS и server actions (getUser); для жёсткой проверки вернуть getUser
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
