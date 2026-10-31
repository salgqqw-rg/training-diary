import { RecoveryClient } from "./recovery-client";
import { safeNext } from "@/lib/safe-next";

// Страховка: если Supabase отдал ссылку в «hash»-формате (#access_token=...),
// её разбирает браузерный клиент и переносит человека на смену пароля
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = safeNext(next, "/update-password");
  return <RecoveryClient next={safe} />;
}
