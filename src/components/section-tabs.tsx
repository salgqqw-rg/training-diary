"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Подразделы меню: на странице из группы сверху показываются вкладки всей группы.
// Вложенные адреса (например /exercises/squat) вкладок не показывают — у них свой заголовок.
const GROUPS = [
  [{ href: "/diary", label: "Программы" }, { href: "/exercises", label: "Упражнения" }, { href: "/feed", label: "Лента программ" }],
  [{ href: "/measurements", label: "Характеристики" }, { href: "/goals", label: "Цели" }],
  [{ href: "/chat", label: "Сообщения" }, { href: "/coaches", label: "Тренеры" }, { href: "/clients", label: "Подопечные" }],
];

export function SectionTabs() {
  const pathname = usePathname();
  const tabs = GROUPS.find((g) => g.some((t) => t.href === pathname));
  if (!tabs) return null;
  return (
    <nav className="sec-tabs" aria-label="Подразделы">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === pathname ? "on" : undefined} aria-current={t.href === pathname ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
