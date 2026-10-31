import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { fetchMessages, type ChatMessage, type Quote } from "@/lib/chat-actions";
import { ChatWindow } from "@/components/chat-window";

type Contact = { id: string; display_name: string; unread: number };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user: partnerParam } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // Собеседники: мои подопечные (я тренер) и мои тренеры (я подопечный)
  const [{ data: asCoach }, { data: asTrainee }] = await Promise.all([
    supabase
      .from("coach_links")
      .select("trainee:profiles!coach_links_trainee_id_fkey(id, display_name)")
      .eq("coach_id", user.id)
      .eq("status", "active"),
    supabase
      .from("coach_links")
      .select("coach:profiles!coach_links_coach_id_fkey(id, display_name)")
      .eq("trainee_id", user.id)
      .eq("status", "active"),
  ]);
  const contacts = new Map<string, Contact>();
  for (const l of (asCoach ?? []) as { trainee: { id: string; display_name: string } | { id: string; display_name: string }[] | null }[]) {
    const t = Array.isArray(l.trainee) ? l.trainee[0] : l.trainee;
    if (t) contacts.set(t.id, { id: t.id, display_name: t.display_name, unread: 0 });
  }
  for (const l of (asTrainee ?? []) as { coach: { id: string; display_name: string } | { id: string; display_name: string }[] | null }[]) {
    const c = Array.isArray(l.coach) ? l.coach[0] : l.coach;
    if (c) contacts.set(c.id, { id: c.id, display_name: c.display_name, unread: 0 });
  }

  // Непрочитанные по каждому собеседнику
  const { data: unread } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("recipient_id", user.id)
    .is("read_at", null);
  for (const row of (unread ?? []) as { sender_id: string }[]) {
    const c = contacts.get(row.sender_id);
    if (c) c.unread += 1;
  }

  let initial: ChatMessage[] = [];
  let quotes: Record<string, Quote> = {};
  let partner: { id: string; display_name: string } | null = null;

  if (partnerParam && contacts.has(partnerParam)) {
    partner = contacts.get(partnerParam)!;
    const res = await fetchMessages(partnerParam);
    initial = res.msgs;
    quotes = res.quotes;
  }

  const contactList = [...contacts.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <>
      <h1>Сообщения</h1>
      <div className="chat-wrap">
        <div className="chat-contacts card">
          <h3>Собеседники</h3>
          {contactList.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              Никого нет. Свяжитесь с тренером или подопечными на странице «Подопечные».
            </p>
          )}
          {contactList.map((c) => (
            <Link
              key={c.id}
              href={`/chat?user=${c.id}`}
              className={c.id === partner?.id ? "contact active" : "contact"}
            >
              <span><b>{c.display_name}</b></span>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
            </Link>
          ))}
        </div>

        {partner ? (
          <ChatWindow
            key={partner.id}
            partnerId={partner.id}
            partnerName={partner.display_name}
            meId={user.id}
            initial={initial}
            quotes={quotes}
          />
        ) : (
          <div className="chat-main card">
            <p className="muted">Выберите собеседника слева, чтобы начать переписку.</p>
          </div>
        )}
      </div>
    </>
  );
}
