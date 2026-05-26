import { supabase } from "@/integrations/supabase/client";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function streamNuvexGpt({
  messages,
  modulo_contexto,
  conversacion_id,
  onDelta,
  signal,
}: {
  messages: ChatMsg[];
  modulo_contexto?: string | null;
  conversacion_id?: string | null;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("No hay sesión activa");

  const resp = await fetch("/api/nuvex-gpt-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, modulo_contexto, conversacion_id }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    let errMsg = "Error en NUVEX GPT";
    try {
      const j = await resp.json();
      errMsg = j.error ?? errMsg;
    } catch {
      // empty
    }
    if (resp.status === 429) throw new Error(errMsg);
    if (resp.status === 402) throw new Error(errMsg);
    throw new Error(errMsg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistant = "";
  let done = false;

  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const piece = parsed?.choices?.[0]?.delta?.content as string | undefined;
        if (piece) {
          assistant += piece;
          onDelta(piece);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  return assistant;
}

export function modulosDesdePath(pathname: string): string | null {
  const p = pathname.toLowerCase();
  if (p.startsWith("/cartera")) return "cartera";
  if (p.startsWith("/comisiones")) return "comisiones";
  if (p.startsWith("/contabilidad")) return "contabilidad";
  if (p.startsWith("/finanzas")) return "finanzas";
  if (p.startsWith("/casos")) return "casos";
  if (p.startsWith("/expediente-maestro")) return "expediente maestro";
  if (p.startsWith("/academia")) return "academia";
  if (p.startsWith("/proyeccion")) return "proyección";
  if (p.startsWith("/qa")) return "qa";
  if (p.startsWith("/apoderados-nuvex") || p.startsWith("/apoderado")) return "apoderados";
  if (p.startsWith("/notificaciones")) return "alertas";
  if (p.startsWith("/mi-perfil")) return "perfil";
  if (p.startsWith("/super-admin")) return "administración";
  if (p === "/" || p.startsWith("/simulador")) return "simulador";
  return null;
}

export const PREGUNTAS_SUGERIDAS = [
  "¿Cómo subo un extracto?",
  "¿Qué es Fresh?",
  "¿Cómo genero una simulación?",
  "¿Cómo funciona la Ley 546?",
  "¿Cómo genero una cuenta de cobro?",
  "¿Qué hago si el banco niega?",
  "¿Cómo reviso mis comisiones?",
  "¿Cómo creo un expediente?",
];
