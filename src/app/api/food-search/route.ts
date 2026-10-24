import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fatSecretSearch } from "@/lib/fatsecret";

// Поиск продуктов для дневника питания.
// 1) Если настроены FatSecret ключи (env) — ищем в их ru-базе.
// 2) Иначе — в ОБЩЕЙ библиотеке продуктов: по запросу ищем среди продуктов,
//    добавленных любым пользователем; без запроса показываем свои недавние.
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [], source: "guest" }, { status: 401 });

  if (q) {
    const fs = await fatSecretSearch(q);
    if (fs !== null) return NextResponse.json({ source: "fatsecret", items: fs });
  }

  // user_foods: единственная связь с profiles — user_id (автор продукта), неоднозначности нет
  let base = supabase
    .from("user_foods")
    .select("id, name, kcal, author:profiles!user_foods_user_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(12);
  base = q
    ? base.ilike("name", `%${q}%`) // общая библиотека: ищем у всех
    : base.eq("user_id", user.id); // без запроса — свои недавние продукты

  const { data: foods } = await base;
  const items = (foods ?? []).map((f) => {
    const author = (f as { author?: { display_name?: string } | null }).author?.display_name ?? null;
    const by = author && author !== "" ? `добавил: ${author}` : "библиотека";
    return {
      ref: `uf:${f.id}`,
      name: f.name,
      sub: `${by} · на 100 г: ${Math.round(Number(f.kcal))} ккал`,
      kcal100: Math.round(Number(f.kcal)),
    };
  });
  return NextResponse.json({ source: "local", items });
}
