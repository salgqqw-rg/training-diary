// Даты по часовому поясу пользователя. toISOString() даёт UTC: для UTC+7 тренировка,
// созданная ночью, получала дату «вчера». Модуль без зависимостей — его проверяют тесты.

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** «2026-10-31» для момента d в часовом поясе tz */
export function dayInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTz(tz) ? tz : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Сдвиг даты «ГГГГ-ММ-ДД» на days дней (календарная арифметика, без часовых поясов) */
export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
