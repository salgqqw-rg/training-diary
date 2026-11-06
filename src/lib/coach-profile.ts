// Анкета тренера для каталога: разбор и ограничение полей формы (чистая функция, без базы)
export const FORMATS = { online: "Онлайн", offline: "Очно", both: "Онлайн и очно" } as const;
export type CoachFormat = keyof typeof FORMATS;

const oneLine = (fd: FormData, key: string, max: number) =>
  String(fd.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function parseCoachProfile(fd: FormData) {
  const years = String(fd.get("experience_years") ?? "").trim();
  const n = Math.round(Number(years));
  const format = String(fd.get("format") ?? "");
  return {
    about: String(fd.get("about") ?? "").trim().slice(0, 1500),
    specialties: oneLine(fd, "specialties", 200),
    experience_years: years === "" || !Number.isFinite(n) ? null : Math.max(0, Math.min(60, n)),
    format: (Object.keys(FORMATS).includes(format) ? format : "both") as CoachFormat,
    price: oneLine(fd, "price", 100),
    city: oneLine(fd, "city", 60),
    listed: fd.get("listed") === "on",
  };
}
