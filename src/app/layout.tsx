import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Дневник тренировок" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="topbar">
          <Link href="/"><b>🏋️ Дневник тренировок</b></Link>
          <nav>
            <Link href="/">Кабинет</Link>
            <Link href="/feed">Лента</Link>
            <Link href="/login">Вход</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
