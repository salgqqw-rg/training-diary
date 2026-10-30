"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findBuiltIn, isUuid, MUSCLE_KEYS, KINDS, type Muscle, type Kind } from "@/lib/exercise-catalog";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const BUCKET_URL = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/exercises/`;

// Файл «наш», только если лежит в папке этого пользователя
const isOwnFile = (url: string | null | undefined, uid: string) => !!url && url.startsWith(`${BUCKET_URL()}${uid}/`);

async function removeOwnFile(supabase: any, uid: string, url: string | null | undefined) {
  if (!isOwnFile(url, uid)) return;
  await supabase.storage.from("exercises").remove([url!.slice(BUCKET_URL().length)]);
}

// Браузер грузит файл прямо в Supabase (на Vercel тело запроса ограничено ~4,5 МБ), сервер выдаёт одноразовый доступ
export async function signUpload(kind: "image" | "video", ext: string): Promise<{ path: string; token: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  const e = String(ext).toLowerCase().replace(/^\./, "");
  const allowed = kind === "image" ? ["jpg", "jpeg", "png", "webp", "gif"] : ["mp4", "webm", "mov"];
  if (!allowed.includes(e)) return { error: `Формат .${e} не поддерживается` };
  const path = `${user.id}/${crypto.randomUUID()}.${e}`;
  const { data, error } = await supabase.storage.from("exercises").createSignedUploadUrl(path);
  if (error || !data) return { error: "Не удалось начать загрузку: " + (error?.message ?? "") };
  return { path, token: data.token };
}

type SaveResult = { error: string } | undefined;

// key: slug встроенного упражнения (свои фото/видео), uuid своего упражнения (правка) или пусто (новое)
export async function saveExercise(fd: FormData): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  const key = String(fd.get("key") ?? "").trim();
  const imageRaw = String(fd.get("image_url") ?? "").trim();
  const videoRaw = String(fd.get("video_url") ?? "").trim();

  if (imageRaw && !isOwnFile(imageRaw, user.id)) return { error: "Недопустимая ссылка на фото" };
  if (videoRaw && !isOwnFile(videoRaw, user.id) && !/^https?:\/\/\S+$/i.test(videoRaw)) {
    return { error: "Видео: загрузите файл или вставьте ссылку, которая начинается с http(s)://" };
  }
  if (videoRaw.length > 1000) return { error: "Слишком длинная ссылка" };
  const image_url = imageRaw || null;
  const video_url = videoRaw || null;

  // ----- встроенное упражнение: сохраняем только медиа -----
  const builtIn = key && !isUuid(key) ? findBuiltIn(key) : null;
  if (key && !isUuid(key) && !builtIn) return { error: "Упражнение не найдено" };
  if (builtIn) {
    const { data: old } = await supabase.from("user_exercises").select("id, image_url, video_url")
      .eq("owner_id", user.id).eq("base_key", builtIn.slug).maybeSingle();
    if (!image_url && !video_url) {
      if (old) await supabase.from("user_exercises").delete().eq("id", old.id);
    } else {
      const { error } = await supabase.from("user_exercises").upsert({
        owner_id: user.id, base_key: builtIn.slug, name: builtIn.name, muscle: builtIn.muscle,
        kind: builtIn.kind, equipment: builtIn.equip, image_url, video_url, updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id,base_key" });
      if (error) return { error: "Не удалось сохранить: " + error.message };
    }
    if (old?.image_url !== image_url) await removeOwnFile(supabase, user.id, old?.image_url);
    if (old?.video_url !== video_url) await removeOwnFile(supabase, user.id, old?.video_url);
    revalidatePath("/exercises");
    redirect(`/exercises/${builtIn.slug}`);
  }

  // ----- своё упражнение -----
  const name = String(fd.get("name") ?? "").trim();
  const muscle = String(fd.get("muscle") ?? "") as Muscle;
  const kind = String(fd.get("kind") ?? "base") as Kind;
  const equipment = String(fd.get("equipment") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  if (!name || name.length > 100) return { error: "Название — от 1 до 100 символов" };
  if (!MUSCLE_KEYS.includes(muscle)) return { error: "Выберите группу мышц" };
  if (!(kind in KINDS)) return { error: "Выберите тип упражнения" };
  if (equipment.length > 60) return { error: "Инвентарь: не больше 60 символов" };
  if (description.length > 3000) return { error: "Описание: не больше 3000 символов" };
  const row = {
    name, muscle, kind, equipment: equipment || null, description: description || null,
    image_url, video_url, updated_at: new Date().toISOString(),
  };

  let id = key;
  if (key) {
    const { data: old } = await supabase.from("user_exercises").select("image_url, video_url")
      .eq("id", key).eq("owner_id", user.id).is("base_key", null).maybeSingle();
    if (!old) return { error: "Упражнение не найдено" };
    const { error } = await supabase.from("user_exercises").update(row).eq("id", key).eq("owner_id", user.id);
    if (error) return { error: "Не удалось сохранить: " + error.message };
    if (old.image_url !== image_url) await removeOwnFile(supabase, user.id, old.image_url);
    if (old.video_url !== video_url) await removeOwnFile(supabase, user.id, old.video_url);
  } else {
    const { data, error } = await supabase.from("user_exercises")
      .insert({ ...row, owner_id: user.id }).select("id").single();
    if (error || !data) return { error: "Не удалось сохранить: " + (error?.message ?? "") };
    id = data.id;
  }
  revalidatePath("/exercises");
  redirect(`/exercises/${id}`);
}

// Своё упражнение удаляется целиком; у встроенного сбрасываются свои фото/видео
export async function deleteExercise(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) redirect("/exercises");
  const { data: row } = await supabase.from("user_exercises").select("image_url, video_url, base_key")
    .eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (row) {
    await removeOwnFile(supabase, user.id, row.image_url);
    await removeOwnFile(supabase, user.id, row.video_url);
    await supabase.from("user_exercises").delete().eq("id", id).eq("owner_id", user.id);
  }
  revalidatePath("/exercises");
  redirect(row?.base_key ? `/exercises/${row.base_key}` : "/exercises");
}
