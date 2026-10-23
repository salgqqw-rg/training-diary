"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMessages, sendMessage, type ChatMessage, type Quote } from "@/lib/chat-actions";

// Убирает дубли, если сообщение успело отправиться дважды
function uniq(list: ChatMessage[]) {
  const seen = new Set<string>();
  return list.filter((m) => !seen.has(m.id) && (seen.add(m.id), true));
}

export function ChatWindow({
  partnerId,
  partnerName,
  meId,
  initial,
  quotes,
}: {
  partnerId: string;
  partnerName: string;
  meId: string;
  initial: ChatMessage[];
  quotes: Record<string, Quote>;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => uniq(initial));
  const [quoteMap, setQuoteMap] = useState<Record<string, Quote>>(quotes);
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const busy = useRef(false); // синхронный guard: серверный action не выполнится дважды
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true); // автоскролл только если пользователь и был внизу

  function onScroll() {
    const box = boxRef.current;
    if (!box) return;
    stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  }

  const refresh = useCallback(async () => {
    const res = await fetchMessages(partnerId);
    setMsgs(uniq(res.msgs));
    setQuoteMap(res.quotes);
  }, [partnerId]);

  // Входящие обновляются сами, пока открыт диалог
  useEffect(() => {
    setMsgs(uniq(initial));
    setQuoteMap(quotes);
    stickToBottom.current = true;
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    const box = boxRef.current;
    if (box && stickToBottom.current) box.scrollTop = box.scrollHeight;
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
    setReplyTo(null);
    await refresh();
    busy.current = false;
    setSending(false);
  }

  const quoteText = (q: Quote) => q.body || (q.image_url ? "[фото]" : "сообщение");
  const quoteAuthor = (q: Quote) => (q.sender_id === meId ? "Вы" : partnerName);
  const time = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="chat-main">
      <div className="chat-msgs" ref={boxRef} onScroll={onScroll}>
        {msgs.length === 0 && (
          <p className="muted">Сообщений нет — напишите первым</p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          const q = m.reply_to ? quoteMap[m.reply_to] : undefined;
          return (
            <div key={m.id} className={`msg-row${mine ? " me" : ""}`}>
              <div className={mine ? "msg me" : "msg"}>
                {q && (
                  <div className="quote">
                    <b>{quoteAuthor(q)}</b>
                    <span>{quoteText(q)}</span>
                  </div>
                )}
                {m.image_url && (
                  <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.image_url} alt="Фото" width={220} className="chat-photo" />
                  </a>
                )}
                {m.body && <div>{m.body}</div>}
                <time>{time(m.created_at)}</time>
              </div>
              <button
                className="reply-btn"
                title="Ответить"
                onClick={() =>
                  setReplyTo({
                    id: m.id,
                    author: mine ? "Вы" : partnerName,
                    text: m.body || (m.image_url ? "[фото]" : "сообщение"),
                  })
                }
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 14-4-4 4-4" />
                  <path d="M5 10h11a4 4 0 0 1 4 4v6" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="danger">{error}</p>}
      {replyTo && (
        <div className="reply-chip">
          <span>
            {`Ответ ${replyTo.author}: `}
            <b className="qtext">{replyTo.text.length > 60 ? replyTo.text.slice(0, 60) + "…" : replyTo.text}</b>
          </span>
          <button type="button" onClick={() => setReplyTo(null)} title="Отменить ответ">✕</button>
        </div>
      )}
      <form ref={formRef} action={handleSend} className="row" style={{ marginTop: replyTo ? 4 : 8 }}>
        <input type="hidden" name="recipient" value={partnerId} />
        <input type="hidden" name="reply_to" value={replyTo?.id ?? ""} />
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
