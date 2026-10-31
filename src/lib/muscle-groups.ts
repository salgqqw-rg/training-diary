// Группа мышц для статистики. Источник правды — каталог упражнений (у каждого есть muscle),
// слова из названия — запасной вариант для упражнений, которых нет в каталоге.

export const GROUPS = ["Грудь", "Спина", "Плечи", "Руки", "Ноги", "Пресс", "Кардио", "Прочее"] as const;
export type Group = (typeof GROUPS)[number];

const MUSCLE_TO_GROUP: Record<string, Group> = {
  chest: "Грудь", back: "Спина", shoulders: "Плечи", traps: "Плечи",
  biceps: "Руки", triceps: "Руки", forearms: "Руки",
  abs: "Пресс", quads: "Ноги", hamstrings: "Ноги", glutes: "Ноги", calves: "Ноги", cardio: "Кардио",
};

export const normName = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

/** Запасная классификация по подстрокам русского и английского названия */
export function keywordGroup(name: string): Group {
  const s = normName(name);
  const has = (...kw: string[]) => kw.some((k) => s.includes(k));
  if (has("пресс", "скручиван", "планка", "подъем ног", "подъем колен", "crunch", "plank")) return "Пресс";
  if (has("бег", "вело", "эллипс", "кардио", "скакалк", "гребной", "run", "cardio")) return "Кардио";
  if (has("ног", "присед", "выпад", "квадри", "сгибание", "разгибание", "ягодиц", "икр", "голен", "squat", "lunge", "leg ")) return "Ноги";
  if (has("плеч", "жим стоя", "жим сидя", "над головой", "мах", "шраг", "арнольд", "delt", "shrug")) return "Плечи";
  if (has("бицепс", "трицепс", "предплеч", "молот", "франц", "брусь", "curl", "triceps")) return "Руки";
  if (has("груд", "отжим", "лежа", "развод", "кроссовер", "bench", "fly", "flye")) return "Грудь";
  if (has("тяга", "подтяг", "гребля", "станов", "гиперэкстенз", "row", "pull", "deadlift")) return "Спина";
  return "Прочее";
}

/** muscleByName: нормализованное название → ключ мышцы из каталога («chest», «quads», …) */
export function groupFor(name: string, muscleByName: ReadonlyMap<string, string>): Group {
  const m = muscleByName.get(normName(name));
  return (m && MUSCLE_TO_GROUP[m]) || keywordGroup(name);
}
