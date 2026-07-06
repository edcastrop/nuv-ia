// Utilidades para @menciones en el chat de colaboración.
// Formato del token dentro del texto guardado: @[Nombre Visible](uuid)

export const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

export function extractMentionIds(texto: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(texto)) !== null) {
    ids.add(match[2]);
  }
  return Array.from(ids);
}

export interface MentionSegment {
  kind: "text" | "mention";
  value: string;
  userId?: string;
}

export function parseMentions(texto: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const re = new RegExp(MENTION_TOKEN_RE.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(texto)) !== null) {
    if (match.index > last) segments.push({ kind: "text", value: texto.slice(last, match.index) });
    segments.push({ kind: "mention", value: match[1], userId: match[2] });
    last = match.index + match[0].length;
  }
  if (last < texto.length) segments.push({ kind: "text", value: texto.slice(last) });
  return segments;
}

/** Detecta si el caret está justo después de un `@query` (sin espacios) y devuelve el rango + query. */
export function detectMentionTrigger(texto: string, caret: number): { start: number; query: string } | null {
  const before = texto.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  // Debe estar al inicio o precedido por espacio/salto de línea
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/[\s\n]/.test(query)) return null;
  if (query.length > 30) return null;
  return { start: at, query };
}

/** Normaliza texto para búsqueda (sin tildes, minúsculas). */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
