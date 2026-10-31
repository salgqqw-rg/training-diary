"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Общий счётчик непрочитанных: его пишет UnreadWatcher, читают бейджи в меню.
let count = 0;
const subs = new Set<() => void>();
const setCount = (n: number) => { if (n !== count) { count = n; subs.forEach((f) => f()); } };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function UnreadBadge() {
  const n = useSyncExternalStore(subscribe, () => count, () => 0);
  return n > 0 ? <span className="nav-badge">{n > 99 ? "99+" : n}</span> : null;
}

type Latest = { id: string; from: string; text: string };

// shortcut: опрос раз в 10 с вместо Realtime; когда понадобится мгновенно — подписка на messages через supabase realtime.
export function UnreadWatcher() {
  const pathname = usePathname();
  const seen = useRef<string | null | undefined>(undefined); // undefined = ещё не опрашивали
  const onChat = useRef(false);
  const [toast, setToast] = useState<Latest | null>(null);
  onChat.current = pathname.startsWith("/chat");

  useEffect(() => {
    let dead = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/unread", { cache: "no-store" });
        if (!r.ok || dead) return;
        const d: { count: number; latest: Latest | null } = await r.json();
        setCount(d.count);
        const id = d.latest?.id ?? null;
        if (seen.current !== undefined && id && id !== seen.current && !onChat.current) setToast(d.latest);
        seen.current = id;
      } catch { /* сеть пропала — попробуем в следующий раз */ }
    };
    poll();
    const t = setInterval(poll, 10000);
    const vis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <Link href="/chat" className="msg-toast" role="status" onClick={() => setToast(null)}>
      <b>{toast.from}</b>
      <span>{toast.text}</span>
    </Link>
  );
}
