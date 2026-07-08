/**
 * Client-side session lifetime helper.
 *
 * NOTE: This is NOT a security control. Supabase JWT/refresh expiry is
 * unchanged. The only purpose is to force users to re-login every 24h on
 * their browser so that after a deploy, stale client bundles/caches get
 * refreshed via a full login round-trip.
 *
 * Behavior:
 *  - On SIGNED_IN we stamp `nuvia_client_session_started_at` (ms).
 *  - A guard component checks every 60s.
 *  - 60 min before expiry -> warning toast with "Extender 24h" (1 use max).
 *  - At expiry -> blocking toast "Cerrar sesión y volver a entrar".
 */

export const MAX_CLIENT_SESSION_MS = 24 * 60 * 60 * 1000; // 24h
export const WARN_BEFORE_MS = 60 * 60 * 1000; // 1h
export const CHECK_INTERVAL_MS = 60 * 1000; // 60s
export const MAX_EXTENSIONS_PER_CYCLE = 1;

export const STORAGE_KEY = "nuvia_client_session_started_at";
export const WARN_FLAG = "nuvia_client_session_warned";
export const EXTENSIONS_KEY = "nuvia_client_session_extensions";

export const PUBLIC_ROUTES = ["/login", "/registro", "/reset-password", "/mfa-verificar"];

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* noop */ }
}
function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
}

export function markClientSessionStart() {
  safeSet(STORAGE_KEY, String(Date.now()));
  safeRemove(WARN_FLAG);
  safeRemove(EXTENSIONS_KEY);
}

export function clearClientSessionStart() {
  safeRemove(STORAGE_KEY);
  safeRemove(WARN_FLAG);
  safeRemove(EXTENSIONS_KEY);
}

export function getSessionStartedAt(): number | null {
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function msRemaining(now: number = Date.now()): number | null {
  const started = getSessionStartedAt();
  if (started == null) return null;
  return started + MAX_CLIENT_SESSION_MS - now;
}

export function isExpired(now: number = Date.now()): boolean {
  const r = msRemaining(now);
  return r != null && r <= 0;
}

export function shouldWarn(now: number = Date.now()): boolean {
  const r = msRemaining(now);
  if (r == null) return false;
  if (r <= 0 || r > WARN_BEFORE_MS) return false;
  return safeGet(WARN_FLAG) !== "1";
}

export function markWarned() {
  safeSet(WARN_FLAG, "1");
}

export function clearWarned() {
  safeRemove(WARN_FLAG);
}

export function getExtensionsUsed(): number {
  const raw = safeGet(EXTENSIONS_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function canExtend(): boolean {
  return getExtensionsUsed() < MAX_EXTENSIONS_PER_CYCLE;
}

/** Reset the 24h timer. Returns true if the extension was granted. */
export function extendClientSession(): boolean {
  if (!canExtend()) return false;
  const used = getExtensionsUsed() + 1;
  safeSet(EXTENSIONS_KEY, String(used));
  safeSet(STORAGE_KEY, String(Date.now()));
  safeRemove(WARN_FLAG);
  return true;
}

export function isPublicPath(pathname: string): boolean {
  if (!pathname) return false;
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
