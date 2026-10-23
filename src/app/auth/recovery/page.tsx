import { RecoveryClient } from "./recovery-client";

// Страховка: если Supabase отдал ссылку в «hash»-формате (#access_token=...),
// её разбирает браузерный клиент и переносит человека на смену пароля
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/update-password";
  return <RecoveryClient next={safe} />;
}
