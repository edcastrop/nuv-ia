// Preferencias locales de notificaciones por dispositivo (no requiere backend).
export interface NotifPrefs {
  sonido: boolean;
  toast: boolean;
  browser: boolean;
  dndEnabled: boolean;
  dndStart: string; // "HH:MM"
  dndEnd: string;   // "HH:MM"
  volumen: number;  // 0..1
}

const KEY = "nuvex.notif.prefs.v1";

export const DEFAULT_PREFS: NotifPrefs = {
  sonido: true,
  toast: true,
  browser: false,
  dndEnabled: false,
  dndStart: "20:00",
  dndEnd: "07:00",
  volumen: 0.35,
};

export function getNotifPrefs(): NotifPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setNotifPrefs(p: NotifPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent("nuvex:notif-prefs"));
}

export function subscribeNotifPrefs(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener("nuvex:notif-prefs", h);
  return () => window.removeEventListener("nuvex:notif-prefs", h);
}

export function enDND(p: NotifPrefs, now: Date = new Date()): boolean {
  if (!p.dndEnabled) return false;
  const [sH, sM] = p.dndStart.split(":").map(Number);
  const [eH, eM] = p.dndEnd.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sH * 60 + sM;
  const end = eH * 60 + eM;
  // Rango cruza medianoche
  if (start > end) return cur >= start || cur < end;
  return cur >= start && cur < end;
}
