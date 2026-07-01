// NUVIA Victory Trigger — capa de gamificación pura.
// No toca lógica de expedientes ni CRM. Solo emite/recibe eventos.

import { supabase } from "@/integrations/supabase/client";

export type VictoryKind = "contrato_firmado" | "poder_firmado";

export interface VictoryEvent {
  id: string;
  kind: VictoryKind;
  analistaId: string | null;
  analista: string;
  banco: string;
  cliente: string;
  honorarios: number | null;
  expedienteId: string | null;
  timestamp: number;
}

const CHANNEL = "nuvia-victory";
const EVT_LOCAL = "nuvia:victory";
const MUTE_KEY = "nuvia.victory.muted";
const STREAK_KEY = "nuvia.victory.streak";
const FEED_KEY = "nuvia.victory.feed";
const FEED_MAX = 40;

/* --------------------------- mute preference --------------------------- */

export function isVictoryMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}
export function setVictoryMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  window.dispatchEvent(new CustomEvent("nuvia:victory:mute", { detail: muted }));
}

/* -------------------------------- streak ------------------------------- */

export interface StreakState {
  actual: number;        // cierres consecutivos hoy
  ultimoDia: string;     // YYYY-MM-DD
  record: number;        // récord personal
  totalCierres: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function readStreak(): StreakState {
  if (typeof window === "undefined") return { actual: 0, ultimoDia: "", record: 0, totalCierres: 0 };
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakState;
  } catch { /* ignore */ }
  return { actual: 0, ultimoDia: "", record: 0, totalCierres: 0 };
}

export function bumpStreak(): StreakState {
  const s = readStreak();
  const hoy = todayISO();
  s.actual = s.ultimoDia === hoy ? s.actual + 1 : 1;
  s.ultimoDia = hoy;
  s.totalCierres = (s.totalCierres || 0) + 1;
  if (s.actual > (s.record || 0)) s.record = s.actual;
  try { window.localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  return s;
}

/* --------------------------------- feed -------------------------------- */

export function readFeed(): VictoryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FEED_KEY);
    return raw ? (JSON.parse(raw) as VictoryEvent[]) : [];
  } catch { return []; }
}

function pushToFeed(evt: VictoryEvent) {
  if (typeof window === "undefined") return;
  const feed = [evt, ...readFeed()].slice(0, FEED_MAX);
  try { window.localStorage.setItem(FEED_KEY, JSON.stringify(feed)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("nuvia:victory:feed", { detail: feed }));
}

/* --------------------------- emit + broadcast --------------------------- */

let broadcastChannel: ReturnType<typeof supabase.channel> | null = null;
function getChannel() {
  if (broadcastChannel) return broadcastChannel;
  broadcastChannel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
  broadcastChannel.subscribe();
  return broadcastChannel;
}

/** Dispara la celebración: local (para el analista que cerró) + broadcast global. */
export async function fireVictory(input: Omit<VictoryEvent, "id" | "timestamp">) {
  const evt: VictoryEvent = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  // local
  pushToFeed(evt);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<VictoryEvent>(EVT_LOCAL, { detail: evt }));
  }
  // broadcast
  try {
    const ch = getChannel();
    await ch.send({ type: "broadcast", event: "victory", payload: evt });
  } catch (e) {
    console.warn("[victory] broadcast failed", e);
  }
}

/** Suscribe a eventos remotos (otros usuarios firmando). Devuelve unsubscribe. */
export function subscribeVictoryBroadcast(handler: (evt: VictoryEvent) => void): () => void {
  const ch = getChannel();
  const cb = (payload: { payload: VictoryEvent }) => handler(payload.payload);
  ch.on("broadcast", { event: "victory" }, cb);
  return () => {
    // no-op: canal es global. Removeremos handler via ch.unsubscribe si es último.
  };
}

/** Suscribe a eventos locales (para el mismo tab que dispara). */
export function subscribeVictoryLocal(handler: (evt: VictoryEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => handler((e as CustomEvent<VictoryEvent>).detail);
  window.addEventListener(EVT_LOCAL, fn);
  return () => window.removeEventListener(EVT_LOCAL, fn);
}
