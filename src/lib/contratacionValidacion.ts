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

// ────────────────────────────────────────────────────────────────────────────
// Cotitulares — resolución centralizada
// ────────────────────────────────────────────────────────────────────────────

export type CotitularSource =
  | "cotitulares"
  | "informacionJuridica"
  | "intervinientes";

export type CotitularResolved = {
  /** Cédula normalizada (solo dígitos). `null` si ninguna fuente aportó cédula. */
  cedula: string | null;
  /** Nombre canónico para trazabilidad (versión original con espacios colapsados). */
  nombre: string;
  /** Nombre normalizado (mayúsculas, sin tildes, sin espacios repetidos). Usado para dedupe. */
  nombreNormalizado: string;
  /** Fuentes que declararon este cotitular (deduplicadas). */
  sources: CotitularSource[];
};

export type CotitularConflictCode =
  | "cedula_nombres_distintos"
  | "nombre_cedulas_distintas"
  | "activo_vs_inactivo";

export type CotitularConflict = {
  code: CotitularConflictCode;
  message: string;
};

export type CotitularActivo = CotitularResolved; // alias retro-compat con firma anterior

const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizarNombreCanon = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  return stripDiacritics(raw).toUpperCase().replace(/\s+/g, " ").trim();
};

const preservarNombre = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
};

const normalizarCedula = (raw: unknown): string | null => {
  if (raw == null) return null;
  const s = String(raw).replace(/\D+/g, "");
  return s.length > 0 ? s : null;
};

const normalizarRol = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  return stripDiacritics(raw).toLowerCase().trim();
};

const maskCedula = (c: string | null): string => {
  if (!c || c.length < 3) return "***";
  return `***${c.slice(-3)}`;
};

/**
 * Máscara de nombre segura: iniciales + longitud, sin exponer identidad completa
 * en mensajes de error. Ej: "JENIFER ANDREA MORENO SAMUDIO" → "J.A.M.S. (28)".
 */
const maskNombre = (n: string): string => {
  const clean = n.trim();
  if (!clean) return "(sin nombre)";
  const partes = clean.split(/\s+/).slice(0, 6);
  const iniciales = partes.map((p) => p.charAt(0).toUpperCase()).join(".");
  return `${iniciales}. (${clean.length})`;
};

type RawCandidate = {
  source: CotitularSource;
  activoExplicito: boolean | null; // null = no declarado
  cedula: string | null;
  nombreOriginal: string;
  nombreNormalizado: string;
};

const extractFromCotitularesArray = (raw: unknown): RawCandidate[] => {
  if (!Array.isArray(raw)) return [];
  const out: RawCandidate[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item !== "object") continue;
    const nombreOriginal = preservarNombre(item.nombre);
    const nombreNormalizado = normalizarNombreCanon(item.nombre);
    const cedula = normalizarCedula(item.cedula ?? item.documento ?? item.numeroDocumento);
    if (!cedula && !nombreNormalizado) continue;
    const activoExplicito =
      typeof item.activo === "boolean" ? item.activo : null;
    out.push({
      source: "cotitulares",
      activoExplicito,
      cedula,
      nombreOriginal,
      nombreNormalizado,
    });
  }
  return out;
};

const extractFromInformacionJuridica = (raw: unknown): RawCandidate[] => {
  if (!raw || typeof raw !== "object") return [];
  const info = raw as Record<string, unknown>;
  const cotit = info.cotitular;
  if (!cotit || typeof cotit !== "object") return [];
  const item = cotit as Record<string, unknown>;
  const nombreOriginal = preservarNombre(item.nombre);
  const nombreNormalizado = normalizarNombreCanon(item.nombre);
  const cedula = normalizarCedula(item.cedula ?? item.documento ?? item.numeroDocumento);
  if (!cedula && !nombreNormalizado) return [];
  const activoExplicito =
    typeof item.activo === "boolean" ? item.activo : null;
  return [
    {
      source: "informacionJuridica",
      activoExplicito,
      cedula,
      nombreOriginal,
      nombreNormalizado,
    },
  ];
};

