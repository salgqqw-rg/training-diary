import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Manrope, Oswald } from "next/font/google";
import { getUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { NavLink } from "@/components/nav-link";
import { LogoutIcon } from "@/components/icons";
import { TzSync } from "@/components/tz-sync";
import { UnreadWatcher } from "@/components/unread";

// Стильный геометрический шрифт приложения
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Спортивный узкий шрифт для заголовков и крупных цифр
const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Solo. — дневник тренировок", template: "%s · Solo." },
  description: "Дневник тренировок: циклы по неделям, подходы с RIR и RPE, прогресс, питание и сон, связь с тренером.",
  applicationName: "Solo.",
  appleWebApp: { capable: true, title: "Solo.", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060607",
};

// Логотип Solo. (белое слово + лаймовая точка, как акцент в former IRONLOG)
function Logo({ small }: { small?: boolean }) {
  return (
    <Link href="/" className={small ? "logo sm" : "logo"}>
      Solo<span>.</span>
    </Link>
  );
}

const NAV_MAIN = [
  { href: "/", label: "Главная" },
  { href: "/diary", label: "Дневник" },
  { href: "/exercises", label: "Упражнения" },
  { href: "/progress", label: "Прогресс" },
  { href: "/profile", label: "Профиль" },
];

// Доп. разделы (под разделителем — как «второй блок» сайдбара)
const NAV_MORE = [
  { href: "/goals", label: "Цели" },
  { href: "/daily", label: "Питание и сон" },
  { href: "/measurements", label: "Характеристики" },
  { href: "/clients", label: "Подопечные" },
  { href: "/chat", label: "Сообщения" },
  { href: "/feed", label: "Лента" },
];

// Нижняя панель табов — только на телефоне (меньше 980px)
const NAV_BOTTOM = [
  { href: "/", label: "Главная" },
  { href: "/diary", label: "Дневник" },
  { href: "/exercises", label: "Упражнения" },
  { href: "/progress", label: "Прогресс" },
  { href: "/more", label: "Ещё", also: ["/profile", ...NAV_MORE.map((n) => n.href)] },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  // Неавторизованным показываем только шапку с логотипом, без навигации.
  // Экраны входа/регистрации — полноэкранные, без шапки (макет IRONLOG).
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "";
    const bare = path === "/login" || path === "/forgot-password"
      || path.startsWith("/register") || path.startsWith("/update-password") || path.startsWith("/auth/");
    if (bare) {
      return (
        <html lang="ru" className={`${manrope.variable} ${oswald.variable}`}>
          <body>{children}</body>
        </html>
      );
    }
    return (
      <html lang="ru" className={`${manrope.variable} ${oswald.variable}`}>
        <body>
          <div className="shell">
            <aside className="side guest">
              <Logo />
            </aside>
            <main>{children}</main>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="ru" className={`${manrope.variable} ${oswald.variable}`}>
      <body>
        <TzSync />
        <UnreadWatcher />
        <div className="shell">
          <aside className="side">
            <Logo small />
            <nav>
              {NAV_MAIN.map((n) => (
                <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
              ))}
              <i className="side-div" />
              {NAV_MORE.map((n) => (
                <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
              ))}
            </nav>
            <form action={signOut} className="side-exit">
              <button><LogoutIcon />Выход</button>
            </form>
          </aside>
          <main>{children}</main>
        </div>
        <nav className="bottom-nav" aria-label="Мобильная навигация">
          {NAV_BOTTOM.map((n) => (
            <NavLink key={n.href} href={n.href} also={n.also}>{n.label}</NavLink>
          ))}
        </nav>
      </body>
    </html>
  );
}
