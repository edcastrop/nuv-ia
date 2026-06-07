// NUVEX Financial Audit Engine™
// Motor puro de validación. NO depende de UI ni de Supabase.
// Cubre Fase 1 (extracto vs analista), Fase 2 (consistencia matemática),
// Fase 3 (Confidence Score), Fase 4 (clasificación de riesgo) y
// Fase 5 (auditoría de propuesta) descritas en el brief.

export type Severidad = "critica" | "alta" | "media" | "info";

export interface Inconsistencia {
  campo: string;
  mensaje: string;
  severidad: Severidad;
  valorExtracto?: number | string | null;
  valorAnalista?: number | string | null;
}

export type NivelRiesgo = "apto" | "revisar" | "escalar";

// ----------------------------------------------------------------
// Tipos de entrada
// ----------------------------------------------------------------

export interface DatosExtracto {
  banco?: string;
  producto?: string;
  saldoCapital?: number;
  cuotaActual?: number;
  seguros?: number;
  teaPct?: number;
  uvr?: number;
  plazoInicial?: number;
  cuotasPagadas?: number;
  cuotasPendientes?: number;
  freshActivo?: boolean;
  valorFresh?: number;
  tasaFresh?: number;
}

export interface DatosAnalista extends DatosExtracto {}

export interface DatosPropuesta {
  cuotaActual: number;
  cuotasPendientes: number;
  nuevaCuota: number;
  nuevoPlazo: number;
  cuotasEliminadas: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
}

// ----------------------------------------------------------------
// Fase 1: comparación extracto vs analista
// ----------------------------------------------------------------

export interface ComparacionCampo {
  campo: string;
  label: string;
  valorExtracto: number | string | null;
  valorAnalista: number | string | null;
  diferenciaPct?: number;
  ok: boolean;
}

const TOLERANCIA_MONEDA_PCT = 0.5; // 0.5% para montos
const TOLERANCIA_TASA_PCT = 2; // 2% relativo para TEA
const TOLERANCIA_ENTERO = 1; // ±1 para cuotas/plazos

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const diffPctRel = (a: number, b: number): number => {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base * 100;
};

function comparar(
  campo: keyof DatosExtracto,
  label: string,
  ext: DatosExtracto,
  ana: DatosAnalista,
  tipo: "moneda" | "tasa" | "entero" | "texto",
): ComparacionCampo {
  const ve = ext[campo] as number | string | undefined;
  const va = ana[campo] as number | string | undefined;
  const vExt = ve === undefined ? null : ve;
  const vAna = va === undefined ? null : va;

  if (tipo === "texto") {
    const ok =
      vExt === null ||
      vAna === null ||
      String(vExt).trim().toLowerCase() === String(vAna).trim().toLowerCase();
    return { campo, label, valorExtracto: vExt, valorAnalista: vAna, ok };
  }

  const ne = num(vExt);
  const na = num(vAna);
  // Si el extracto no aporta el dato, no penalizamos.
  if (ne === null || na === null) {
    return { campo, label, valorExtracto: vExt, valorAnalista: vAna, ok: true };
  }
  const dp = diffPctRel(ne, na);
  let ok = true;
  if (tipo === "moneda") ok = dp <= TOLERANCIA_MONEDA_PCT;
  else if (tipo === "tasa") ok = dp <= TOLERANCIA_TASA_PCT;
  else if (tipo === "entero") ok = Math.abs(ne - na) <= TOLERANCIA_ENTERO;
  return { campo, label, valorExtracto: ne, valorAnalista: na, diferenciaPct: dp, ok };
}