const extractFromIntervinientes = (raw: unknown): RawCandidate[] => {
  if (!Array.isArray(raw)) return [];
  const out: RawCandidate[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item !== "object") continue;
    if (normalizarRol(item.rol) !== "cotitular") continue;
    const nombreOriginal = preservarNombre(item.nombreCompleto ?? item.nombre);
    const nombreNormalizado = normalizarNombreCanon(item.nombreCompleto ?? item.nombre);
    const cedula = normalizarCedula(item.cedula ?? item.documento ?? item.numeroDocumento);
    if (!cedula && !nombreNormalizado) continue;
    const activoExplicito =
      typeof item.activo === "boolean" ? item.activo : null;
    out.push({
      source: "intervinientes",
      activoExplicito,
      cedula,
      nombreOriginal,
      nombreNormalizado,
    });
  }
  return out;
};

/**
 * Resuelve cotitulares desde `cliente_data` combinando las 3 fuentes históricas
 * (esquema nuevo, informacionJuridica, intervinientes). PURA — no muta la
 * entrada. No elige silenciosamente una fuente ganadora en caso de conflicto:
 * reporta la contradicción y deja que el llamador bloquee.
 *
 * Reglas:
 * - Normaliza mayúsculas, espacios y tildes de nombres y rol.
 * - Descarta registros explícitamente inactivos (`activo === false`).
 * - Deduplica por cédula (dígitos); usa nombre normalizado sólo cuando NO hay
 *   cédula en ninguna fuente para esa persona.
 * - Preserva orden determinístico: cédula ASC (numérica), luego nombre ASC.
 * - Registra las fuentes que declararon a cada cotitular.
 * - Contradicciones (no auto-resueltas): misma cédula con nombres distintos,
 *   mismo nombre con cédulas distintas, activo en una fuente e inactivo en otra.
 */
export function resolveCotitularesFromClienteData(clienteData: unknown): {
  cotitulares: CotitularResolved[];
  conflicts: CotitularConflict[];
} {
  const conflicts: CotitularConflict[] = [];
  if (!clienteData || typeof clienteData !== "object") {
    return { cotitulares: [], conflicts };
  }
  const cd = clienteData as Record<string, unknown>;

  const raw: RawCandidate[] = [
    ...extractFromCotitularesArray(cd.cotitulares),
    ...extractFromInformacionJuridica(cd.informacionJuridica),
    ...extractFromIntervinientes(cd.intervinientes),
  ];

  if (raw.length === 0) return { cotitulares: [], conflicts };

  // Paso 1 — Contradicción activo/inactivo dentro de la MISMA identidad
  // (agrupada por cédula si existe, de lo contrario por nombreNormalizado).
  const identityKey = (c: RawCandidate): string =>
    c.cedula ? `C:${c.cedula}` : `N:${c.nombreNormalizado}`;
  const byIdentity = new Map<string, RawCandidate[]>();
  for (const c of raw) {
    const k = identityKey(c);
    const arr = byIdentity.get(k) ?? [];
    arr.push(c);
    byIdentity.set(k, arr);
  }
  for (const [, group] of byIdentity) {
    const anyActive = group.some((g) => g.activoExplicito !== false);
    const anyInactive = group.some((g) => g.activoExplicito === false);
    if (anyActive && anyInactive) {
      const c = group[0];
      conflicts.push({
        code: "activo_vs_inactivo",
        message: `Cotitular ${c.cedula ? `cédula ${maskCedula(c.cedula)}` : maskNombre(c.nombreOriginal)} está declarado activo en una fuente e inactivo en otra.`,
      });
    }
  }

  // Paso 2 — Filtrar explícitamente inactivos (sólo si TODAS las fuentes lo
  // marcan inactivo; si hay conflicto activo/inactivo ya se reportó arriba y
  // seguimos considerando la versión activa para no bloquear silenciosamente).
  const activos = raw.filter((c) => {
    const group = byIdentity.get(identityKey(c)) ?? [];
    return group.some((g) => g.activoExplicito !== false);
  });

  // Paso 3 — misma cédula con nombres materialmente distintos.
  const porCedula = new Map<string, RawCandidate[]>();
  for (const c of activos) {
    if (!c.cedula) continue;
    const arr = porCedula.get(c.cedula) ?? [];
    arr.push(c);
    porCedula.set(c.cedula, arr);
  }
  for (const [cedula, group] of porCedula) {
    const nombresDistintos = new Set(
      group.map((g) => g.nombreNormalizado).filter((n) => n.length > 0),
    );
    if (nombresDistintos.size > 1) {
      conflicts.push({
        code: "cedula_nombres_distintos",
        message: `Cédula ${maskCedula(cedula)} aparece con nombres distintos en las fuentes del expediente.`,
      });
    }
  }

  // Paso 4 — mismo nombre normalizado con cédulas distintas.
  const porNombre = new Map<string, RawCandidate[]>();
  for (const c of activos) {
    if (!c.nombreNormalizado) continue;
    const arr = porNombre.get(c.nombreNormalizado) ?? [];
    arr.push(c);
    porNombre.set(c.nombreNormalizado, arr);
  }
  for (const [nombreNorm, group] of porNombre) {
    const cedulasDistintas = new Set(
      group.map((g) => g.cedula).filter((v): v is string => !!v),
    );
    if (cedulasDistintas.size > 1) {
      const nombreOriginal =
        group.find((g) => g.nombreOriginal)?.nombreOriginal ?? nombreNorm;
      conflicts.push({
        code: "nombre_cedulas_distintas",
        message: `Un mismo cotitular (${maskNombre(nombreOriginal)}) aparece con cédulas distintas en las fuentes del expediente.`,
      });
    }
  }

  // Paso 5 — Dedupe. Prioridad: cédula > nombreNormalizado.
  const bucket = new Map<string, CotitularResolved>();
  for (const c of activos) {
    const key = c.cedula ? `C:${c.cedula}` : `N:${c.nombreNormalizado}`;
    const existing = bucket.get(key);
    if (existing) {
      if (!existing.sources.includes(c.source)) existing.sources.push(c.source);
      // Completa cédula/nombre si venían faltantes.
      if (!existing.cedula && c.cedula) existing.cedula = c.cedula;
      if (!existing.nombre && c.nombreOriginal) {
        existing.nombre = c.nombreOriginal;
        existing.nombreNormalizado = c.nombreNormalizado;
      }
    } else {
      bucket.set(key, {
        cedula: c.cedula,
        nombre: c.nombreOriginal,
        nombreNormalizado: c.nombreNormalizado,
        sources: [c.source],
      });
    }
  }

  // Orden determinístico: cédula ASC (numérica), null al final; luego nombre ASC.
  const cotitulares = Array.from(bucket.values()).sort((a, b) => {
    if (a.cedula && b.cedula) {
      const an = BigInt(a.cedula);
      const bn = BigInt(b.cedula);
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    }
    if (a.cedula && !b.cedula) return -1;
    if (!a.cedula && b.cedula) return 1;
    return a.nombreNormalizado.localeCompare(b.nombreNormalizado);
  });

  return { cotitulares, conflicts };
}

