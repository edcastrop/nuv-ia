// P28 — Vistos recientemente: persistencia local de últimos expedientes abiertos.
// No toca BD ni RLS; solo localStorage por usuario/navegador.

export interface RecentCase {
  id: string;
  nombre: string;
  ts: number;
}

const KEY = "nuvex.recentCases.v1";
const MAX = 8;

function safeRead(): RecentCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentCase[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(items: RecentCase[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function getRecentCases(): RecentCase[] {
  return safeRead();
}

export function addRecentCase(id: string, nombre: string): void {
  if (!id) return;
  const now = Date.now();
  const prev = safeRead().filter((c) => c.id !== id);
  const next: RecentCase[] = [{ id, nombre: nombre || "—", ts: now }, ...prev].slice(0, MAX);
  safeWrite(next);
}

export function clearRecentCases(): void {
  safeWrite([]);
}
