import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

// Непрочитанные входящие: количество + последнее сообщение (для всплывающего окна).
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ count: 0, latest: null });
  const supabase = await createClient();
  const [{ count }, { data }] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id).is("read_at", null),
    supabase.from("messages").select("id, body, sender:profiles!messages_sender_id_fkey(display_name)")
      .eq("recipient_id", user.id).is("read_at", null)
      .order("created_at", { ascending: false }).limit(1),
  ]);
  const m = data?.[0] as { id: string; body: string; sender: { display_name: string } | { display_name: string }[] | null } | undefined;
  const s = Array.isArray(m?.sender) ? m?.sender[0] : m?.sender;
  return NextResponse.json({
    count: count ?? 0,
    latest: m ? { id: m.id, from: s?.display_name ?? "Сообщение", text: m.body.slice(0, 120) } : null,
  });
}
