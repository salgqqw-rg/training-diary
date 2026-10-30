import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATALOG, norm, photoUrls, type Muscle } from "@/lib/exercise-catalog";
import { loadRecords } from "@/lib/exercise-records";
import { Library, type LibItem } from "./library";

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

// «Упражнения» — библиотека: встроенный каталог + свои упражнения, поиск, рекорды
export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: mine }, records] = await Promise.all([
    supabase.from("user_exercises").select("*").eq("owner_id", user.id).order("name"),
    loadRecords(supabase, user.id),
  ]);
  const rec = (name: string) => {
    const r = records.get(norm(name));
    return r ? `рекорд ${fmt(r.best)} кг × ${r.bestReps}` : null;
  };

  const override = new Map<string, any>((mine ?? []).filter((m: any) => m.base_key).map((m: any) => [m.base_key, m]));
  const items: LibItem[] = [
    ...(mine ?? []).filter((m: any) => !m.base_key).map((m: any): LibItem => ({
      key: m.id, name: m.name, muscle: m.muscle as Muscle, kind: m.kind, equip: m.equipment ?? "",
      thumb: m.image_url, custom: true, record: rec(m.name),
    })),
    ...CATALOG.map((c): LibItem => ({
      key: c.slug, name: c.name, muscle: c.muscle, kind: c.kind, equip: c.equip,
      thumb: override.get(c.slug)?.image_url ?? (c.photo ? photoUrls(c.photo)[0] : null), custom: false, record: rec(c.name),
    })),
  ];

  return (
    <>
      <h1>Упражнения</h1>
      <p className="muted" style={{ margin: "-8px 0 16px" }}>
        Выберите упражнение из каталога или добавьте своё — с фото и видео
      </p>
      <Library items={items} />
    </>
  );
}
