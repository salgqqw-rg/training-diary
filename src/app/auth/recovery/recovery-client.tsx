"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function RecoveryClient({ next }: { next: string }) {
  const [status, setStatus] = useState("Проверяю ссылку…");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        // клиент сам разбирает #access_token=... из адреса (detectSessionInUrl)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.replace(next);
        } else {
          setStatus("Ссылка не распознана — возможно, она устарела. Возвращаю на страницу входа…");
          setTimeout(() => window.location.replace("/login?error=" +
            encodeURIComponent("Ссылка устарела — запроси письмо заново")), 2200);
        }
      } catch {
        window.location.replace("/login?error=" + encodeURIComponent("Не удалось завершить сброс пароля"));
      }
    };
    run();
  }, [next]);

  return (
    <div className="card narrow" style={{ textAlign: "center" }}>
      <h2>Проверка ссылки</h2>
      <p className="muted">{status}</p>
    </div>
  );
}
