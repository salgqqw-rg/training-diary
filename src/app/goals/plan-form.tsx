"use client";

import { useState } from "react";
import { savePlan } from "@/lib/goal-actions";
import { ACTIVITY, GOALS, PACES, calcPlan, type Activity, type Goal, type Sex } from "@/lib/nutrition";

export type PlanDefaults = {
  goal: Goal;
  sex: Sex;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goalWeightKg: string;
  activity: Activity;
  pace: number;
};

const n1 = (v: number, d = 1) => v.toLocaleString("ru-RU", { maximumFractionDigits: d });
const toNum = (s: string) => Number(s.trim().replace(",", "."));

export function PlanForm({ defaults, submitLabel }: { defaults: PlanDefaults; submitLabel: string }) {
  const [goal, setGoal] = useState<Goal>(defaults.goal);
  const [sex, setSex] = useState<Sex>(defaults.sex);
  const [birth, setBirth] = useState(defaults.birthDate);
  const [height, setHeight] = useState(defaults.heightCm);
  const [weight, setWeight] = useState(defaults.weightKg);
  const [goalW, setGoalW] = useState(defaults.goalWeightKg);
  const [activity, setActivity] = useState<Activity>(defaults.activity);
  const [paceRaw, setPace] = useState(defaults.pace);

  const paces = goal === "maintain" ? [] : PACES[goal];
  const pace = goal === "maintain" ? 0 : paces.includes(paceRaw) ? paceRaw : 0.5;

  const filled = birth && height && weight && (goal === "maintain" || goalW);
  const res = filled
    ? calcPlan({
        goal, sex, birthDate: birth, heightCm: toNum(height), weightKg: toNum(weight),
        goalWeightKg: goal === "maintain" ? toNum(weight) : toNum(goalW), activity, paceKgWeek: pace,
      })
    : null;

  const eta = res && res.ok && res.weeks
    ? new Date(Date.now() + res.weeks * 7 * 864e5).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <form action={savePlan} className="plan-form">
      <fieldset>
        <legend>1. Ваша цель</legend>
        <div className="seg">
          {(Object.keys(GOALS) as Goal[]).map((g) => (
            <label key={g} className="seg-opt">
              <input type="radio" name="goal" value={g} checked={goal === g} onChange={() => setGoal(g)} required />
              <span>{GOALS[g]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>2. О вас</legend>
        <div className="seg" style={{ maxWidth: 320 }}>
          <label className="seg-opt">
            <input type="radio" name="sex" value="male" checked={sex === "male"} onChange={() => setSex("male")} />
            <span>Мужчина</span>
          </label>
          <label className="seg-opt">
            <input type="radio" name="sex" value="female" checked={sex === "female"} onChange={() => setSex("female")} />
            <span>Женщина</span>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label>Дата рождения
            <input name="birth_date" type="date" required value={birth} onChange={(e) => setBirth(e.target.value)}
              max={new Date().toISOString().slice(0, 10)} />
          </label>
          <label>Рост, см
            <input name="height" type="number" inputMode="decimal" step="0.1" min={100} max={250} required
              value={height} onChange={(e) => setHeight(e.target.value)} style={{ width: 120 }} />
          </label>
          <label>Текущий вес, кг
            <input name="weight" type="number" inputMode="decimal" step="0.1" min={30} max={300} required
              value={weight} onChange={(e) => setWeight(e.target.value)} style={{ width: 130 }} />
          </label>
          {goal !== "maintain" && (
            <label>Желаемый вес, кг
              <input name="goal_weight" type="number" inputMode="decimal" step="0.1" min={30} max={300} required
                value={goalW} onChange={(e) => setGoalW(e.target.value)} style={{ width: 140 }} />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Уровень активности</legend>
        <div className="act-list">
          {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
            <label key={a} className="act-opt">
              <input type="radio" name="activity" value={a} checked={activity === a} onChange={() => setActivity(a)} />
              <span><b>{ACTIVITY[a].label}</b><small>{ACTIVITY[a].hint}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      {goal !== "maintain" && (
        <fieldset>
          <legend>4. Желаемый темп</legend>
          <select name="pace" value={pace} onChange={(e) => setPace(Number(e.target.value))}>
            {paces.map((p) => (
              <option key={p} value={p}>
                {n1(p, 2)} кг в неделю ({goal === "lose" ? "−" : "+"}{Math.round(p * 1100)} ккал в день)
              </option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
            Безопасный темп сброса — до 1 кг в неделю, набора — до 0,5 кг.
          </p>
        </fieldset>
      )}

      <div className="plan-live" aria-live="polite">
        {!res && <p className="muted" style={{ margin: 0 }}>Заполните анкету — норма на день рассчитается автоматически.</p>}
        {res && !res.ok && <p className="danger" style={{ margin: 0 }}>{res.error}</p>}
        {res && res.ok && (
          <>
            <div className="plan-live-main">
              <span className="muted">Ваша норма на день</span>
              <b>{n1(res.kcal, 0)} <small>ккал</small></b>
            </div>
            <div className="plan-live-macros">
              <span>Белки <b>{res.protein_g} г</b></span>
              <span>Жиры <b>{res.fat_g} г</b></span>
              <span>Углеводы <b>{res.carbs_g} г</b></span>
            </div>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
              Обмен веществ в покое {n1(res.bmr, 0)} ккал · с учётом активности {n1(res.tdee, 0)} ккал
              {eta && <> · цель примерно к {eta}</>}
            </p>
            {res.clamped && (
              <p className="danger" style={{ margin: "6px 0 0", fontSize: 13 }}>
                Норма поднята до безопасного минимума. Выбранный темп слишком быстрый — цель займёт больше времени.
              </p>
            )}
          </>
        )}
      </div>

      <button className="primary" disabled={!res || !res.ok}>{submitLabel}</button>
    </form>
  );
}
