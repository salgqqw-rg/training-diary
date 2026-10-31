import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  findBuiltIn, isUuid, norm, photoUrls, videoView, MUSCLES, KINDS, type Muscle,
} from "@/lib/exercise-catalog";
import { loadRecords } from "@/lib/exercise-records";
import { deleteExercise } from "@/lib/exercise-actions";
import { MuscleMap } from "@/components/muscle-map";
import { ExerciseForm } from "../exercise-form";

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

export default async function ExercisePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
  if (!user) redirect("/login");

  const builtIn = isUuid(key) ? null : findBuiltIn(key);
  let row: any = null;
  if (builtIn) {
    ({ data: row } = await supabase.from("user_exercises").select("*")
      .eq("owner_id", user.id).eq("base_key", builtIn.slug).maybeSingle());
  } else if (isUuid(key)) {
    ({ data: row } = await supabase.from("user_exercises").select("*")
      .eq("id", key).eq("owner_id", user.id).is("base_key", null).maybeSingle());
  }
  if (!builtIn && !row) notFound();

  const name: string = builtIn?.name ?? row.name;
  const muscle: Muscle = builtIn?.muscle ?? row.muscle;
  const also = builtIn?.also ?? [];
  const kind = builtIn?.kind ?? row.kind;
  const equip: string = builtIn?.equip ?? row.equipment ?? "";
  const steps = builtIn?.steps ?? [];
  const imageUrl: string | null = row?.image_url ?? null;
  const video = videoView(row?.video_url);
  const photos = imageUrl ? [imageUrl] : builtIn?.photo ? photoUrls(builtIn.photo) : [];
  const rec = (await loadRecords(supabase, user.id)).get(norm(name));
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " техника выполнения")}`;

  return (
    <>
      <p style={{ margin: "0 0 6px" }}><Link href="/exercises" className="muted">← Все упражнения</Link></p>
      <h1>{name}</h1>
      <div className="lib-tags">
        <span>{MUSCLES[muscle]}</span>
        {also.map((m) => <span key={m} className="dim">{MUSCLES[m]}</span>)}
        <span>{KINDS[kind as "base" | "isolation"]}</span>
        {equip && <span>{equip}</span>}
        {!builtIn && <span className="own">Своё</span>}
      </div>

      <section className="card lib-detail">
        <MuscleMap main={muscle} also={also} />
        <div className="lib-media">
          {video?.kind === "iframe" && (
            <div className="lib-video"><iframe src={video.src} title={`Видео: ${name}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
          )}
          {video?.kind === "file" && <video className="lib-video" src={video.src} controls preload="metadata" />}
          {video?.kind === "link" && <p><a href={video.src} target="_blank" rel="noopener noreferrer">▶ Открыть видео</a></p>}
          {builtIn?.image && !imageUrl && (
            <img className="lib-art" src={builtIn.image} alt={`Схема: ${name}`} loading="lazy" />
          )}
          {photos.length > 0 && (
            <div className={`lib-photos${photos.length > 1 ? " two" : ""}`}>
              {photos.map((p) => <img key={p} src={p} alt={`${name}`} loading="lazy" />)}
            </div>
          )}
          {!video && (
            <p className="muted lib-hint">
              Видео пока нет. <a href={ytSearch} target="_blank" rel="noopener noreferrer">Найти технику на YouTube</a> или добавьте своё ниже.
            </p>
          )}
        </div>
      </section>

      {(builtIn?.about || builtIn?.target) && (
        <section className="card">
          <h2>Что даёт</h2>
          {builtIn.about && <p style={{ margin: "0 0 10px" }}>{builtIn.about}</p>}
          {builtIn.target && <p className="muted" style={{ margin: "0 0 6px" }}><b>Работают:</b> {builtIn.target}</p>}
          {builtIn.sports && <p className="muted" style={{ margin: 0 }}><b>Полезно для:</b> {builtIn.sports}</p>}
        </section>
      )}

      {(steps.length > 0 || row?.description || builtIn?.tip) && (
        <section className="card">
          <h2>Инструкция</h2>
          {steps.length > 0 && <ol className="lib-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
          {row?.description && !builtIn && <p style={{ whiteSpace: "pre-wrap" }}>{row.description}</p>}
          {builtIn?.tip && <p className="lib-tip"><b>Советы.</b> {builtIn.tip}</p>}
          {builtIn?.usage && <p className="muted" style={{ margin: "12px 0 0" }}><b>В тренировке:</b> {builtIn.usage}</p>}
        </section>
      )}

      <section className="card">
        <h2>Мои подходы</h2>
        {rec ? (
          <p>
            Рекорд: <b>{fmt(rec.best)} кг × {rec.bestReps}</b> · {rec.sets} подход. · последний {rec.last}{" "}
            <Link href={`/progress?ex=${encodeURIComponent(name)}`}>Прогресс →</Link>
          </p>
        ) : (
          <p className="muted">Пока нет записей. Добавьте «{name}» в тренировку в <Link href="/diary">Дневнике</Link>.</p>
        )}
      </section>

      <section className="card">
        <details>
          <summary>{builtIn ? "Свои фото и видео" : "Редактировать упражнение"}</summary>
          <ExerciseForm
            mediaOnly={!!builtIn}
            defaults={{
              key, name, muscle, kind, equipment: equip, description: row?.description ?? "",
              image_url: imageUrl ?? "", video_url: row?.video_url ?? "",
            }}
          />
        </details>
        {row && (
          <form action={deleteExercise} style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={row.id} />
            <button className="sm danger">{builtIn ? "Вернуть стандартные фото" : "Удалить упражнение"}</button>
          </form>
        )}
      </section>
    </>
  );
}
