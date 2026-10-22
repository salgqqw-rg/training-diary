import "./globals.css";
import Link from "next/link";
import { Inter, Unbounded } from "next/font/google";
import { createClient } from "@/lib/supabase/server";

// Шрифты в стиле reckful: Inter для текста, Unbounded для заголовков.
// next/font скачивает их один раз на билде и отдаёт со своего домена.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-unbounded",
  display: "swap",
});

export const metadata = { title: "Дневник тренировок" };

// Тексты бегущей строки в зелёной ленте сверху (как промо-лента reckful)
const TICKER = [
  "Записывай каждую тренировку",
  "Следи за прогрессом",
  "Питание, сон и замеры под контролем",
  "Стать сильнее — это цель",
];

function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <span className="ticker-group" key={copy}>
            {TICKER.map((t, i) => (
              <span key={i}>{t}&nbsp;&nbsp;✦</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Неавторизованным показываем только название, без навигации
  if (!user) {
    return (
      <html lang="ru" className={`${inter.variable} ${unbounded.variable}`}>
        <body>
          <Ticker />
          <header className="topbar"><span className="logo">Дневник тренировок</span></header>
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
    <html lang="ru" className={`${inter.variable} ${unbounded.variable}`}>
      <body>
        <Ticker />
        <header className="topbar">
          <Link href="/" className="logo">Дневник тренировок</Link>
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
