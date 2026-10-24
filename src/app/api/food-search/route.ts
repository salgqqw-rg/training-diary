import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fatSecretSearch } from "@/lib/fatsecret";

// Поиск продуктов для дневника питания.
// 1) Если настроены FatSecret ключи (env) — ищем в их ru-базе.
// 2) Иначе (или пустой запрос) — в своей базе сохранённых продуктов.
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [], source: "guest" }, { status: 401 });

  if (q) {
    const fs = await fatSecretSearch(q);
    if (fs !== null) return NextResponse.json({ source: "fatsecret", items: fs });
  }

  let base = supabase
    .from("user_foods")
    .select("id, name, kcal")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);
  if (q) base = base.ilike("name", `%${q}%`);

  const { data: foods } = await base;
  const items = (foods ?? []).map((f) => ({
    ref: `uf:${f.id}`,
    name: f.name,
    sub: `своя база · на 100 г: ${Math.round(Number(f.kcal))} ккал`,
    kcal100: Math.round(Number(f.kcal)),
  }));
  return NextResponse.json({ source: "local", items });
}
