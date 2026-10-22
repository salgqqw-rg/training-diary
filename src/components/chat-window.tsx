"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMessages, sendMessage, type ChatMessage } from "@/lib/chat-actions";

// Убирает дубли, если сообщение успело отправиться дважды
function uniq(list: ChatMessage[]) {
  const seen = new Set<string>();
  return list.filter((m) => !seen.has(m.id) && (seen.add(m.id), true));
}

export function ChatWindow({
  partnerId,
  meId,
  initial,
}: {
  partnerId: string;
  meId: string;
  initial: ChatMessage[];
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => uniq(initial));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false); // синхронный guard: серверный action не выполнится дважды
  const formRef = useRef<HTMLFormElement>(null);

  const refresh = useCallback(async () => {
    const fresh = await fetchMessages(partnerId);
    setMsgs(uniq(fresh));
  }, [partnerId]);

  // Входящие обновляются сами, пока открыт диалог
  useEffect(() => {
    setMsgs(uniq(initial));
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [refresh, initial]);

  useEffect(() => {
    const box = document.getElementById("chat-msgs");
    if (box) box.scrollTop = box.scrollHeight;
  }, [msgs]);

  async function handleSend(fd: FormData) {
    if (busy.current || sending) return;
    busy.current = true;
    setSending(true);
    setError(null);
    const result = await sendMessage(fd);
    if (result) setError(result);
    formRef.current?.reset(); // очищаем поле ввода и выбранный файл
    await refresh();
    busy.current = false;
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
            {m.image_url && (
              <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                <img src={m.image_url} alt="Фото" width={220} className="chat-photo" />
              </a>
            )}
            {m.body && <div>{m.body}</div>}
            <time>{time(m.created_at)}</time>
          </div>
        ))}
      </div>

      {error && <p className="danger">{error}</p>}
      <form ref={formRef} action={handleSend} className="row" style={{ marginTop: 8 }}>
        <input type="hidden" name="recipient" value={partnerId} />
        <label title="Прикрепить фото" style={{ margin: 0 }}>
          📎
          <input name="photo" type="file" accept="image/*" style={{ display: "none" }} />
        </label>
        <input
          name="body"
          maxLength={2000}
          placeholder="Сообщение…"
          style={{ flex: 1, minWidth: 160 }}
          autoComplete="off"
        />
        <button className="primary" disabled={sending}>
          {sending ? "…" : "Отправить"}
        </button>
      </form>
    </div>
  );
}
