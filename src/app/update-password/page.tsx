import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/lib/auth-actions";
import { PasswordInput } from "@/components/password-input";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=" + encodeURIComponent("Ссылка устарела — запроси письмо заново"));
  }

  return (
    <div className="auth-solo">
      <div className="auth-center">
        <Link href="/" className="logo">
          Solo<span>.</span>
        </Link>
        {error && <p className="danger">{error}</p>}
        <h2>Новый пароль</h2>
        <form action={updatePassword} className="stack">
          <PasswordInput name="password" minLength={6} required placeholder="Пароль" autoComplete="new-password" />
          <PasswordInput name="confirm" minLength={6} required placeholder="Подтвердите пароль" autoComplete="new-password" />
          <button className="primary">Сохранить</button>
        </form>
      </div>
    </div>
  );
}
