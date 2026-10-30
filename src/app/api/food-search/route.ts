import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fatSecretSearch } from "@/lib/fatsecret";

// Поиск продуктов для дневника питания. Источники:
// 1) user_foods — общая библиотека продуктов, добавленных пользователями;
// 2) food_catalog — каталог Open Food Facts в нашей базе Supabase (скрипт scripts/import-openfoodfacts.mjs);
// 3) FatSecret Platform API — дополнительный источник (US-база, названия на английском).
//    Подключается только если заданы FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET; любой сбой
//    FatSecret (нет ключей, IP не в белом списке, лимит, таймаут) молча пропускается.
// Без запроса показываем свои недавние продукты.

type Item = { ref: string; name: string; sub: string; kcal100: number };

const esc = (s: string) => s.replace(/[\\%_,()]/g, " ").trim();
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

// Тариф Basic знает только английские названия: кириллицу в FatSecret не отправляем (экономим лимит 5000/день)
const HAS_CYRILLIC = /[\u0400-\u04FF]/;
const FS_TIMEOUT_MS = 4000;

async function searchFatSecret(q: string): Promise<Item[]> {
  if (q.length < 3 || HAS_CYRILLIC.test(q)) return [];
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FS_TIMEOUT_MS));
    const res = await Promise.race([fatSecretSearch(q), timeout]);
    return (res ?? []).slice(0, 8).map((it) => ({ ...it, sub: `FatSecret · ${it.sub}` }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const q = esc(new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [], source: "guest" }, { status: 401 });

  // Библиотека пользователей: единственная связь с profiles — user_id (автор продукта)
  let lib = supabase
    .from("user_foods")
    .select("id, name, kcal, protein_g, fat_g, carbs_g, author:profiles!user_foods_user_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(12);
  lib = q ? lib.ilike("name", `%${q}%`) : lib.eq("user_id", user.id);

  const catalogQ = q.length >= 2
    ? supabase
        .from("food_catalog")
        .select("code, name, brand, kcal, protein_g, fat_g, carbs_g")
        .ilike("search", `%${q}%`)
        .limit(60)
    : null;

  const [{ data: foods }, catalogRes, fsItems] = await Promise.all([
    lib,
    catalogQ ?? Promise.resolve({ data: [] }),
    searchFatSecret(q),
  ]);

  const own: Item[] = (foods ?? []).map((f) => {
    const author = (f as { author?: { display_name?: string } | null }).author?.display_name ?? null;
    const by = author ? `добавил: ${author}` : "библиотека";
    return {
      ref: `uf:${f.id}`,
      name: f.name,
      sub: `${by} · на 100 г: ${Math.round(Number(f.kcal))} ккал · Б ${f1(Number(f.protein_g))} · Ж ${f1(Number(f.fat_g))} · У ${f1(Number(f.carbs_g))}`,
      kcal100: Math.round(Number(f.kcal)),
    };
  });

  // Каталог: сначала названия, начинающиеся с запроса, затем более короткие (обычно — «простые» продукты)
  type Row = { code: string; name: string; brand: string | null; kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  const rows = ((catalogRes.data ?? []) as Row[]).slice().sort((a, b) => {
    const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return as - bs || a.name.length - b.name.length;
  });
  const catalog: Item[] = rows.slice(0, 20).map((r) => ({
    ref: `of:${r.code}`,
    name: r.brand ? `${r.name} · ${r.brand}` : r.name,
    sub: `на 100 г: ${Math.round(Number(r.kcal))} ккал · Б ${f1(Number(r.protein_g))} · Ж ${f1(Number(r.fat_g))} · У ${f1(Number(r.carbs_g))}`,
    kcal100: Math.round(Number(r.kcal)),
  }));

  // Порядок: продукты пользователей (вписали вручную — значит нужны), затем каталог, затем FatSecret
  const source = catalog.length ? "catalog" : fsItems.length ? "fatsecret" : "local";
  return NextResponse.json({ source, items: [...own, ...catalog, ...fsItems] });
}