export function validarExtractoVsAnalista(
  extracto: DatosExtracto,
  analista: DatosAnalista,
): { comparaciones: ComparacionCampo[]; inconsistencias: Inconsistencia[]; coincidenciaPct: number } {
  const checks: ComparacionCampo[] = [
    comparar("banco", "Banco", extracto, analista, "texto"),
    comparar("producto", "Producto", extracto, analista, "texto"),
    comparar("saldoCapital", "Saldo a capital", extracto, analista, "moneda"),
    comparar("cuotaActual", "Cuota actual", extracto, analista, "moneda"),
    comparar("seguros", "Seguros", extracto, analista, "moneda"),
    comparar("teaPct", "TEA", extracto, analista, "tasa"),
    comparar("uvr", "UVR", extracto, analista, "moneda"),
    comparar("plazoInicial", "Plazo inicial", extracto, analista, "entero"),
    comparar("cuotasPagadas", "Cuotas pagadas", extracto, analista, "entero"),
    comparar("cuotasPendientes", "Cuotas pendientes", extracto, analista, "entero"),
    comparar("valorFresh", "Valor Fresh", extracto, analista, "moneda"),
    comparar("tasaFresh", "Tasa Fresh", extracto, analista, "tasa"),
  ];

  const inconsistencias: Inconsistencia[] = [];
  for (const c of checks) {
    if (!c.ok) {
      const sev: Severidad =
        c.diferenciaPct !== undefined && c.diferenciaPct > 3 ? "critica" : "alta";
      inconsistencias.push({
        campo: c.campo,
        mensaje: `${c.label}: diferencia ${c.diferenciaPct?.toFixed(2) ?? "—"}% entre extracto y digitación`,
        severidad: sev,
        valorExtracto: c.valorExtracto,
        valorAnalista: c.valorAnalista,
      });
    }
  }
  const evaluables = checks.filter(
    (c) => c.valorExtracto !== null && c.valorAnalista !== null,
  );
  const aciertos = evaluables.filter((c) => c.ok).length;
  const coincidenciaPct = evaluables.length === 0 ? 100 : (aciertos / evaluables.length) * 100;
  return { comparaciones: checks, inconsistencias, coincidenciaPct };
}

// ----------------------------------------------------------------
// Fase 2: consistencia matemática
// ----------------------------------------------------------------

export function validarConsistenciaMatematica(
  d: DatosAnalista,
): { inconsistencias: Inconsistencia[]; aciertos: number; total: number } {
  const issues: Inconsistencia[] = [];
  let aciertos = 0;
  let total = 0;

  const check = (cond: boolean, campo: string, mensaje: string, sev: Severidad = "alta") => {
    total++;
    if (cond) aciertos++;
    else issues.push({ campo, mensaje, severidad: sev });
  };

  const plazo = num(d.plazoInicial) ?? 0;
  const pagadas = num(d.cuotasPagadas) ?? 0;
  const pendientes = num(d.cuotasPendientes) ?? 0;
  const cuota = num(d.cuotaActual) ?? 0;
  const seguros = num(d.seguros) ?? 0;
  const tea = num(d.teaPct) ?? 0;

  if (plazo > 0) {
    check(
      Math.abs(pagadas + pendientes - plazo) <= 1,
      "plazoInicial",
      `Cuotas pagadas (${pagadas}) + pendientes (${pendientes}) ≠ plazo inicial (${plazo})`,
      "critica",
    );
  }
  if (cuota > 0) {
    check(seguros < cuota, "seguros", `Seguros (${seguros}) ≥ cuota total (${cuota})`, "critica");
    check(cuota - seguros > 0, "cuotaActual", "Cuota sin seguros ≤ 0", "critica");
  }
  if (tea > 0) {
    check(tea >= 1 && tea <= 60, "teaPct", `TEA fuera de rango razonable (${tea}%)`, "alta");
  }
  return { inconsistencias: issues, aciertos, total };
}

