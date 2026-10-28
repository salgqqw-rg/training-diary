// Клиент FatSecret Platform API (поиск продуктов и детальное КБЖУ).
// Ключи берём из env: FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET.
// Без ключей все функции возвращают null — сайт работает со своей базой продуктов.

type FSItem = { ref: string; name: string; sub: string; kcal100: number };

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;

  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "basic" }),
  });
  if (!res.ok) return null;

  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

type FSServing = {
  metric_serving_amount?: unknown;
  metric_serving_unit?: unknown;
  number_of_units?: unknown;
  calories?: unknown;
  protein?: unknown;
  fat?: unknown;
  carbohydrate?: unknown;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// КБЖУ на 100 г из списка порций; 100 г → 1, другая г-порция или единица → пересчёт
function per100FromServings(list: FSServing[]): { kcal100: number; p100: number; f100: number; c100: number } | null {
  if (!list.length) return null;
  const by100 = list.find(
    (s) => String(s.metric_serving_unit ?? "").toLowerCase() === "g" && num(s.metric_serving_amount) === 100,
  );
  const anyG = list.find(
    (s) => String(s.metric_serving_unit ?? "").toLowerCase() === "g" && num(s.metric_serving_amount) > 0,
  );
  const chosen = by100 ?? anyG ?? list[0];
  const denom =
    by100 ? 100 : anyG ? num(anyG.metric_serving_amount) : num(chosen.number_of_units) || 100;
  if (denom <= 0) return null;
  const k = 100 / denom;
  return {
    kcal100: num(chosen.calories) * k,
    p100: num(chosen.protein) * k,
    f100: num(chosen.fat) * k,
    c100: num(chosen.carbohydrate) * k,
  };
}

// Поиск продуктов (ru-база): возвращает элементы для подсказки в поиске
export async function fatSecretSearch(q: string): Promise<FSItem[] | null> {
  const token = await getToken();
  if (!token) return null;

  const url = new URL("https://platform.fatsecret.com/rest/foods/search/v1");
  url.searchParams.set("search_expression", q);
  url.searchParams.set("max_results", "12");
  url.searchParams.set("format", "json");
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Accept-Language": "ru-RU" },
  });
  if (!res.ok) return null;

  const j = (await res.json()) as unknown;
  // FatSecret отдаёт ошибки (например, код 21 «IP не в белом списке») с HTTP 200:
  // {"error":{"code":21,"message":...}} — считаем это «API недоступен», откат на локальную базу
  if (j && typeof j === "object" && "error" in j) return null;
  const root = j as {
    foods_search?: { results?: { food?: unknown } };
    foods?: { food?: unknown };
  };
  const raw = root.foods_search?.results?.food ?? root.foods?.food ?? root.foods_search?.results;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && "servings" in (raw as Record<string, unknown>)
      ? [raw]
      : [];
  if (!list.length) return [];

  const items: FSItem[] = [];
  for (const el of list) {
    const f = el as {
      food_id?: string | number;
      food_name?: string;
      food_description?: string;
      brand_name?: string;
      servings?: { serving?: unknown };
    };
    if (!f.food_id) continue;
    const rawServ = f.servings?.serving;
    const servings: FSServing[] = Array.isArray(rawServ)
      ? (rawServ as FSServing[])
      : rawServ
        ? [rawServ as FSServing]
        : [];
    const p100 = per100FromServings(servings);
    const brand = f.brand_name ? `${f.brand_name} · ` : "";
    const sub =
      p100
        ? `${brand}на 100 г: ${Math.round(p100.kcal100)} ккал · Б ${p100.p100.toFixed(1)} · Ж ${p100.f100.toFixed(1)} · У ${p100.c100.toFixed(1)}`
        : (f.food_description ?? (brand || "FatSecret"));
    items.push({
      ref: `fs:${f.food_id}`,
      name: f.food_name ?? "Продукт",
      sub,
      kcal100: Math.round(p100?.kcal100 ?? 0),
    });
  }
  return items;
}

// Точное КБЖУ на 100 г одного продукта FatSecret (для записи в дневник)
export async function fatSecretFood(
  id: string,
): Promise<{ name: string; kcal100: number; p100: number; f100: number; c100: number } | null> {
  const token = await getToken();
  if (!token) return null;

  const url = new URL("https://platform.fatsecret.com/rest/food/v1");
  url.searchParams.set("food_id", id);
  url.searchParams.set("format", "json");
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Accept-Language": "ru-RU" },
  });
  if (!res.ok) return null;

  const j = (await res.json()) as unknown;
  if (j && typeof j === "object" && "error" in j) return null;
  const f = ((j as { food?: unknown }).food ?? j) as {
    food_name?: string;
    brand_name?: string;
    servings?: { serving?: unknown };
  };
  const rawServ = f.servings?.serving;
  const servings: FSServing[] = Array.isArray(rawServ)
    ? (rawServ as FSServing[])
    : rawServ
      ? [rawServ as FSServing]
      : [];
  const p100 = per100FromServings(servings);
  if (!p100) return null;

  const name = [f.brand_name, f.food_name].filter(Boolean).join(" · ") || "Продукт";
  return {
    name,
    kcal100: Math.round(p100.kcal100 * 10) / 10,
    p100: Math.round(p100.p100 * 10) / 10,
    f100: Math.round(p100.f100 * 10) / 10,
    c100: Math.round(p100.c100 * 10) / 10,
  };
}
