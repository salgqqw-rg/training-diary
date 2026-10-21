import { signIn, signUp } from "@/lib/auth-actions";

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
        <input name="password" type="password" required placeholder="Пароль" />
        <button className="primary">Войти</button>
      </form>
      <h2>Регистрация</h2>
      <form action={signUp} className="stack">
        <input name="name" required placeholder="Имя (будет видно в ленте)" />
        <input name="email" type="email" required placeholder="Email" />
        <input name="password" type="password" minLength={6} required placeholder="Пароль (от 6 символов)" />
        <button className="primary">Создать аккаунт</button>
      </form>
    </div>
  );
}
