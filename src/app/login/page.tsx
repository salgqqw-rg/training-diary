import Link from "next/link";
import { signIn, signInWithGoogle } from "@/lib/auth-actions";
import { PasswordInput } from "@/components/password-input";
import { UserIcon, CalendarIcon, CheckSquareIcon, BoltIcon, GoogleIcon } from "@/components/icons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="auth-split">
      <section className="auth-hero">
        <Link href="/" className="logo">
          IRON<span>LOG</span>
        </Link>
        <h1>Твой прогресс —<br />в твоих руках</h1>
        <ul className="feat">
          <li><span className="ico"><CalendarIcon /></span>Планируй тренировки</li>
          <li><span className="ico"><CheckSquareIcon /></span>Отслеживай прогресс</li>
          <li><span className="ico"><BoltIcon /></span>Становись сильнее</li>
        </ul>
        <p className="auth-foot">Больше, чем просто дневник.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {error && <p className="danger">{error}</p>}
          <h2>Вход</h2>
          <p className="auth-sub">С возвращением, чемпион!</p>
          <form action={signIn} className="stack">
            <div className="field">
              <UserIcon className="p-ico" />
              <input name="email" type="email" required placeholder="Email или логин" autoComplete="email" />
            </div>
            <PasswordInput name="password" required placeholder="Пароль" autoComplete="current-password" />
            <button className="primary">Войти</button>
          </form>
          <div className="auth-check-row">
            <label className="check"><input type="checkbox" name="remember" defaultChecked />Запомнить меня</label>
            <a href="/forgot-password" className="auth-footlink">Забыли пароль?</a>
          </div>
          <div className="or"><span>или</span></div>
          <form action={signInWithGoogle}>
            <button className="google" type="submit">
              <GoogleIcon />
              Войти через Google
            </button>
          </form>
          <p className="auth-alt">Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
        </div>
      </section>
    </div>
  );
}
