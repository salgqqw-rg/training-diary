"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Запоминает часовой пояс браузера в куке tz, чтобы сервер считал «сегодня» по-вашему.
// Если пояс изменился (или куки ещё не было) — один раз перерисовывает страницу.
export function TzSync() {
  const router = useRouter();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const have = document.cookie.split("; ").find((c) => c.startsWith("tz="))?.slice(3);
      if (have === encodeURIComponent(tz)) return;
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    } catch {
      /* без куки работаем по UTC */
    }
  }, [router]);
  return null;
}
