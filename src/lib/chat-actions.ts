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
  created_at: string;
  read_at: string | null;
};

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

// История диалога (последние 200). Сразу отмечает прочтённым входящие.
export async function fetchMessages(partnerId: string): Promise<ChatMessage[]> {
  const { supabase, user } = await requireUser();
  if (partnerId === user.id) return [];
  if (!(await isLinked(supabase, user.id, partnerId))) return [];

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .eq("sender_id", partnerId)
    .is("read_at", null);

  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, body, image_url, image_path, created_at, read_at")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
    .order("seq", { ascending: false })
    .limit(200);

  const list = (data ?? []) as ChatMessage[];
  return list.reverse();
}

// Отправить сообщение (текст и/или фото). Возвращает текст ошибки или null при успехе.
export async function sendMessage(fd: FormData): Promise<string | null> {
  const { supabase, user } = await requireUser();
  const recipient = String(fd.get("recipient") ?? "");
  const body = String(fd.get("body") ?? "").trim().slice(0, 2000);
  const file = fd.get("photo");

  if (!body && !(file instanceof File && file.size > 0)) return "Пустое сообщение";
  if (recipient === user.id) return "Нельзя писать самому себе";
  if (!(await isLinked(supabase, user.id, recipient))) {
    return "Переписка доступна только с вашими подопечными или тренерами";
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
  });
  if (error) {
    if (imagePath) await supabase.storage.from("chat").remove([imagePath]);
    return "Не удалось отправить: " + error.message;
  }
  revalidatePath("/chat");
  return null;
}
