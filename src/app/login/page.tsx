import { signIn, signUp, signInWithGoogle } from "@/lib/auth-actions";
import { PasswordInput } from "@/components/password-input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="card narrow">
      {error && <p className="danger">{error}</p>}
      <h2>Вход</h2>
      <form action={signIn} className="stack">
        <input name="email" type="email" required placeholder="Email" />
        <PasswordInput name="password" required placeholder="Пароль" />
        <button className="primary">Войти</button>
      </form>
      <h2>Регистрация</h2>
      <form action={signUp} className="stack">
        <input name="name" required placeholder="Имя (будет видно в ленте)" />
        <input name="email" type="email" required placeholder="Email" />
        <PasswordInput name="password" minLength={6} required placeholder="Пароль (от 6 символов)" />
        <button className="primary">Создать аккаунт</button>
      </form>

      <div className="or"><span>или</span></div>
      <form action={signInWithGoogle}>
        <button className="google" type="submit">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3.02h3.87c2.26-2.08 3.57-5.15 3.57-8.84z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.89l-3.87-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.12A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.6H1.29a12 12 0 0 0 0 10.8l3.98-3.12z" />
            <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.75 11.75 0 0 0 12 0 12 12 0 0 0 1.29 6.6l3.98 3.12C6.22 6.86 8.87 4.75 12 4.75z" />
          </svg>
          Войти через Google
        </button>
      </form>
    </div>
  );
}
