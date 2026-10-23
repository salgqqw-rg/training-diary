import "./globals.css";
import Link from "next/link";
import { headers } from "next/headers";
import { Manrope } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth-actions";
import { NavLink } from "@/components/nav-link";
import { LogoutIcon } from "@/components/icons";

// Стильный геометрический шрифт приложения
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata = { title: "IRONLOG" };

// Логотип IRON + LOG (как в макете: белая + зелёная наклонная часть)
function Logo({ small }: { small?: boolean }) {
  return (
    <Link href="/" className={small ? "logo sm" : "logo"}>
      IRON<span>LOG</span>
    </Link>
  );
}

const NAV_MAIN = [
  { href: "/", label: "Главная" },
  { href: "/diary", label: "Дневник" },
  { href: "/exercises", label: "Упражнения" },
  { href: "/progress", label: "Прогресс" },
  { href: "/stats", label: "Статистика" },
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
  { href: "/progress", label: "Прогресс" },
  { href: "/chat", label: "Чат" },
  { href: "/profile", label: "Профиль" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Неавторизованным показываем только шапку с логотипом, без навигации.
  // Экраны входа/регистрации — полноэкранные, без шапки (макет IRONLOG).
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "";
    const bare = path === "/login" || path === "/forgot-password" || path.startsWith("/register") || path.startsWith("/update-password");
    if (bare) {
      return (
        <html lang="ru" className={manrope.variable}>
          <body>{children}</body>
        </html>
      );
    }
    return (
      <html lang="ru" className={manrope.variable}>
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
    <html lang="ru" className={manrope.variable}>
      <body>
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
            <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
          ))}
        </nav>
      </body>
    </html>
  );
}
