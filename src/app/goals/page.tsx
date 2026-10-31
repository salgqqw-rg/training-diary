import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resetPlan } from "@/lib/goal-actions";
import { ACTIVITY, GOALS } from "@/lib/nutrition";
import { loadPlan } from "@/lib/nutrition-target";
import { PlanForm, type PlanDefaults } from "./plan-form";

const n1 = (v: number, d = 1) => v.toLocaleString("ru-RU", { maximumFractionDigits: d });

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; error?: string; ok?: string }>;
}) {
  const { user: targetParam, error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
  if (!user) redirect("/login");

  // Своя цель или цель подопечного (?user=)
  const targetId = targetParam ?? user.id;
  const isSelf = targetId === user.id;
  if (!isSelf) {
    const { data: link } = await supabase
      .from("coach_links")
      .select("id")
      .eq("coach_id", user.id)
      .eq("trainee_id", targetId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) redirect("/clients?error=" + encodeURIComponent("Цели доступны только для ваших подопечных"));
  }

  const target = isSelf
    ? { display_name: null }
    : (await supabase.from("profiles").select("display_name").eq("id", targetId).maybeSingle()).data;

  const data = await loadPlan(supabase, targetId);

  // Подставляем последний замер, чтобы анкету не заполнять с нуля
  const { data: lastM } = isSelf && !data
    ? await supabase.from("measurements").select("weight, height").eq("user_id", targetId)
        .order("month", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const defaults: PlanDefaults = data
    ? {
        goal: data.plan.goal, sex: data.plan.sex, birthDate: data.plan.birth_date,
        heightCm: String(Number(data.plan.height_cm)), weightKg: String(data.currentWeight),
        goalWeightKg: String(Number(data.plan.goal_weight_kg)), activity: data.plan.activity,
        pace: Number(data.plan.pace_kg_week) || 0.5,
      }
    : {
        goal: "lose", sex: "male", birthDate: "",
        heightCm: lastM?.height ? String(Number(lastM.height)) : "",
        weightKg: lastM?.weight ? String(Number(lastM.weight)) : "",
        goalWeightKg: "", activity: "moderate", pace: 0.5,
      };

  const res = data?.result ?? null;
  let progress = 0;
  if (data && data.plan.goal !== "maintain") {
    const start = Number(data.plan.start_weight_kg);
    const total = data.goalWeight - start;
    progress = data.reached ? 100 : total === 0 ? 0 : Math.max(0, Math.min(100, ((data.currentWeight - start) / total) * 100));
  }
  const eta = res?.weeks
    ? new Date(Date.now() + res.weeks * 7 * 864e5).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <>
      <h1>Цели</h1>
      {!isSelf && <p className="muted">Цель: <b>{target?.display_name ?? "подопечный"}</b> · режим просмотра</p>}
      {!isSelf && <p><Link href="/clients">← к подопечным</Link></p>}
      {error && <p className="danger">{error}</p>}
      {ok && <p className="up">{ok}</p>}

      {data && res && (
        <>
          <div className="card plan-hero">
            <div>
              <span className="plan-goal">{data.reached ? "Цель достигнута" : GOALS[data.plan.goal]}</span>
              <div className="plan-kcal">{n1(res.kcal, 0)}<small> ккал в день</small></div>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                {data.reached
                  ? "Вы дошли до желаемого веса — норма пересчитана на поддержание."
                  : data.plan.goal === "maintain"
                    ? "Норма для поддержания текущего веса."
                    : `${res.deltaKcal < 0 ? "Дефицит" : "Профицит"} ${Math.abs(res.deltaKcal)} ккал относительно вашего расхода`}
              </p>
            </div>
            <div className="plan-macros">
              <div><span>Белки</span><b>{res.protein_g} г</b></div>
              <div><span>Жиры</span><b>{res.fat_g} г</b></div>
              <div><span>Углеводы</span><b>{res.carbs_g} г</b></div>
            </div>
          </div>

          {res.clamped && !data.reached && (
            <p className="danger">Норма поднята до безопасного минимума: выбранный темп слишком быстрый для вашего расхода.</p>
          )}

          {data.plan.goal !== "maintain" && (
            <div className="card">
              <h3>Прогресс по весу</h3>
              <div className="plan-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${progress}%` }} />
              </div>
              <div className="plan-weights">
                <span><small>Старт</small><b>{n1(Number(data.plan.start_weight_kg))} кг</b></span>
                <span><small>Сейчас</small><b>{n1(data.currentWeight)} кг</b></span>
                <span><small>Цель</small><b>{n1(data.goalWeight)} кг</b></span>
              </div>
              {!data.reached && (
                <p className="muted" style={{ margin: "10px 0 0", fontSize: 13.5 }}>
                  Осталось {n1(Math.abs(data.goalWeight - data.currentWeight))} кг{eta ? ` · примерно к ${eta}` : ""}.
                  {isSelf && <> Норма пересчитывается сама, когда вы вносите новый вес в <Link href="/measurements">«Характеристики»</Link>.</>}
                </p>
              )}
            </div>
          )}

          <div className="card">
            <h3>Как посчитано</h3>
            <div className="kpi-grid">
              <div className="card kpi"><div className="t">Обмен в покое</div><div className="v">{n1(res.bmr, 0)}</div><span className="s">ккал в день</span></div>
              <div className="card kpi"><div className="t">Расход с активностью</div><div className="v">{n1(res.tdee, 0)}</div><span className="s">{ACTIVITY[data.plan.activity].label}</span></div>
              <div className="card kpi"><div className="t">ИМТ</div><div className="v">{n1(res.bmi)}</div><span className="s">возраст {res.age}</span></div>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
              Формула Миффлина — Сан-Жеора плюс коэффициент активности. Это ориентир, а не медицинская рекомендация.
            </p>
          </div>
        </>
      )}

      {!data && !isSelf && <div className="card"><p className="muted" style={{ margin: 0 }}>Подопечный ещё не заполнил анкету цели.</p></div>}

      {isSelf && (
        <div className="card">
          {!data ? (
            <>
              <h3>Поставьте цель</h3>
              <p className="muted" style={{ fontSize: 13.5 }}>
                Ответьте на несколько вопросов — мы рассчитаем дневную норму калорий и БЖУ под ваш набор или сброс веса.
              </p>
              <PlanForm defaults={defaults} submitLabel="Рассчитать норму" />
            </>
          ) : (
            <details className="addrow">
              <summary>Изменить анкету</summary>
              <p className="muted" style={{ fontSize: 13 }}>
                После сохранения отсчёт прогресса начнётся с введённого сейчас веса.
              </p>
              <PlanForm defaults={defaults} submitLabel="Пересчитать норму" />
              <form action={resetPlan} style={{ marginTop: 10 }}>
                <button className="sm danger">Удалить цель</button>
              </form>
            </details>
          )}
        </div>
      )}
    </>
  );
}
