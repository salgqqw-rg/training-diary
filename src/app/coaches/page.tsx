import Link from "next/link";
import { PhotoInput } from "@/components/photo-input";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { requestCoach, saveCoachProfile } from "@/lib/coach-directory-actions";
import { FORMATS, type CoachFormat } from "@/lib/coach-profile";

type Author = { display_name: string; avatar_url: string | null };
type CoachRow = {
  user_id: string; about: string; specialties: string; experience_years: number | null; photo_url: string | null; city: string;
  format: CoachFormat; price: string; author: Author | Author[] | null;
};

// подпись над полем, поля в ряд выровнены по нижнему краю
const COL = { display: "flex", flexDirection: "column", gap: 4 } as const;

const TABS = [
  { key: "find", label: "Найти тренера" },
  { key: "mine", label: "Я тренер — моя анкета" },
];

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; format?: string; error?: string; ok?: string }>;
}) {
  const { tab: tabParam, q = "", format = "", error, ok } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "find";

  const [{ data: list }, { data: mine }, { data: links }] = await Promise.all([
    supabase
      .from("coach_profiles")
      .select("user_id, about, specialties, experience_years, photo_url, city, format, price, author:profiles!coach_profiles_user_id_fkey(display_name, avatar_url)")
      .eq("listed", true)
      .neq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("coach_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("coach_links").select("coach_id, status, requested_by").eq("trainee_id", user.id),
  ]);

  const linkByCoach = new Map((links ?? []).map((l) => [l.coach_id as string, l]));
  const authorOf = (c: CoachRow) => (Array.isArray(c.author) ? c.author[0] : c.author) ?? null;

  // shortcut: фильтр в памяти по последним 200 анкетам; при сотнях тренеров перенести в запрос
  const needle = q.trim().toLowerCase();
  const coaches = ((list ?? []) as unknown as CoachRow[]).filter((c) => {
    if (format && format !== "all" && c.format !== format && c.format !== "both") return false;
    if (!needle) return true;
    return `${authorOf(c)?.display_name ?? ""} ${c.city} ${c.specialties} ${c.about}`.toLowerCase().includes(needle);
  });

  return (
    <>
      <h1>Тренеры</h1>
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      <div className="workout-subtabs" role="tablist" aria-label="Разделы">
        {TABS.map((t) => (
          <Link key={t.key} href={`/coaches?tab=${t.key}`} scroll={false} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : undefined}>{t.label}</Link>
        ))}
      </div>

      {tab === "find" && (
        <>
          <form className="row" style={{ marginBottom: 12 }}>
            <input name="q" defaultValue={q} placeholder="Имя, город, направление: похудение, силовые…" style={{ flex: 1, minWidth: 220 }} />
            <select name="format" defaultValue={format || "all"}>
              <option value="all">Любой формат</option>
              <option value="online">Онлайн</option>
              <option value="offline">Очно</option>
            </select>
            <button>Найти</button>
          </form>

          {coaches.length === 0 && (
            <p className="muted">
              {list?.length ? "Никого не нашли — попробуйте другой запрос." : "Пока ни один тренер не опубликовал анкету."}
            </p>
          )}

          {coaches.map((c) => {
            const a = authorOf(c);
            const link = linkByCoach.get(c.user_id);
            return (
              <div key={c.user_id} className="card">
                <div className="row" style={{ gap: 12, alignItems: "center" }}>
                  {(c.photo_url ?? a?.avatar_url) && (
                    <img src={(c.photo_url ?? a?.avatar_url)!} alt="" width={72} height={72} style={{ borderRadius: 12, objectFit: "cover" }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{a?.display_name ?? "Тренер"}</h3>
                    <span className="muted">
                      {c.city && `${c.city} · `}{FORMATS[c.format]}
                      {c.experience_years !== null && ` · опыт ${c.experience_years} лет`}
                      {c.price && ` · ${c.price}`}
                    </span>
                  </div>
                </div>
                {c.specialties && <p style={{ margin: "8px 0 0" }}><b>{c.specialties}</b></p>}
                {c.about && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{c.about}</p>}

                <div style={{ marginTop: 10 }}>
                  {link?.status === "active" && <span className="up">Это ваш тренер</span>}
                  {link?.status === "pending" && link.requested_by !== user.id && (
                    <span className="muted">Тренер сам пригласил вас — ответьте в разделе <Link href="/clients?tab=coaches">«Подопечные»</Link></span>
                  )}
                  {link?.status === "pending" && link.requested_by === user.id && (
                    <span className="muted">Заявка отправлена, ждём ответа тренера</span>
                  )}
                  {!link && (
                    <form action={requestCoach} className="row">
                      <input type="hidden" name="coach_id" value={c.user_id} />
                      <input name="note" maxLength={500} placeholder="Ваша цель в паре слов (необязательно)" style={{ flex: 1, minWidth: 200 }} />
                      <button className="primary">Хочу к этому тренеру</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "mine" && (
        <div className="card">
          <h3>Анкета тренера</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Видна всем вошедшим пользователям, когда включена галочка внизу. Email в каталоге не показывается:
            заявки приходят на страницу <Link href="/clients">«Подопечные»</Link>.
          </p>
          <form action={saveCoachProfile} className="stack">
            <div className="row" style={{ alignItems: "center", gap: 12 }}>
              {mine?.photo_url && (
                <img src={mine.photo_url} alt="Фото анкеты" width={72} height={72} style={{ borderRadius: 12, objectFit: "cover" }} />
              )}
              <label className="file-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                  <path d="M12 3v13" />
                  <path d="m7 10 5 5 5-5" />
                </svg>
                {mine?.photo_url ? "Заменить фото" : "Выбрать фото для каталога"}
                <PhotoInput name="photo" />
              </label>
              {mine?.photo_url && (
                <label className="row" style={{ gap: 6, alignItems: "center" }}>
                  <input type="checkbox" name="remove_photo" style={{ width: "auto" }} />
                  Удалить фото
                </label>
              )}
            </div>
            <label>О себе
              <textarea name="about" rows={5} maxLength={1500} defaultValue={mine?.about ?? ""} placeholder="Образование, подход к тренировкам, с кем работаете" />
            </label>
            <label>Направления
              <input name="specialties" maxLength={200} defaultValue={mine?.specialties ?? ""} placeholder="Похудение, набор массы, силовые" />
            </label>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <label style={COL}>Опыт, лет
                <input name="experience_years" type="number" min={0} max={60} defaultValue={mine?.experience_years ?? ""} style={{ width: 110 }} />
              </label>
              <label style={COL}>Город
                <input name="city" maxLength={60} defaultValue={mine?.city ?? ""} placeholder="Москва" style={{ width: 170 }} />
              </label>
              <label style={COL}>Формат
                <select name="format" defaultValue={mine?.format ?? "both"}>
                  {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={{ ...COL, flex: 1, minWidth: 200 }}>Стоимость
                <input name="price" maxLength={100} defaultValue={mine?.price ?? ""} placeholder="Например: от 5000 ₽ в месяц" />
              </label>
            </div>
            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="listed" defaultChecked={mine?.listed ?? false} style={{ width: "auto" }} />
              Показывать мою анкету в каталоге
            </label>
            <button className="primary">Сохранить анкету</button>
          </form>
        </div>
      )}
    </>
  );
}
