"use client";

import { useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { MUSCLES, MUSCLE_KEYS, KINDS } from "@/lib/exercise-catalog";
import { saveExercise, signUpload } from "@/lib/exercise-actions";

export type FormDefaults = {
  key: string; // slug встроенного, uuid своего или "" для нового
  name: string;
  muscle: string;
  kind: string;
  equipment: string;
  description: string;
  image_url: string;
  video_url: string;
};

const MB = 1024 * 1024;

// mediaOnly — для встроенного упражнения: меняются только своё фото и видео
export function ExerciseForm({ defaults, mediaOnly = false, submitText = "Сохранить" }: {
  defaults: FormDefaults; mediaOnly?: boolean; submitText?: string;
}) {
  const [image, setImage] = useState(defaults.image_url);
  const [video, setVideo] = useState(defaults.video_url);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, start] = useTransition();

  async function upload(kind: "image" | "video", file: File | undefined) {
    if (!file) return;
    setError("");
    const limit = kind === "image" ? 10 * MB : 50 * MB;
    if (file.size > limit) return setError(`Файл больше ${limit / MB} МБ`);
    setBusy(kind === "image" ? "Загружаю фото…" : "Загружаю видео…");
    try {
      const ext = file.name.split(".").pop() ?? "";
      const signed = await signUpload(kind, ext);
      if ("error" in signed) return setError(signed.error);
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error: upErr } = await sb.storage.from("exercises").uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) return setError("Не удалось загрузить файл: " + upErr.message);
      const url = sb.storage.from("exercises").getPublicUrl(signed.path).data.publicUrl;
      kind === "image" ? setImage(url) : setVideo(url);
    } finally {
      setBusy("");
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("image_url", image);
    fd.set("video_url", video);
    setError("");
    start(async () => {
      const res = await saveExercise(fd); // при успехе сервер сам перенаправит на страницу упражнения
      if (res?.error) setError(res.error);
    });
  }

  const own = (u: string) => u.includes("/storage/v1/object/public/exercises/");

  return (
    <form onSubmit={submit} className="lib-form">
      <input type="hidden" name="key" value={defaults.key} />
      {!mediaOnly && (
        <>
          <label>Название
            <input name="name" required maxLength={100} defaultValue={defaults.name} placeholder="Например, тяга гантели в наклоне" />
          </label>
          <div className="row">
            <label style={{ flex: 1, minWidth: 150 }}>Группа мышц
              <select name="muscle" defaultValue={defaults.muscle || "chest"}>
                {MUSCLE_KEYS.map((m) => <option key={m} value={m}>{MUSCLES[m]}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 150 }}>Тип
              <select name="kind" defaultValue={defaults.kind || "base"}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 150 }}>Инвентарь
              <input name="equipment" maxLength={60} defaultValue={defaults.equipment} placeholder="Гантели, штанга…" />
            </label>
          </div>
          <label>Как выполнять
            <textarea name="description" rows={4} maxLength={3000} defaultValue={defaults.description} placeholder="Исходное положение, движение, на что обратить внимание" />
          </label>
        </>
      )}

      <div className="lib-media-edit">
        <div>
          <span className="lib-cap">Фото</span>
          {image && <img src={image} alt="" className="lib-thumb" />}
          <div className="row">
            <label className="btn-file">
              {image ? "Заменить фото" : "Загрузить фото"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { upload("image", e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {image && <button type="button" className="sm danger" onClick={() => setImage("")}>Убрать</button>}
          </div>
        </div>
        <div>
          <span className="lib-cap">Видео</span>
          {video && own(video) && <video src={video} controls preload="metadata" className="lib-thumb" />}
          <div className="row">
            <label className="btn-file">
              {video && own(video) ? "Заменить видео" : "Загрузить видео"}
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => { upload("video", e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {video && <button type="button" className="sm danger" onClick={() => setVideo("")}>Убрать</button>}
          </div>
          {!own(video) && (
            <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="или ссылка: YouTube, RuTube, mp4" style={{ marginTop: 8 }} />
          )}
          <small className="muted">Файл — до 50 МБ (mp4, webm, mov). Фото — до 10 МБ.</small>
        </div>
      </div>

      {(error || busy) && <p className={error ? "lib-err" : "muted"} role="status">{error || busy}</p>}
      <button className="primary" disabled={pending || !!busy}>{pending ? "Сохраняю…" : submitText}</button>
    </form>
  );
}
