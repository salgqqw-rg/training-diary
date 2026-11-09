import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";
import {
  FlameIcon, RulerIcon, TargetIcon, MessageIcon, UsersIcon, AwardIcon, UserIcon, LogoutIcon,
} from "@/components/icons";
import { UnreadBadge } from "@/components/unread";

// «Ещё» на телефоне: разделы, которым не хватило места в нижней панели (те же, что в меню на компьютере)
const LINKS = [
  { href: "/daily", label: "Питание и сон", hint: "БЖУ, шаги, сон", icon: <FlameIcon /> },
  { href: "/measurements", label: "Характеристики", hint: "Замеры и фото формы", icon: <RulerIcon /> },
  { href: "/goals", label: "Цели", hint: "Что и к какому сроку", icon: <TargetIcon /> },
  { href: "/chat", label: "Сообщения", hint: "Тренер и подопечные", icon: <MessageIcon /> },
  { href: "/coaches", label: "Тренеры", hint: "Найти тренера", icon: <AwardIcon /> },
  { href: "/clients", label: "Подопечные", hint: "Заявки и циклы", icon: <UsersIcon /> },
];

export default async function MorePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = profile?.display_name || user.email?.split("@")[0] || "Профиль";

  return (
    <>
      <h1>Ещё</h1>
      <Link href="/profile" className="more-me">
        <span className="me-av" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <span className="me-who"><b>{name}</b><small>Профиль, пароль, экспорт данных</small></span>
        <UserIcon />
      </Link>
      <div className="more-list">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            <span className="ico">{l.icon}</span>
            <span className="more-t"><b>{l.label}</b><small>{l.hint}</small></span>
            {l.href === "/chat" && <UnreadBadge />}
          </Link>
        ))}
      </div>
      <form action={signOut} className="more-exit">
        <button><LogoutIcon /> Выйти из аккаунта</button>
      </form>
    </>
  );
}
