import { supabase } from "@/integrations/supabase/client";

const CHANNEL = "presencia-global";
const HEARTBEAT_MS = 60_000;

let _client: ReturnType<typeof supabase.channel> | null = null;
let _subscribePromise: Promise<void> | null = null;
let _heartbeatTimer: number | null = null;
let _started = false;
let _trackedUserId: string | null = null;
let _currentOnline = new Set<string>();
let _removeWindowListeners: (() => void) | null = null;

const _listeners = new Set<(online: Set<string>) => void>();

function emitirPresencia() {
  const snapshot = new Set(_currentOnline);
  _listeners.forEach((listener) => listener(snapshot));
}

function leerUsuariosOnline(ch: ReturnType<typeof supabase.channel>) {
  const state = ch.presenceState() as Record<string, Array<{ user_id?: string }>>;
  _currentOnline = new Set(
    Object.entries(state).flatMap(([key, metas]) => {
      const ids = metas.map((meta) => meta.user_id).filter(Boolean) as string[];
      return ids.length > 0 ? ids : [key];
    }),
  );
  emitirPresencia();
}

function asegurarCanalPresencia() {
  if (_client) return _client;

  const ch = supabase.channel(
    CHANNEL,
    _trackedUserId ? { config: { presence: { key: _trackedUserId } } } : undefined,
  );

  ch.on("presence", { event: "sync" }, () => leerUsuariosOnline(ch));
  _client = ch;

  return ch;
}

function suscribirCanal(ch: ReturnType<typeof supabase.channel>) {
  if (_subscribePromise) return _subscribePromise;

  _subscribePromise = new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        resolve();
      }
    });
  });

  return _subscribePromise;
}

async function tocarLastSeen(userId: string) {
  try {
    await supabase
      .from("profiles" as never)
      .update({ last_seen_at: new Date().toISOString() } as never)
      .eq("id", userId);
  } catch {
    // silencioso
  }
}

/**
 * Inicia la presencia del usuario actual: se une al canal "presencia-global",
 * envía heartbeats cada 60s a profiles.last_seen_at y se da de baja al cerrar.
 * Idempotente: si ya fue iniciada, no hace nada.
 */
export async function iniciarPresenciaPropia(userId: string, visible: boolean) {
  if (_started || !userId) return;
  _started = true;
  _trackedUserId = userId;

  // Si el usuario ocultó su estado, solo registramos last_seen y salimos.
  if (!visible) {
    await tocarLastSeen(userId);
    return;
  }

  const ch = asegurarCanalPresencia();
  await suscribirCanal(ch).catch(() => undefined);
  await ch.track({ user_id: userId, online_at: new Date().toISOString() }).catch(() => undefined);

  await tocarLastSeen(userId).catch(() => undefined);
  if (typeof window === "undefined" || typeof document === "undefined") return;

  _heartbeatTimer = window.setInterval(() => { void tocarLastSeen(userId); }, HEARTBEAT_MS);

  const onHide = () => { void tocarLastSeen(userId); };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("beforeunload", onHide);
  _removeWindowListeners = () => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("beforeunload", onHide);
  };
}

export function detenerPresenciaPropia() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_removeWindowListeners) { _removeWindowListeners(); _removeWindowListeners = null; }
  if (_client) { supabase.removeChannel(_client); _client = null; }
  _subscribePromise = null;
  _started = false;
  _trackedUserId = null;
  _currentOnline = new Set();
  emitirPresencia();
}

/**
 * Suscribirse a cambios de presencia. Devuelve cleanup.
 * cb recibe Set<userId> de usuarios actualmente en línea.
 */
export function suscribirPresencia(cb: (online: Set<string>) => void) {
  _listeners.add(cb);
  cb(new Set(_currentOnline));

  const ch = asegurarCanalPresencia();
  suscribirCanal(ch).then(() => leerUsuariosOnline(ch)).catch(() => {});

  return () => { _listeners.delete(cb); };
}

/** Formatea "última vez" estilo redes sociales en español. */
export function formatUltimaVez(iso: string | null | undefined): string {
  if (!iso) return "Sin actividad reciente";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "En línea hace un momento";
  if (min < 60) return `Última vez hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Última vez hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Última vez ayer";
  if (days < 7) return `Última vez hace ${days} días`;
  return `Última vez el ${d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}
