// Helpers PUROS de validación del envío a Contratación.
// Aislados aquí para poder cubrirlos con pruebas unitarias sin arrancar el
// runtime del server. Los usa `contratacion.functions.ts` (server) y los
// tests bajo `src/lib/__tests__/`.

export const CONTRATACION_ATTACHMENT_MAX = 10;
export const CONTRATACION_CORREO_OBLIGATORIO = "contabilidad@nuvex.com.co";

export type SoporteRow = {
  categoria: string;
  subcategoria: string | null;
  archivo_nombre: string | null;
  archivo_path: string | null;
  mime_type: string | null;
};

export type CotitularActivo = {
  nombre: string;
  activo?: boolean;
};

/**
 * Comprueba límite de adjuntos. Devuelve mensaje formateado (para markError)
 * o `null` si está dentro del límite.
 */
export function detectAttachmentLimitViolation(
  count: number,
  max: number = CONTRATACION_ATTACHMENT_MAX,
): string | null {
  if (count <= max) return null;
  return `Adjuntos recibidos ${count}, límite permitido ${max}. Reduce o consolida los archivos.`;
}

/**
 * Normaliza el arreglo `cliente_data.cotitulares` filtrando los activos con
 * nombre válido. Retorna [] cuando la entrada no es array o es null.
 */
export function normalizarCotitularesActivos(raw: unknown): CotitularActivo[] {
  if (!Array.isArray(raw)) return [];
  const out: CotitularActivo[] = [];
  for (const c of raw as Array<Record<string, unknown>>) {
    if (!c || c.activo === false) continue;
    if (typeof c.nombre !== "string" || !c.nombre.trim()) continue;
    out.push({ nombre: c.nombre.trim(), activo: c.activo !== false });
  }
  return out;
}

/**
 * Cédulas requeridas por `subcategoria` a partir de los cotitulares activos.
 * Siempre incluye `cedula_titular` primero.
 */
export function computeCedulasRequeridas(
  cotitularesActivos: readonly CotitularActivo[],
): string[] {
  return [
    "cedula_titular",
    ...cotitularesActivos.map((_c, i) => `cedula_cotitular_${i + 1}`),
  ];
}

/**
 * Extrae posiciones numéricas de cotitulares presentes en soportes
 * (`cedula_cotitular_1`, `cedula_cotitular_2`, …). Ordenado ascendente y
 * deduplicado.
 */
export function detectSoporteCotitularPositions(
  soportes: readonly SoporteRow[],
): number[] {
  const found = new Set<number>();
  for (const s of soportes) {
    if (s.categoria !== "identidad" || !s.subcategoria) continue;
    const m = /^cedula_cotitular_(\d+)$/.exec(s.subcategoria);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) found.add(n);
  }
  return Array.from(found).sort((a, b) => a - b);
}

/**
 * Regla de consistencia: si existe un soporte `cedula_cotitular_n` pero el
 * cotitular en la posición `n` no está registrado en `cliente_data.cotitulares`
 * (o `cotitulares` está vacío/null), retornamos el mensaje de bloqueo.
 * NO auto-completa datos ni sugiere borrar documentos.
 */
export function detectCotitularInconsistencies(
  soportes: readonly SoporteRow[],
  cotitularesActivos: readonly CotitularActivo[],
): string[] {
  const posiciones = detectSoporteCotitularPositions(soportes);
  const out: string[] = [];
  for (const pos of posiciones) {
    if (!cotitularesActivos[pos - 1]) {
      out.push(
        `Inconsistencia documental: existe cédula de cotitular ${pos}, pero el cotitular no está registrado en cliente_data.`,
      );
    }
  }
  return out;
}

/**
 * Normaliza y valida destinatarios en el servidor:
 * - Fuerza inclusión del correo obligatorio.
 * - Deduplica en minúsculas.
 * - Filtra por lista blanca de destinatarios activos (contratacion_destinatarios).
 * Retorna { finales, rechazados }. Un rechazado NO bloquea si finales incluye
 * al menos el correo obligatorio y otro válido; el llamador decide.
 */
export function enforceDestinatariosServer(
  solicitados: readonly string[],
  activosPermitidos: readonly string[],
): { finales: string[]; rechazados: string[] } {
  const permitidos = new Set(activosPermitidos.map((e) => e.trim().toLowerCase()));
  permitidos.add(CONTRATACION_CORREO_OBLIGATORIO);
  const finales = new Set<string>([CONTRATACION_CORREO_OBLIGATORIO]);
  const rechazados: string[] = [];
  for (const raw of solicitados) {
    const e = (raw || "").trim().toLowerCase();
    if (!e) continue;
    if (permitidos.has(e)) finales.add(e);
    else rechazados.push(e);
  }
  return { finales: Array.from(finales), rechazados };
}
