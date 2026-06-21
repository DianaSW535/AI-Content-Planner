/**
 * Redirect URL для писем Supabase Auth (подтверждение email, сброс пароля).
 * Базовый URL берётся из VITE_SITE_URL в .env.
 */
export function getSiteUrl() {
  const fromEnv = (import.meta.env.VITE_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function getAuthRedirectUrls() {
  const base = getSiteUrl();
  return {
    emailConfirm: `${base}/auth/callback`,
    resetPassword: `${base}/auth/reset-password`,
  };
}
