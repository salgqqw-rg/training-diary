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
  "/more": <ListIcon />,
};

export function NavLink({ href, children, also = [] }: { href: string; children: React.ReactNode; also?: string[] }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : [href, ...also].some((p) => pathname.startsWith(p));
  return (
    <Link href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
      {ICONS[href] ?? null}
      <span>{children}</span>
    </Link>
  );
}
