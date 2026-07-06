// Utilidades para @menciones en el chat de colaboración.
// El texto guardado en BD es LEGIBLE: contiene "@Nombre" sin sintaxis extra.
// La lista de IDs mencionados va en la columna `menciones uuid[]`.

export interface MentionResolved { userId: string; nombre: string }

/** Reconstruye segmentos {text|mention} a partir del texto + los nombres de mencionados. */
export function parseMentions(texto: string, mencionados: MentionResolved[]) {
  if (!texto) return [] as Array<{ kind: "text" | "mention"; value: string; userId?: string }>;
  if (!mencionados.length) return [{ kind: "text" as const, value: texto }];
  // Ordenar por nombre más largo primero para no cortar mal (Juan vs Juan Pablo).
  const sorted = [...mencionados].sort((a, b) => b.nombre.length - a.nombre.length);
  const escaped = sorted.map((m) => escapeRegExp(m.nombre)).join("|");
  const re = new RegExp(`@(${escaped})`, "g");
  const segs: Array<{ kind: "text" | "mention"; value: string; userId?: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(texto)) !== null) {
    if (match.index > last) segs.push({ kind: "text", value: texto.slice(last, match.index) });
    const persona = sorted.find((m) => m.nombre === match![1]);
    segs.push({ kind: "mention", value: match[1], userId: persona?.userId });
    last = match.index + match[0].length;
  }
  if (last < texto.length) segs.push({ kind: "text", value: texto.slice(last) });
  return segs;
}

/** Detecta si el caret está justo después de un `@query` (sin espacios) y devuelve el rango + query. */
export function detectMentionTrigger(texto: string, caret: number): { start: number; query: string } | null {
  const before = texto.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  if (query.length > 30) return null;
  return { start: at, query };
}

export function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
