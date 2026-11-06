import { createClient } from "@/lib/supabase/server";

// Фото формы и фото из чата лежат в закрытых бакетах. Чтение идёт под сессией пользователя,
// поэтому доступ решают правила Storage из миграции 26 (владелец, его тренер, собеседник).
const BUCKETS = new Set(["progress", "chat"]);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const bucket = sp.get("b") ?? "";
  const path = sp.get("p") ?? "";
  if (!BUCKETS.has(bucket) || !path || path.includes("..")) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(data.stream(), { // поток: ответ функции Vercel без лимита 4,5 МБ
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      // файл загружает пользователь: svg/html с этого адреса не должен выполнять скрипты на нашем домене
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