export function validarPropuesta(p: DatosPropuesta): Inconsistencia[] {
  const out: Inconsistencia[] = [];
  if (!(p.ahorroTotal > 0)) {
    out.push({ campo: "ahorroTotal", mensaje: "Ahorro total no es positivo", severidad: "critica" });
  }
  if (!(p.nuevaCuota > 0)) {
    out.push({ campo: "nuevaCuota", mensaje: "Nueva cuota inválida", severidad: "critica" });
  }
  if (!(p.nuevoPlazo > 0 && p.nuevoPlazo <= p.cuotasPendientes)) {
    out.push({
      campo: "nuevoPlazo",
      mensaje: `Nuevo plazo (${p.nuevoPlazo}) debe ser > 0 y ≤ cuotas pendientes (${p.cuotasPendientes})`,
      severidad: "critica",
    });
  }
  const cuotasEsperadas = p.cuotasPendientes - p.nuevoPlazo;
  if (Math.abs(cuotasEsperadas - p.cuotasEliminadas) > 1) {
    out.push({
      campo: "cuotasEliminadas",
      mensaje: `Cuotas eliminadas (${p.cuotasEliminadas}) no coincide con pendientes − nuevo plazo (${cuotasEsperadas})`,
      severidad: "alta",
    });
  }
  const sumaAhorros = p.ahorroIntereses + p.ahorroSeguros;
  if (sumaAhorros > 0 && Math.abs(sumaAhorros - p.ahorroTotal) / Math.max(p.ahorroTotal, 1) > 0.02) {
    out.push({
      campo: "ahorroTotal",
      mensaje: "Ahorro total no cuadra con intereses + seguros",
      severidad: "alta",
    });
  }
  if (p.honorarios < 0) {
    out.push({ campo: "honorarios", mensaje: "Honorarios negativos", severidad: "critica" });
  }
  return out;
}

// ----------------------------------------------------------------
// Fase 3: Confidence Score (40 / 30 / 20 / 10)
// ----------------------------------------------------------------

export interface ConfidenceScoreInput {
  coincidenciaExtractoPct: number; // 0..100
  matematicaAciertos: number;
  matematicaTotal: number;
  camposCompletosPct: number; // 0..100
  validacionesDocumentalesPct: number; // 0..100
}

export interface ConfidenceScore {
  extracto: number; // 0..40
  matematica: number; // 0..30
  campos: number; // 0..20
  documental: number; // 0..10
  total: number; // 0..100
  nivelRiesgo: NivelRiesgo;
}

export function calcularConfidenceScore(i: ConfidenceScoreInput): ConfidenceScore {
  const extracto = Math.round((Math.max(0, Math.min(100, i.coincidenciaExtractoPct)) / 100) * 40);
  const matRatio = i.matematicaTotal === 0 ? 1 : i.matematicaAciertos / i.matematicaTotal;
  const matematica = Math.round(matRatio * 30);
  const campos = Math.round((Math.max(0, Math.min(100, i.camposCompletosPct)) / 100) * 20);
  const documental = Math.round((Math.max(0, Math.min(100, i.validacionesDocumentalesPct)) / 100) * 10);
  const total = Math.max(0, Math.min(100, extracto + matematica + campos + documental));
  const nivelRiesgo: NivelRiesgo = total >= 95 ? "apto" : total >= 85 ? "revisar" : "escalar";
  return { extracto, matematica, campos, documental, total, nivelRiesgo };
}

export function calcularCamposCompletosPct(d: DatosAnalista): number {
  const obligatorios: (keyof DatosAnalista)[] = [
    "banco",
    "producto",
    "saldoCapital",
    "cuotaActual",
    "seguros",
    "teaPct",
    "plazoInicial",
    "cuotasPagadas",
    "cuotasPendientes",
  ];
  const llenos = obligatorios.filter((k) => {
    const v = d[k];
    return v !== undefined && v !== null && String(v) !== "";
  }).length;
  return (llenos / obligatorios.length) * 100;
}

// ----------------------------------------------------------------
// Fase 4: clasificación de alto riesgo
// ----------------------------------------------------------------