/**
 * Retro-compat: mantiene la firma anterior devolviendo la forma resuelta.
 * Nuevas rutas deben usar `resolveCotitularesFromClienteData`.
 */
export function normalizarCotitularesActivos(
  cotitularesRaw: unknown,
): CotitularResolved[] {
  const { cotitulares } = resolveCotitularesFromClienteData({
    cotitulares: cotitularesRaw,
  });
  return cotitulares;
}

// ────────────────────────────────────────────────────────────────────────────
// Validaciones de adjuntos y consistencia de soportes
// ────────────────────────────────────────────────────────────────────────────

export function detectAttachmentLimitViolation(
  count: number,
  max: number = CONTRATACION_ATTACHMENT_MAX,
): string | null {
  if (count <= max) return null;
  return `Adjuntos recibidos ${count}, límite permitido ${max}. Reduce o consolida los archivos.`;
}

/**
 * Cédulas requeridas por `subcategoria` a partir de los cotitulares resueltos.
 * Siempre incluye `cedula_titular` primero, luego `cedula_cotitular_1..N`
 * en el mismo orden determinístico del resolver.
 */
export function computeCedulasRequeridas(
  cotitulares: readonly CotitularResolved[],
): string[] {
  return [
    "cedula_titular",
    ...cotitulares.map((_c, i) => `cedula_cotitular_${i + 1}`),
  ];
}

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
 * Regla: cada posición `cedula_cotitular_n` encontrada en soportes debe tener
 * un cotitular resuelto en la posición `n`. Si sobra, es soporte huérfano.
 */
export function detectCotitularInconsistencies(
  soportes: readonly SoporteRow[],
  cotitulares: readonly CotitularResolved[],
): string[] {
  const posiciones = detectSoporteCotitularPositions(soportes);
  const out: string[] = [];
  for (const pos of posiciones) {
    if (!cotitulares[pos - 1]) {
      out.push(
        `Inconsistencia documental: existe cédula de cotitular ${pos}, pero el cotitular no está registrado en cliente_data (revisa cotitulares, informacionJuridica.cotitular o intervinientes).`,
      );
    }
  }
  return out;
}

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
