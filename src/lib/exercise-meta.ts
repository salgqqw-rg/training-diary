// Лёгкая часть каталога: безопасно импортировать из клиентских компонентов
// (exercise-catalog тянет ~230 КБ текстов упражнений).
export type Muscle =
  | "chest" | "back" | "shoulders" | "traps" | "biceps" | "triceps" | "forearms"
  | "abs" | "quads" | "hamstrings" | "glutes" | "calves" | "cardio";

export const MUSCLES: Record<Muscle, string> = {
  chest: "Грудь",
  back: "Спина",
  shoulders: "Плечи",
  traps: "Трапеции",
  biceps: "Бицепс",
  triceps: "Трицепс",
  forearms: "Предплечья",
  abs: "Пресс",
  quads: "Квадрицепс",
  hamstrings: "Бицепс бедра",
  glutes: "Ягодицы",
  calves: "Икры",
  cardio: "Кардио",
};
export const MUSCLE_KEYS = Object.keys(MUSCLES) as Muscle[];

export type Kind = "base" | "isolation";
export const KINDS: Record<Kind, string> = { base: "Базовое", isolation: "Изолирующее" };

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();
