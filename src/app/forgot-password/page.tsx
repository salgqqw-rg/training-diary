import Link from "next/link";
import { resetPassword } from "@/lib/auth-actions";
import { MailIcon } from "@/components/icons";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <div className="auth-solo">
      <div className="auth-center">
        <Link href="/" className="logo">
          Solo<span>.</span>
        </Link>
        <h2>Восстановить пароль</h2>
        {sent ? (
          <>
            <p className="auth-sub">Ссылка для сброса отправлена. Проверь почту и папку «Спам».</p>
            <p className="auth-alt"><Link href="/login">← Вернуться ко входу</Link></p>
          </>
        ) : (
          <form action={resetPassword} className="stack">
            <div className="field">
              <MailIcon className="p-ico" />
              <input name="email" type="email" required placeholder="Email" autoComplete="email" />
            </div>
            <button className="primary">Отправить ссылку</button>
          </form>
        )}
      </div>
    </div>
  );
}
