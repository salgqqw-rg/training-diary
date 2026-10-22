import "./globals.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Дневник тренировок" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Неавторизованным показываем только название, без навигации
  if (!user) {
    return (
      <html lang="ru">
        <body>
          <header className="topbar"><b>Дневник тренировок</b></header>
          <main>{children}</main>
        </body>
      </html>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const avatar = profile?.avatar_url ?? null;
  const name = profile?.display_name ?? "";

  return (
    <html lang="ru">
      <body>
        <header className="topbar">
          <Link href="/"><b>Дневник тренировок</b></Link>
          <nav>
            <Link href="/">Кабинет</Link>
            <Link href="/goals">Цели</Link>
            <Link href="/daily">Питание и сон</Link>
            <Link href="/measurements">Характеристики</Link>
            <Link href="/clients">Подопечные</Link>
            <Link href="/chat">Сообщения</Link>
            <Link href="/feed">Лента</Link>
            <Link href="/profile">Профиль</Link>
            {avatar
              ? <img src={avatar} alt={name} className="avatar sm" />
              : <span className="avatar sm placeholder">{name.charAt(0).toUpperCase() || "?"}</span>}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
