import { supabase } from "@/integrations/supabase/client";

const CHANNEL = "presencia-global";
const HEARTBEAT_MS = 60_000;

let _client: ReturnType<typeof supabase.channel> | null = null;
let _heartbeatTimer: number | null = null;
let _started = false;

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

  // Si el usuario ocultó su estado, solo registramos last_seen y salimos.
  if (!visible) {
    await tocarLastSeen(userId);
    return;
  }

  const ch = supabase.channel(CHANNEL, {
    config: { presence: { key: userId } },
  });
  _client = ch;

  ch.on("presence", { event: "sync" }, () => { /* otros hooks lo leen */ });

  await new Promise<void>((resolve) => {
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: userId, online_at: new Date().toISOString() });
        resolve();
      }
    });
  });

  await tocarLastSeen(userId);
  _heartbeatTimer = window.setInterval(() => { tocarLastSeen(userId); }, HEARTBEAT_MS);

  const onHide = () => { tocarLastSeen(userId); };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("beforeunload", onHide);
}

export function detenerPresenciaPropia() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_client) { supabase.removeChannel(_client); _client = null; }
  _started = false;
}

/**
 * Suscribirse a cambios de presencia. Devuelve cleanup.
 * cb recibe Set<userId> de usuarios actualmente en línea.
 */
export function suscribirPresencia(cb: (online: Set<string>) => void) {
  const ch = supabase.channel(CHANNEL);
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState() as Record<string, unknown[]>;
    cb(new Set(Object.keys(state)));
  });
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
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
