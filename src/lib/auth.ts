import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Текущий пользователь, проверенный на стороне Supabase (getUser, а не доверие к куке).
// cache() — за один запрос layout и страница делают один вызов, а не два.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
