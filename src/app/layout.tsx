import "./globals.css";
import Link from "next/link";
import { headers } from "next/headers";
import { Manrope } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth-actions";
import { NavLink } from "@/components/nav-link";

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

const NAV = [
  { href: "/", label: "Тренировочные планы" },
  { href: "/goals", label: "Цели" },
  { href: "/daily", label: "Питание и сон" },
  { href: "/measurements", label: "Характеристики" },
  { href: "/clients", label: "Подопечные" },
  { href: "/chat", label: "Сообщения" },
  { href: "/feed", label: "Лента" },
  { href: "/profile", label: "Профиль" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Неавторизованным показываем только шапку с логотипом, без навигации.
  // Экраны входа/регистрации — полноэкранные, без шапки (макет IRONLOG).
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "";
    const bare = path === "/login" || path.startsWith("/register");
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
              {NAV.map((n) => (
                <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
              ))}
            </nav>
            <form action={signOut} className="side-exit">
              <button>Выход</button>
            </form>
          </aside>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
