"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon, BookIcon, DumbbellIcon, TrendIcon, BarsIcon, UserIcon,
  TargetIcon, FlameIcon, RulerIcon, UsersIcon, MessageIcon, ListIcon,
} from "@/components/icons";

// Иконка пункта меню подбирается по адресу (как в макете IRONLOG)
const ICONS: Record<string, React.ReactNode> = {
  "/": <HomeIcon />,
  "/diary": <BookIcon />,
  "/exercises": <DumbbellIcon />,
  "/progress": <TrendIcon />,
  "/stats": <BarsIcon />,
  "/profile": <UserIcon />,
  "/goals": <TargetIcon />,
  "/daily": <FlameIcon />,
  "/measurements": <RulerIcon />,
  "/clients": <UsersIcon />,
  "/chat": <MessageIcon />,
  "/feed": <ListIcon />,
};

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} className={active ? "active" : undefined}>
      {ICONS[href] ?? null}
      <span>{children}</span>
    </Link>
  );
}
