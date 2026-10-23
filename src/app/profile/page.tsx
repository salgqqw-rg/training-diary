import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, changeEmail, changePassword, deleteAccount } from "@/lib/profile-actions";
import { PasswordInput } from "@/components/password-input";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const name = String(profile?.display_name ?? "");
  const email = profile?.email ?? user.email ?? "";
  const avatar = profile?.avatar_url ?? null;

  return (
    <>
      <h1>Профиль</h1>
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      <div className="card profile-head">
        {avatar
          ? <img src={avatar} alt="Аватар" className="avatar big" />
          : <div className="avatar big placeholder">{name.charAt(0).toUpperCase() || "?"}</div>}
        <div>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <p className="muted" style={{ margin: 0 }}>{email}</p>
        </div>
      </div>

      <div className="card">
        <h3>Имя и фото</h3>
        <form action={updateProfile} className="stack">
          <label>
            Имя
            <input name="name" defaultValue={name} placeholder="Как вас видят другие" style={{ width: "100%" }} />
          </label>
          <label className="file-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              <path d="M12 3v13" />
              <path d="m7 10 5 5 5-5" />
            </svg>
            Выбрать фото
            <input name="avatar" type="file" accept="image/*" />
          </label>
          <p className="muted" style={{ fontSize: 12, margin: "5px 0 10px" }}>До 5 МБ</p>
          <button className="primary">Сохранить</button>
        </form>
      </div>

      <div className="card">
        <h3>Сменить email</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          На новый адрес придёт письмо — подтвердите смену по ссылке. До подтверждения вход остаётся по текущему email.
        </p>
        <form action={changeEmail} className="row">
          <input name="email" type="email" required defaultValue={email} style={{ flex: 1, minWidth: 220 }} />
          <button>Сохранить email</button>
        </form>
      </div>

      <div className="card">
        <h3>Сменить пароль</h3>
        <form action={changePassword} className="stack">
          <PasswordInput name="password" minLength={6} required placeholder="Новый пароль (от 6 символов)" />
          <button className="primary">Сменить пароль</button>
        </form>
      </div>

      <div className="card">
        <h3 className="danger">Удаление аккаунта</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Будут безвозвратно удалены все циклы, тренировки, замеры, фото формы и связи с тренерами. Отменить нельзя.
          Для подтверждения введите слово УДАЛИТЬ заглавными буквами.
        </p>
        <form action={deleteAccount} className="row">
          <input name="confirm" required placeholder="УДАЛИТЬ" pattern="УДАЛИТЬ" style={{ width: 160 }} />
          <button className="danger">Удалить аккаунт</button>
        </form>
      </div>
    </>
  );
}
