import { createClient } from "@supabase/supabase-js";

// Клиент с service-ключом: нужен только для полного удаления аккаунта.
// Ключ SUPABASE_SERVICE_ROLE_KEY держим только на сервере (не NEXT_PUBLIC_).
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
