"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  image_path: string | null;
  reply_to: string | null;
  created_at: string;
  read_at: string | null;
};

// Цитируемое сообщение (короткая выдержка для отображения в пузыре)
export type Quote = {
  id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
};

// История диалога (последние 200). Сразу отмечает прочтённым входящие.
// Возвращает сообщения и карту цитируемых (reply_to -> исходное сообщение).
export async function fetchMessages(
  partnerId: string,
): Promise<{ msgs: ChatMessage[]; quotes: Record<string, Quote> }> {
  const { supabase, user } = await requireUser();
  if (partnerId === user.id) return { msgs: [], quotes: {} };
  if (!(await isLinked(supabase, user.id, partnerId))) return { msgs: [], quotes: {} };

  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, body, image_url, image_path, reply_to, created_at, read_at")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
    .order("seq", { ascending: false })
    .limit(200);

  const list = (data ?? []) as ChatMessage[];
  // Цитируемые сообщения одним запросом (только там, где есть reply_to)
  const quotes: Record<string, Quote> = {};
  const qIds = [...new Set(list.map((m) => m.reply_to).filter((v): v is string => Boolean(v)))];
  if (qIds.length > 0) {
    const { data: quoted } = await supabase
      .from("messages")
      .select("id, sender_id, body, image_url")
      .in("id", qIds);
    for (const row of (quoted ?? []) as Quote[]) quotes[row.id] = row;
  }

  // Отмечаем прочитанными только непрочитанные входящие — лишних UPDATE нет
  const unreadIds = list
    .filter((m) => m.sender_id === partnerId && !m.read_at)
    .map((m) => m.id);
  if (unreadIds.length > 0) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .is("read_at", null);
  }
  return { msgs: list.reverse(), quotes };
}

// Проверка, что собеседник связан с текущим пользователем
export async function isLinked(supabase: Awaited<ReturnType<typeof createClient>>, me: string, other: string) {
  const { data: link } = await supabase
    .from("coach_links")
    .select("id")
    .eq("status", "active")
    .or(`and(coach_id.eq.${me},trainee_id.eq.${other}),and(trainee_id.eq.${me},coach_id.eq.${other})`)
    .maybeSingle();
  return !!link;
}

// Отправить сообщение (текст и/или фото, можно с ответом на сообщение).
// Возвращает текст ошибки или null при успехе.
export async function sendMessage(fd: FormData): Promise<string | null> {
  const { supabase, user } = await requireUser();
  const recipient = String(fd.get("recipient") ?? "");
  const body = String(fd.get("body") ?? "").trim().slice(0, 2000);
  const file = fd.get("photo");
  let replyTo = String(fd.get("reply_to") ?? "").trim() || null;

  if (!body && !(file instanceof File && file.size > 0)) return "Пустое сообщение";
  if (recipient === user.id) return "Нельзя писать самому себе";
  if (!(await isLinked(supabase, user.id, recipient))) {
    return "Переписка доступна только с вашими подопечными или тренерами";
  }

  // Цитируемое сообщение должно принадлежать этому диалогу
  if (replyTo) {
    const { data: quoted } = await supabase
      .from("messages")
      .select("sender_id, recipient_id")
      .eq("id", replyTo)
      .maybeSingle();
    const inDialog = quoted && [quoted.sender_id, quoted.recipient_id].every((id) => id === user.id || id === recipient);
    if (!inDialog) replyTo = null;
  }

  let imagePath: string | null = null;
  let imageUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return "Файл не изображением";
    if (file.size > 10 * 1024 * 1024) return "Фото больше 10 МБ";
    imagePath = `${user.id}/${crypto.randomUUID()}`;
    const { error: upErr } = await supabase.storage
      .from("chat")
      .upload(imagePath, file, { contentType: file.type });
    if (upErr) return "Фото не загрузилось: " + upErr.message;
    const { data } = supabase.storage.from("chat").getPublicUrl(imagePath);
    imageUrl = data.publicUrl;
  }

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipient,
    body: body || null,
    image_path: imagePath,
    image_url: imageUrl,
    reply_to: replyTo,
  });
  if (error) {
    if (imagePath) await supabase.storage.from("chat").remove([imagePath]);
    return "Не удалось отправить: " + error.message;
  }
  revalidatePath("/chat");
  return null;
}