export interface ClasificacionRiesgoInput {
  moneda?: "pesos" | "uvr";
  banco?: string;
  producto?: string;
  inconsistencias: Inconsistencia[];
  score: number;
  comparaciones?: ComparacionCampo[];
}

export interface ClasificacionRiesgo {
  requiereRevision: boolean;
  motivo: string | null;
  factores: string[];
}

const BANCOS_CONOCIDOS = new Set([
  "bancolombia",
  "davivienda",
  "bbva",
  "bogota",
  "banco de bogota",
  "av villas",
  "colpatria",
  "itau",
  "scotiabank",
  "popular",
  "caja social",
]);

export function clasificarRiesgo(i: ClasificacionRiesgoInput): ClasificacionRiesgo {
  const factores: string[] = [];

  if (i.moneda === "uvr") factores.push("Crédito en UVR (alta complejidad)");
  if (i.score < 85) factores.push(`Score insuficiente (${i.score})`);

  const diffMayor3 = (i.comparaciones ?? []).some(
    (c) => !c.ok && (c.diferenciaPct ?? 0) > 3,
  );
  if (diffMayor3) factores.push("Diferencia extracto vs digitación > 3%");

  const teaIssue = i.inconsistencias.find((x) => x.campo === "teaPct");
  if (teaIssue) factores.push("Tasa atípica o fuera de rango");

  if (!i.producto) factores.push("Producto no identificado");

  if (i.banco && !BANCOS_CONOCIDOS.has(i.banco.trim().toLowerCase())) {
    factores.push("Banco sin historial suficiente");
  }

  const requiereRevision = factores.length > 0;
  return {
    requiereRevision,
    motivo: requiereRevision ? "REQUIERE REVISIÓN DIRECCIÓN FINANCIERA" : null,
    factores,
  };
}

// ----------------------------------------------------------------
// Orquestador: auditoría completa de una simulación
// ----------------------------------------------------------------

export interface AuditoriaInput {
  moneda?: "pesos" | "uvr";
  extracto: DatosExtracto;
  analista: DatosAnalista;
  propuesta?: DatosPropuesta;
  validacionesDocumentalesPct?: number;
}

export interface AuditoriaResultado {
  score: ConfidenceScore;
  comparaciones: ComparacionCampo[];
  inconsistencias: Inconsistencia[];
  clasificacion: ClasificacionRiesgo;
  coincidenciaExtractoPct: number;
  camposCompletosPct: number;
  puedeGenerarPdf: boolean;
}

export function auditarSimulacion(i: AuditoriaInput): AuditoriaResultado {
  const f1 = validarExtractoVsAnalista(i.extracto, i.analista);
  const f2 = validarConsistenciaMatematica(i.analista);
  const f5 = i.propuesta ? validarPropuesta(i.propuesta) : [];

  const camposCompletosPct = calcularCamposCompletosPct(i.analista);
  const score = calcularConfidenceScore({
    coincidenciaExtractoPct: f1.coincidenciaPct,
    matematicaAciertos: f2.aciertos,
    matematicaTotal: f2.total,
    camposCompletosPct,
    validacionesDocumentalesPct: i.validacionesDocumentalesPct ?? 80,
  });

  const inconsistencias = [...f1.inconsistencias, ...f2.inconsistencias, ...f5];
  const clasificacion = clasificarRiesgo({
    moneda: i.moneda,
    banco: i.analista.banco,
    producto: i.analista.producto,
    inconsistencias,
    score: score.total,
    comparaciones: f1.comparaciones,
  });

  const tieneCriticas = inconsistencias.some((x) => x.severidad === "critica");
  const puedeGenerarPdf = !tieneCriticas && score.total >= 85;

  return {
    score,
    comparaciones: f1.comparaciones,
    inconsistencias,
    clasificacion,
    coincidenciaExtractoPct: f1.coincidenciaPct,
    camposCompletosPct,
    puedeGenerarPdf,
  };
}
