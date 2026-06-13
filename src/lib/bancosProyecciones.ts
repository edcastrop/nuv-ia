// Catálogo dinámico de bancos que emiten proyecciones de cierre y motor
// puro (isomórfico) de verificación entre la propuesta del cliente y lo
// que el banco realmente aplicó. Sin dependencias de Supabase para poder
// reusarse desde server fns y desde componentes.

/**
 * Whitelist de bancos que SÍ emiten proyecciones formales al cierre del caso.
 * Cualquier banco fuera de esta lista debe verificarse contra el próximo
 * extracto post-ejecución, no contra una proyección.
 *
 * Si el día de mañana cambia, sólo hay que editar este array.
 */
export const BANCOS_CON_PROYECCIONES_CIERRE: ReadonlyArray<{
  key: string;
  label: string;
}> = [
  { key: "davivienda", label: "Davivienda" },
  { key: "davibank", label: "Davibank" },
  { key: "caja_social", label: "Banco Caja Social" },
  { key: "banco_bogota", label: "Banco de Bogotá" },
  { key: "leasing_bancolombia", label: "Leasing Bancolombia" },
  { key: "fna", label: "FNA" },
];

/**
 * Bancos explícitamente excluidos. Se muestra una nota informativa al
 * analista para que sepa por qué no verá el dropzone de cierre.
 */
export const BANCOS_SIN_PROYECCIONES_CIERRE: ReadonlyArray<{
  key: string;
  label: string;
  motivo: string;
}> = [
  {
    key: "bancolombia_hipotecario",
    label: "Bancolombia (hipotecario)",
    motivo:
      "Bancolombia hipotecario no emite proyecciones de cierre. NUVIA verificará el resultado contra el próximo extracto post-ejecución que cargues.",
  },
];

