import "./globals.css";
import Link from "next/link";
import { Manrope, Unbounded } from "next/font/google";
import { createClient } from "@/lib/supabase/server";

// Шрифты: Manrope для текста и заголовков (сборно-геометрический, как в фитнес-макетах),
// Unbounded для логотипа IRONLOG.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-unbounded",
  display: "swap",
});

export const metadata = { title: "IRONLOG" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Неавторизованным показываем только название, без навигации
  if (!user) {
    return (
      <html lang="ru" className={`${manrope.variable} ${unbounded.variable}`}>
        <body>
          <header className="topbar"><span className="logo">IRONLOG</span></header>
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
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="logo">IRONLOG</Link>
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
