import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Manrope, Oswald } from "next/font/google";
import { getUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { NavLink } from "@/components/nav-link";
import { LogoutIcon, BoltIcon, DumbbellIcon } from "@/components/icons";
import { SectionTabs } from "@/components/section-tabs";
import { createClient } from "@/lib/supabase/server";
import { TzSync } from "@/components/tz-sync";
import { UnreadWatcher } from "@/components/unread";
import { isLove } from "@/lib/love";

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

// Сайдбар: шесть разделов. Подразделы открываются вкладками внутри (SectionTabs).
const NAV = [
  { href: "/", label: "Главная" },
  { href: "/diary", label: "Тренировки", also: ["/exercises", "/feed", "/cycles"], icon: <DumbbellIcon /> },
  { href: "/progress", label: "Прогресс" },
  { href: "/daily", label: "Питание и сон" },
  { href: "/measurements", label: "Тело и цели", also: ["/goals"] },
  { href: "/chat", label: "Тренер и чат", also: ["/coaches", "/clients"] },
];

// Нижняя панель телефона (меньше 980px): четыре раздела и крупная кнопка «Старт» по центру.
// Всё остальное (прогресс, тело, чат, профиль) собрано на странице «Ещё».
const NAV_BOTTOM = [
  { href: "/", label: "Главная" },
  { href: "/diary", label: "Тренировки", also: ["/exercises", "/feed", "/cycles"], icon: <DumbbellIcon /> },
  { href: "/daily", label: "Питание и сон" },
  { href: "/more", label: "Ещё", also: ["/progress", "/measurements", "/goals", "/chat", "/coaches", "/clients", "/profile"] },
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

  const love = isLove(user.email);

  // Имя для карточки пользователя и адрес кнопки «Начать тренировку» (последняя программа)
  const supabase = await createClient();
  const [{ data: profile }, { data: lastCycle }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("cycles").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const name = profile?.display_name || user.email?.split("@")[0] || "Профиль";
  const startHref = lastCycle ? `/cycles/${lastCycle.id}` : "/diary";

  return (
    <html lang="ru" className={`${manrope.variable} ${oswald.variable}`} data-theme={love ? "love" : undefined}>
      <body>
        {love && (
          <div className="hearts" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <span key={i}>♥</span>)}
          </div>
        )}
        <TzSync />
        <UnreadWatcher />
        <div className="shell">
          <aside className="side">
            <Logo small />
            <Link href={startHref} className="side-cta"><BoltIcon />Начать тренировку</Link>
            <nav>
              {NAV.map((n) => (
                <NavLink key={n.href} href={n.href} also={n.also} icon={n.icon}>{n.label}</NavLink>
              ))}
            </nav>
            <div className="side-me">
              <Link href="/profile" className="me-link" aria-label="Профиль">
                <span className="me-av" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
                <span className="me-who"><b>{name}</b><small>Профиль</small></span>
              </Link>
              <form action={signOut} className="side-exit">
                <button aria-label="Выйти"><LogoutIcon /></button>
              </form>
            </div>
          </aside>
          <main><SectionTabs />{children}</main>
        </div>
        <nav className="bottom-nav" aria-label="Мобильная навигация">
          {NAV_BOTTOM.slice(0, 2).map((n) => (
            <NavLink key={n.href} href={n.href} also={n.also} icon={n.icon}>{n.label}</NavLink>
          ))}
          <Link href={startHref} className="bn-start" aria-label="Начать тренировку"><BoltIcon /></Link>
          {NAV_BOTTOM.slice(2).map((n) => (
            <NavLink key={n.href} href={n.href} also={n.also}>{n.label}</NavLink>
          ))}
        </nav>
      </body>
    </html>
  );
}
