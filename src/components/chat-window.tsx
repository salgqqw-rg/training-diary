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
  const [fileName, setFileName] = useState<string | null>(null);
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
    setFileName(null);
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
        <label className="attach" title="Прикрепить фото (до 10 МБ)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            name="photo"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
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
      {fileName && <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>🖼 {fileName}</p>}
    </div>
  );
}
