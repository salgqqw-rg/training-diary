import Link from "next/link";
import { MIN_PASSWORD } from "@/lib/password";
import { signUp } from "@/lib/auth-actions";
import { PasswordInput } from "@/components/password-input";
import { UserIcon, MailIcon } from "@/components/icons";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  return (
    <div className="auth-solo auth-sharp">
      {sent && (
        <div className="mail-modal" role="dialog" aria-modal="true" aria-labelledby="mail-title">
          <div className="mail-box">
            <div className="mail-ico"><MailIcon /></div>
            <h3 id="mail-title">Проверь почту</h3>
            <p>Мы отправили письмо на <b>{sent}</b>.</p>
            <p>Открой его и нажми на ссылку, чтобы подтвердить аккаунт — после этого можно войти.</p>
            <p className="mail-hint">Письма нет? Загляни в папку «Спам».</p>
            <Link href="/login" className="mail-btn">Понятно, перейти ко входу</Link>
          </div>
        </div>
      )}
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
          <PasswordInput name="password" minLength={MIN_PASSWORD} required placeholder="Пароль" autoComplete="new-password" />
          <PasswordInput name="confirm" minLength={MIN_PASSWORD} required placeholder="Подтвердите пароль" autoComplete="new-password" />
          <label className="consent auth">
            <input type="checkbox" name="consent" required />
            <span>Я согласен(на) с <Link href="/terms" target="_blank">пользовательским соглашением</Link> и на обработку моих персональных данных</span>
          </label>
          <button className="primary">Зарегистрироваться</button>
        </form>
        <p className="auth-alt">Уже есть аккаунт? <Link href="/login">Войти</Link></p>
      </div>
    </div>
  );
}
