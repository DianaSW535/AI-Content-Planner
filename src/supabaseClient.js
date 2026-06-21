import { createClient } from "@supabase/supabase-js";

/**
 * Инициализация Supabase-клиента для браузера (Vite).
 * URL берётся из VITE_SUPABASE_URL — это корень проекта, без /rest/v1.
 */
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
