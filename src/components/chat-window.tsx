"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchMessages, sendMessage, type ChatMessage } from "@/lib/chat-actions";

export function ChatWindow({
  partnerId,
  meId,
  initial,
}: {
  partnerId: string;
  meId: string;
  initial: ChatMessage[];
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    const fresh = await fetchMessages(partnerId);
    setMsgs(fresh);
  }, [partnerId]);

  // Обновление входящих, пока страница открыта
  useEffect(() => {
    setMsgs(initial);
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh, initial]);

  useEffect(() => {
    const box = document.getElementById("chat-msgs");
    if (box) box.scrollTop = box.scrollHeight;
  }, [msgs]);

  async function handleSend(fd: FormData) {
    setSending(true);
    setError(null);
    const result = await sendMessage(fd);
    if (result) setError(result);
    await refresh();
    setSending(false);
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="chat-main">
      <div className="chat-msgs" id="chat-msgs">
        {msgs.length === 0 && (
          <p className="muted">Сообщений нет — напишите первым</p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.sender_id === meId ? "msg me" : "msg"}>
            <div>{m.body}</div>
            <time>{time(m.created_at)}</time>
          </div>
        ))}
      </div>

      {error && <p className="danger">{error}</p>}
      <form action={handleSend} className="row" style={{ marginTop: 8 }}>
        <input type="hidden" name="recipient" value={partnerId} />
        <input
          name="body"
          maxLength={2000}
          placeholder="Сообщение…"
          style={{ flex: 1, minWidth: 200 }}
          autoComplete="off"
        />
        <button className="primary" disabled={sending}>
          {sending ? "…" : "Отправить"}
        </button>
      </form>
    </div>
  );
}
