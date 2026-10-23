import Link from "next/link";
import { signUp, signInWithGoogle } from "@/lib/auth-actions";
import { PasswordInput } from "@/components/password-input";
import { UserIcon, MailIcon, GoogleIcon } from "@/components/icons";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="auth-solo">
      <div className="auth-center">
        <Link href="/" className="logo">
          Solo<span>.</span>
        </Link>
        {error && <p className="danger">{error}</p>}
        <h2>Создай свой аккаунт</h2>
        <form action={signUp} className="stack">
          <div className="field">
            <UserIcon className="p-ico" />
            <input name="name" required placeholder="Имя" autoComplete="name" />
          </div>
          <div className="field">
            <MailIcon className="p-ico" />
            <input name="email" type="email" required placeholder="Email" autoComplete="email" />
          </div>
          <PasswordInput name="password" minLength={6} required placeholder="Пароль" autoComplete="new-password" />
          <PasswordInput name="confirm" minLength={6} required placeholder="Подтвердите пароль" autoComplete="new-password" />
          <button className="primary">Зарегистрироваться</button>
        </form>
        <div className="or"><span>или</span></div>
        <form action={signInWithGoogle}>
          <button className="google" type="submit">
            <GoogleIcon />
            Продолжить с Google
          </button>
        </form>
        <p className="auth-alt">Уже есть аккаунт? <Link href="/login">Войти</Link></p>
      </div>
    </div>
  );
}
