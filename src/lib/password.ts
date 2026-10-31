// Единое правило пароля для регистрации, смены и восстановления
export const MIN_PASSWORD = 8;

/** Текст ошибки или null, если пароль подходит */
export function passwordError(p: string): string | null {
  if (p.length < MIN_PASSWORD) return `Пароль должен быть от ${MIN_PASSWORD} символов`;
  if (p.length > 72) return "Пароль слишком длинный (до 72 символов)";
  return null;
}