export function normalizarBanco(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Heurística suave: acepta variantes como "Banco de Bogotá", "BdB", "davi", etc. */
function matchBanco(norm: string, candidates: string[]): boolean {
  if (!norm) return false;
  for (const c of candidates) {
    if (norm === c || norm.includes(c) || c.includes(norm)) return true;
  }
  return false;
}

export function bancoGeneraProyeccionesCierre(banco: string | null | undefined): boolean {
  const norm = normalizarBanco(banco);
  if (!norm) return false;
  // Excluir explícitamente los que NO generan (Bancolombia hipotecario)
  if (matchBanco(norm, ["bancolombia_hipotecario", "bancolombia"])) {
    // Pero leasing_bancolombia sí genera → lo dejamos pasar
    if (matchBanco(norm, ["leasing_bancolombia", "leasing"])) {
      return true;
    }
    return false;
  }
  const keys = BANCOS_CON_PROYECCIONES_CIERRE.map((b) => b.key);
  return matchBanco(norm, keys) ||
    // Aliases comunes
    matchBanco(norm, ["davivienda", "davibank", "caja_social", "bogota", "bdb", "fna"]);
}

export function motivoSinProyecciones(banco: string | null | undefined): string | null {
  const norm = normalizarBanco(banco);
  if (!norm) return null;
  const m = BANCOS_SIN_PROYECCIONES_CIERRE.find((b) => matchBanco(norm, [b.key, "bancolombia"]));
  return m?.motivo ?? null;
}

// ============================================================================
// Motor de verificación: compara propuesta vs proyección de cierre
// ============================================================================

export type EstadoCheck = "ok" | "leve" | "critico" | "sin_dato";

export interface CheckItem {
  campo: string;
  etiqueta: string;
  propuesta: number | string | null;
  ejecutado: number | string | null;
  delta: number | null;
  estado: EstadoCheck;
  comentario: string;
}

export interface VerificacionCierre {
  generadoAt: string;
  banco: string;
  items: CheckItem[];
  resumen: {
    ok: number;
    leve: number;
    critico: number;
    sinDato: number;
  };
  veredicto:
    | "cumplido"
    | "cumplido_con_observaciones"
    | "no_cumplido";
  mensajeCliente: string;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toleranciaRelativa(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base;
}

function clasificarNumerico(
  propuesta: number | null,
  ejecutado: number | null,
  tolLeve = 0.02,
  tolCritico = 0.08,
): { estado: EstadoCheck; delta: number | null } {
  if (propuesta == null || ejecutado == null) return { estado: "sin_dato", delta: null };
  const delta = ejecutado - propuesta;
  const rel = toleranciaRelativa(propuesta, ejecutado);
  if (rel <= tolLeve) return { estado: "ok", delta };
  if (rel <= tolCritico) return { estado: "leve", delta };
  return { estado: "critico", delta };
}

function fmtMoneda(n: number | null): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function comentarioMonetario(
  etiqueta: string,
  prop: number | null,
  exec: number | null,
  estado: EstadoCheck,
): string {
  if (estado === "sin_dato") {
    return `No hay datos suficientes para verificar ${etiqueta.toLowerCase()}. Pídele al banco la cifra clara o súbele otra proyección a NUVIA.`;
  }
  if (estado === "ok") {
    return `${etiqueta} coincide con la propuesta del cliente. Quedó tal como se prometió.`;
  }
  if (prop == null || exec == null) return "";
  const diff = exec - prop;
  const signo = diff >= 0 ? "+" : "−";
  if (estado === "leve") {
    return `${etiqueta} quedó ${fmtMoneda(exec)} (propuesta era ${fmtMoneda(prop)}, diferencia ${signo}${fmtMoneda(Math.abs(diff))}). Diferencia pequeña, normal por redondeos del banco.`;
  }
  return `${etiqueta} quedó en ${fmtMoneda(exec)} pero al cliente le prometimos ${fmtMoneda(prop)}. Diferencia ${signo}${fmtMoneda(Math.abs(diff))}. El banco NO aplicó lo pactado — debes reclamar antes de cerrar el caso.`;
}

function comentarioEntero(
  etiqueta: string,
  prop: number | null,
  exec: number | null,
  estado: EstadoCheck,
  unidad = "cuotas",
): string {
  if (estado === "sin_dato") return `Sin datos para verificar ${etiqueta.toLowerCase()}.`;
  if (estado === "ok") return `${etiqueta} coincide con la propuesta.`;
  if (prop == null || exec == null) return "";
  const diff = Math.round(exec - prop);
  if (estado === "leve") {
    return `${etiqueta}: ${exec} ${unidad} (propuesta era ${prop}). Diferencia de ${Math.abs(diff)} ${unidad}.`;
  }
  return `${etiqueta}: ${exec} ${unidad} vs ${prop} ${unidad} prometidos. El banco no aplicó el plazo pactado, reclamar.`;
}

/**
 * Calcula la verificación cruzando la propuesta del cliente (lo que se le
 * prometió) contra los datos extraídos de la proyección de cierre del banco.
 *
 * `propuestaData` puede venir de `expedientes.propuesta_data` o `aprobado_data`.
 * Mapeamos los campos más comunes pero tolerando ausencias.
 */
export function calcularVerificacionCierre(opts: {
  banco: string;
  propuestaData: Record<string, unknown> | null | undefined;
  proyeccionData: Record<string, unknown> | null | undefined;
}): VerificacionCierre {
  const p = (opts.propuestaData ?? {}) as Record<string, unknown>;
  const e = (opts.proyeccionData ?? {}) as Record<string, unknown>;
  const items: CheckItem[] = [];

  // Helpers para leer campos comunes
  const propSaldo = num(p.saldoObjetivo ?? p.saldoCapital ?? p.nuevoSaldo);
  const execSaldo = num(e.saldoCapital);
  {
    const c = clasificarNumerico(propSaldo, execSaldo);
    items.push({
      campo: "saldoCapital",
      etiqueta: "Saldo a capital tras la operación",
      propuesta: propSaldo,
      ejecutado: execSaldo,
      delta: c.delta,
      estado: c.estado,
      comentario: comentarioMonetario("Saldo a capital", propSaldo, execSaldo, c.estado),
    });
  }

  const propCuota = num(p.cuotaObjetivo ?? p.cuotaNueva ?? p.cuotaMensual ?? p.cuotaPropuesta);
  const execCuota = num(e.cuotaPagadaCliente ?? e.valorAPagar ?? e.cuotaMensual ?? e.cuotaConInteresSinSeguros);
  {
    const c = clasificarNumerico(propCuota, execCuota);
    items.push({
      campo: "cuota",
      etiqueta: "Cuota mensual",
      propuesta: propCuota,
      ejecutado: execCuota,
      delta: c.delta,
      estado: c.estado,
      comentario: comentarioMonetario("Cuota mensual", propCuota, execCuota, c.estado),
    });
  }

  const propTasa = num(p.tasaPactada ?? p.tasaObjetivo ?? p.tea ?? p.nuevaTasa);
  const execTasa = num(e.teaCobrada ?? e.tea ?? e.teaPactada);
  {
    const c = clasificarNumerico(propTasa, execTasa, 0.005, 0.02); // 0.5% / 2% tolerancia
    items.push({
      campo: "tasa",
      etiqueta: "Tasa EA aplicada",
      propuesta: propTasa,
      ejecutado: execTasa,
      delta: c.delta,
      estado: c.estado,
      comentario:
        c.estado === "ok"
          ? "La tasa que aplicó el banco coincide con la pactada."
          : c.estado === "sin_dato"
            ? "No pudimos leer la tasa en la proyección. Verifica manualmente."
            : c.estado === "leve"
              ? `Tasa quedó en ${execTasa?.toFixed(2)}% (pactada ${propTasa?.toFixed(2)}%). Diferencia mínima, aceptable.`
              : `Tasa quedó en ${execTasa?.toFixed(2)}% pero al cliente se le prometió ${propTasa?.toFixed(2)}%. Reclamar al banco antes de cerrar.`,
    });
  }

  const propPlazo = num(p.plazoObjetivo ?? p.nuevoPlazo ?? p.cuotasPendientesObjetivo ?? p.cuotasPactadas);
  const execPlazo = num(e.cuotasPendientes ?? e.plazoRestante);
  {
    const c = clasificarNumerico(propPlazo, execPlazo, 0.01, 0.05);
    items.push({
      campo: "plazo",
      etiqueta: "Cuotas pendientes / plazo restante",
      propuesta: propPlazo,
      ejecutado: execPlazo,
      delta: c.delta,
      estado: c.estado,
      comentario: comentarioEntero("Cuotas pendientes", propPlazo, execPlazo, c.estado, "cuotas"),
    });
  }

  // Resumen
  const resumen = items.reduce(
    (acc, it) => {
      acc[it.estado === "critico" ? "critico" : it.estado === "leve" ? "leve" : it.estado === "ok" ? "ok" : "sinDato"]++;
      return acc;
    },
    { ok: 0, leve: 0, critico: 0, sinDato: 0 },
  );

  let veredicto: VerificacionCierre["veredicto"] = "cumplido";
  let mensajeCliente = "El banco aplicó la propuesta tal como se le prometió al cliente. El caso puede cerrarse con éxito.";
  if (resumen.critico > 0) {
    veredicto = "no_cumplido";
    mensajeCliente = "El banco NO aplicó la propuesta como se pactó. NUVIA detectó diferencias importantes que debes reclamar antes de cerrar.";
  } else if (resumen.leve > 0) {
    veredicto = "cumplido_con_observaciones";
    mensajeCliente = "El banco aplicó la propuesta con pequeñas desviaciones (normales por redondeo). El caso puede cerrarse pero revisa los puntos marcados.";
  }

  return {
    generadoAt: new Date().toISOString(),
    banco: opts.banco,
    items,
    resumen,
    veredicto,
    mensajeCliente,
  };
}
