import { cookies } from "next/headers";
import { dayInTz, isValidTz } from "./dates";

// Часовой пояс приходит из куки tz (её ставит <TzSync/> в браузере); без неё — UTC
export async function userTz(): Promise<string> {
  const raw = (await cookies()).get("tz")?.value;
  let v = raw ?? "";
  try { v = decodeURIComponent(v); } catch { /* оставляем как есть */ }
  return v && isValidTz(v) ? v : "UTC";
}

/** Сегодняшняя дата пользователя «ГГГГ-ММ-ДД» */
export async function today(): Promise<string> {
  return dayInTz(new Date(), await userTz());
}
