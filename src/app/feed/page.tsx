import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, weeks_count, profiles(display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <h1>Публичная лента</h1>
      {(cycles ?? []).map((c) => {
        const author = Array.isArray(c.profiles) ? c.profiles[0]?.display_name : (c.profiles as { display_name?: string } | null)?.display_name;
        return (
          <Link key={c.id} href={`/cycles/${c.id}`} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <b>{c.name}</b> <span className="muted">— {author ?? "аноним"}, {c.weeks_count} нед.</span>
          </Link>
        );
      })}
      {!cycles?.length && <p className="muted">Публичных циклов пока нет</p>}
    </>
  );
}
