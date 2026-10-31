import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth-actions";
import {
  BarsIcon, UserIcon, TargetIcon, FlameIcon, RulerIcon, UsersIcon, MessageIcon, ListIcon, LogoutIcon,
} from "@/components/icons";

// «Ещё» — разделы, которым не хватило места в нижней панели телефона
const LINKS = [
  { href: "/stats", label: "Статистика", icon: <BarsIcon /> },
  { href: "/goals", label: "Цели", icon: <TargetIcon /> },
  { href: "/daily", label: "Питание и сон", icon: <FlameIcon /> },
  { href: "/measurements", label: "Характеристики", icon: <RulerIcon /> },
  { href: "/chat", label: "Сообщения", icon: <MessageIcon /> },
  { href: "/clients", label: "Подопечные", icon: <UsersIcon /> },
  { href: "/feed", label: "Лента", icon: <ListIcon /> },
  { href: "/profile", label: "Профиль", icon: <UserIcon /> },
];

export default async function MorePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
  if (!user) redirect("/login");

  return (
    <>
      <h1>Ещё</h1>
      <div className="more-grid">
        {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.icon}{l.label}</Link>)}
      </div>
      <form action={signOut} className="more-exit">
        <button><LogoutIcon /> Выйти из аккаунта</button>
      </form>
    </>
  );
}
