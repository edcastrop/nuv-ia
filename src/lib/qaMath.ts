// NUVIA Financial QA AI — Motor matemático determinístico
// 100% TypeScript puro · sin dependencias externas · testeable

export const QA_MOTOR_VERSION = "1.0.0";

export type Modalidad = "hipotecario" | "leasing" | "uvr";
export type Severidad = "info" | "warning" | "critica";
export type Categoria = "excelente" | "aprobado" | "revisar" | "rechazado";
export type Dictamen = "aprobado" | "aprobado_obs" | "requiere_revision" | "rechazado";
export type InconsistenciaTipo =
  | "tasa" | "seguros" | "cuota" | "frech" | "uvr"
  | "flujo" | "simulacion" | "extracto" | "honorario" | "plazo" | "saldo";

export interface Tolerancias {
  cuotaPct: number;     // %
  cuotaAbs: number;     // COP
  saldoAbs: number;     // COP
  tasaEaAbs: number;    // pp (puntos porcentuales)
  segurosAbs: number;   // COP
  frechAbs: number;     // pp
  simCuotasMax: number; // cuotas
  simAhorroAbs: number; // COP
  penInfo: number;
  penWarning: number;
  penCritica: number;
  penDiffCuotaMax: number;
  penDiffSimMax: number;
  penFaltantesMax: number;
  // Umbrales de dictamen (Fase 2 — configurables vía qa_reglas)
  umbScoreExcelente: number;  // >= excelente → APROBADO
  umbScoreAprobado: number;   // >= aprobado  → APROBADO C/OBS
  umbScoreRevisar: number;    // >= revisar   → REQUIERE REVISIÓN, < → RECHAZADO
}

export const TOLERANCIAS_DEFAULT: Tolerancias = {
  cuotaPct: 0.5, cuotaAbs: 5000, saldoAbs: 10000,
  tasaEaAbs: 0.05, segurosAbs: 2000, frechAbs: 0.10,
  simCuotasMax: 2, simAhorroAbs: 500_000,
  penInfo: 1, penWarning: 5, penCritica: 15,
  penDiffCuotaMax: 10, penDiffSimMax: 25, penFaltantesMax: 10,
  umbScoreExcelente: 95, umbScoreAprobado: 85, umbScoreRevisar: 70,
};


// ──────────────────────────────────────────────────────────────
// 1. Conversiones de tasa
// ──────────────────────────────────────────────────────────────
export const eaToMv = (ea: number) => Math.pow(1 + ea, 1 / 12) - 1;
export const mvToEa = (mv: number) => Math.pow(1 + mv, 12) - 1;
export const eaToNa = (ea: number) => eaToMv(ea) * 12;

// ──────────────────────────────────────────────────────────────
// 2. Cuota teórica (sistema francés)
// ──────────────────────────────────────────────────────────────
export function cuotaTeorica(saldo: number, iPeriodica: number, n: number): number {
  if (n <= 0 || saldo <= 0) return 0;
  if (iPeriodica <= 0) return saldo / n;
  return (saldo * iPeriodica) / (1 - Math.pow(1 + iPeriodica, -n));
}

// ──────────────────────────────────────────────────────────────
// 3. Tabla de amortización
// ──────────────────────────────────────────────────────────────
export interface FilaAmort {
  k: number;
  cuota: number;        // cuota financiera (capital + interés)
  interes: number;
  capital: number;
  seguros: number;      // seguros mensuales aplicados
  cuotaTotal: number;   // cuota + seguros (lo que realmente paga el cliente)
  saldo: number;
}

export function amortizacion(
  saldo: number,
  iPeriodica: number,
  n: number,
  seguros: number = 0,
): FilaAmort[] {
  const C = cuotaTeorica(saldo, iPeriodica, n);
  const seg = Math.max(0, seguros || 0);
  const filas: FilaAmort[] = [];
  let s = saldo;
  for (let k = 1; k <= n; k++) {
    const interes = s * iPeriodica;
    const capital = C - interes;
    s = Math.max(0, s - capital);
    filas.push({ k, cuota: C, interes, capital, seguros: seg, cuotaTotal: C + seg, saldo: s });
  }
  return filas;
}

// ──────────────────────────────────────────────────────────────
// 4. Reconstrucción matemática del crédito
// ──────────────────────────────────────────────────────────────
export interface ReconstruccionInput {
  modalidad: Modalidad;
  saldoCapital: number;
  tasaEa: number;           // % anual efectiva
  cuotasPendientes: number;
  seguros: number;          // COP / mes (total)
  coberturaFrechPp?: number; // pp anuales EA descontados
  valorDesembolsado?: number;
}

export interface Reconstruccion {
  iMv: number;
  cuotaTeorica: number;
  cuotaConSubsidio: number;
  cuotaTotalConSeguros: number;
  beneficioMensualFrech: number;
  costoTotal: number;
  vecesPagado: number;
  primerasCuotas: FilaAmort[];  // 12
  ultimasCuotas: FilaAmort[];   // 12
  totalIntereses: number;
}

export function reconstruir(input: ReconstruccionInput): Reconstruccion {
  const ea = (input.tasaEa || 0) / 100;
  const iMv = eaToMv(ea);
  const n = Math.max(0, Math.round(input.cuotasPendientes));
  const C = cuotaTeorica(input.saldoCapital, iMv, n);

  const cob = input.coberturaFrechPp ? input.coberturaFrechPp / 100 : 0;
  const iSub = cob > 0 ? eaToMv(Math.max(0, ea - cob)) : iMv;
  const CSub = cob > 0 ? cuotaTeorica(input.saldoCapital, iSub, n) : C;
  const beneficio = Math.max(0, C - CSub);

  const seguros = Math.max(0, input.seguros || 0);
  const cuotaTotal = (cob > 0 ? CSub : C) + seguros;

  const tabla = amortizacion(input.saldoCapital, cob > 0 ? iSub : iMv, n);
  const totalIntereses = tabla.reduce((s, f) => s + f.interes, 0);
  const costoTotal = (cob > 0 ? CSub : C) * n + seguros * n;
  const desembolso = input.valorDesembolsado && input.valorDesembolsado > 0
    ? input.valorDesembolsado : input.saldoCapital;
  const veces = desembolso > 0 ? costoTotal / desembolso : 0;

  return {
    iMv,
    cuotaTeorica: C,
    cuotaConSubsidio: CSub,
    cuotaTotalConSeguros: cuotaTotal,
    beneficioMensualFrech: beneficio,
    costoTotal,
    vecesPagado: veces,
    primerasCuotas: tabla.slice(0, 12),
    ultimasCuotas: tabla.slice(-12),
    totalIntereses,
  };
}

// ──────────────────────────────────────────────────────────────
// 5. Comparación contra extracto bancario
// ──────────────────────────────────────────────────────────────
export interface ExtractoSnapshot {
  saldoCapital?: number;
  tasaEa?: number;
  cuota?: number;
  seguros?: number;
  coberturaFrechPp?: number;
}

export interface Inconsistencia {
  tipo: InconsistenciaTipo;
  severidad: Severidad;
  campo?: string;
  valorExtracto?: number;
  valorCalculado?: number;
  diferencia?: number;
  mensaje: string;
  sugerencia?: string;
}

function severidadCuota(diff: number, base: number, tol: Tolerancias): Severidad | null {
  const limit = Math.max(tol.cuotaAbs, (base * tol.cuotaPct) / 100);
  if (Math.abs(diff) <= limit) return null;
  if (Math.abs(diff) > limit * 3) return "critica";
  if (Math.abs(diff) > limit * 1.5) return "warning";
  return "info";
}

export function compararExtracto(
  rec: Reconstruccion,
  ext: ExtractoSnapshot,
  inputRec: ReconstruccionInput,
  tol: Tolerancias,
): Inconsistencia[] {
  const out: Inconsistencia[] = [];

  if (ext.cuota && ext.cuota > 0) {
    const diff = ext.cuota - rec.cuotaTotalConSeguros;
    const sev = severidadCuota(diff, ext.cuota, tol);
    if (sev) {
      out.push({
        tipo: "cuota", severidad: sev, campo: "cuota",
        valorExtracto: ext.cuota, valorCalculado: rec.cuotaTotalConSeguros, diferencia: diff,
        mensaje: `Diferencia en cuota mensual: $${Math.round(diff).toLocaleString("es-CO")}`,
        sugerencia: "Verifique tasa, plazo restante, seguros y cobertura FRECH.",
      });
    }
  }

  if (ext.saldoCapital && ext.saldoCapital > 0) {
    const diff = ext.saldoCapital - inputRec.saldoCapital;
    if (Math.abs(diff) > tol.saldoAbs) {
      out.push({
        tipo: "saldo", severidad: Math.abs(diff) > tol.saldoAbs * 5 ? "critica" : "warning",
        campo: "saldo_capital", valorExtracto: ext.saldoCapital, valorCalculado: inputRec.saldoCapital,
        diferencia: diff,
        mensaje: `Saldo capital extracto vs lectura difiere en $${Math.round(diff).toLocaleString("es-CO")}`,
      });
    }
  }

  if (ext.tasaEa && ext.tasaEa > 0) {
    const diff = ext.tasaEa - inputRec.tasaEa;
    if (Math.abs(diff) > tol.tasaEaAbs) {
      out.push({
        tipo: "tasa", severidad: Math.abs(diff) > 0.5 ? "critica" : "warning",
        campo: "tasa_ea", valorExtracto: ext.tasaEa, valorCalculado: inputRec.tasaEa,
        diferencia: diff, mensaje: `Tasa EA difiere en ${diff.toFixed(2)} pp`,
        sugerencia: "Revise si la tasa registrada es la efectiva pactada vigente.",
      });
    }
  }

  if (ext.seguros !== undefined && ext.seguros >= 0 && inputRec.seguros >= 0) {
    const diff = ext.seguros - inputRec.seguros;
    if (Math.abs(diff) > tol.segurosAbs) {
      out.push({
        tipo: "seguros", severidad: "warning",
        campo: "seguros", valorExtracto: ext.seguros, valorCalculado: inputRec.seguros,
        diferencia: diff, mensaje: `Total seguros difiere en $${Math.round(diff).toLocaleString("es-CO")}`,
      });
    }
  }

  if (ext.coberturaFrechPp !== undefined && (inputRec.coberturaFrechPp ?? 0) > 0) {
    const diff = (ext.coberturaFrechPp ?? 0) - (inputRec.coberturaFrechPp ?? 0);
    if (Math.abs(diff) > tol.frechAbs) {
      out.push({
        tipo: "frech", severidad: "warning",
        campo: "cobertura_frech", valorExtracto: ext.coberturaFrechPp,
        valorCalculado: inputRec.coberturaFrechPp, diferencia: diff,
        mensaje: `Cobertura FRECH difiere en ${diff.toFixed(2)} pp`,
      });
    }
  }

  return out;
}

// ──────────────────────────────────────────────────────────────
// 6. Comparación contra simulación del analista NUVEX
// ──────────────────────────────────────────────────────────────
export interface SimulacionAnalista {
  cuotasEliminadas?: number;
  ahorroProyectado?: number;
  nuevoPlazo?: number;
}

export function compararSimulacion(
  rec: Reconstruccion,
  inputRec: ReconstruccionInput,
  sim: SimulacionAnalista,
  tol: Tolerancias,
): Inconsistencia[] {
  const out: Inconsistencia[] = [];
  if (sim.ahorroProyectado !== undefined && sim.ahorroProyectado > 0) {
    const ahorroReal = rec.totalIntereses; // ahorro máximo teórico si se pagara totalidad
    const diff = sim.ahorroProyectado - ahorroReal;
    if (Math.abs(diff) > tol.simAhorroAbs) {
      out.push({
        tipo: "simulacion", severidad: Math.abs(diff) > tol.simAhorroAbs * 3 ? "critica" : "warning",
        campo: "ahorro_proyectado", valorExtracto: sim.ahorroProyectado, valorCalculado: ahorroReal,
        diferencia: diff,
        mensaje: `Ahorro proyectado por el analista difiere de la reconstrucción matemática en $${Math.round(diff).toLocaleString("es-CO")}`,
        sugerencia: "Recalcule honorarios y oferta al cliente con la cifra matemática.",
      });
    }
  }
  if (sim.nuevoPlazo !== undefined && sim.nuevoPlazo > 0) {
    if (sim.nuevoPlazo > inputRec.cuotasPendientes) {
      out.push({
        tipo: "plazo", severidad: "warning", campo: "nuevo_plazo",
        valorExtracto: sim.nuevoPlazo, valorCalculado: inputRec.cuotasPendientes,
        mensaje: "El nuevo plazo simulado excede las cuotas pendientes del extracto.",
      });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// 7. Score, categoría y dictamen
// ──────────────────────────────────────────────────────────────
export interface ScoreResultado {
  score: number;
  categoria: Categoria;
  dictamen: Dictamen;
  penalizaciones: { tipo: string; valor: number }[];
}

export function calcularScore(
  inconsistencias: Inconsistencia[],
  faltantes: number,
  tol: Tolerancias,
): ScoreResultado {
  let score = 100;
  const pen: { tipo: string; valor: number }[] = [];

  const add = (tipo: string, v: number) => { if (v > 0) { pen.push({ tipo, valor: v }); score -= v; } };

  const info = inconsistencias.filter((i) => i.severidad === "info").length;
  const warn = inconsistencias.filter((i) => i.severidad === "warning").length;
  const crit = inconsistencias.filter((i) => i.severidad === "critica").length;
  add("inconsistencias_info", info * tol.penInfo);
  add("inconsistencias_warning", warn * tol.penWarning);
  add("inconsistencias_critica", crit * tol.penCritica);

  const diffCuota = inconsistencias.find((i) => i.tipo === "cuota");
  if (diffCuota) add("diff_cuota", Math.min(tol.penDiffCuotaMax, 5));
  const diffSim = inconsistencias.find((i) => i.tipo === "simulacion");
  if (diffSim) add("diff_simulacion", Math.min(tol.penDiffSimMax, 10));
  add("campos_faltantes", Math.min(tol.penFaltantesMax, faltantes * 2));

  score = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

  let categoria: Categoria;
  if (score >= tol.umbScoreExcelente) categoria = "excelente";
  else if (score >= tol.umbScoreAprobado) categoria = "aprobado";
  else if (score >= tol.umbScoreRevisar) categoria = "revisar";
  else categoria = "rechazado";

  let dictamen: Dictamen;
  if (crit > 0) dictamen = "rechazado";
  else if (score >= tol.umbScoreExcelente) dictamen = "aprobado";
  else if (score >= tol.umbScoreAprobado) dictamen = "aprobado_obs";
  else if (score >= tol.umbScoreRevisar) dictamen = "requiere_revision";
  else dictamen = "rechazado";

  return { score, categoria, dictamen, penalizaciones: pen };
}

// ──────────────────────────────────────────────────────────────
// 8. Auditoría completa (orquestador puro)
// ──────────────────────────────────────────────────────────────
export interface AuditarInput {
  modalidad: Modalidad;
  reconstruccion: ReconstruccionInput;
  extracto: ExtractoSnapshot;
  simulacion?: SimulacionAnalista;
  tolerancias?: Partial<Tolerancias>;
}

export interface AuditarOutput {
  motorVersion: string;
  reconstruccion: Reconstruccion;
  inconsistencias: Inconsistencia[];
  score: ScoreResultado;
  faltantes: string[];
}

function camposFaltantes(input: AuditarInput): string[] {
  const f: string[] = [];
  const r = input.reconstruccion, e = input.extracto;
  if (!r.saldoCapital) f.push("saldoCapital");
  if (!r.tasaEa) f.push("tasaEa");
  if (!r.cuotasPendientes) f.push("cuotasPendientes");
  if (e.cuota === undefined) f.push("extracto.cuota");
  if (e.saldoCapital === undefined) f.push("extracto.saldoCapital");
  return f;
}

export function auditar(input: AuditarInput): AuditarOutput {
  const tol: Tolerancias = { ...TOLERANCIAS_DEFAULT, ...(input.tolerancias ?? {}) };
  const rec = reconstruir(input.reconstruccion);
  const incExt = compararExtracto(rec, input.extracto, input.reconstruccion, tol);
  const incSim = input.simulacion
    ? compararSimulacion(rec, input.reconstruccion, input.simulacion, tol)
    : [];
  const faltantes = camposFaltantes(input);
  const incs = [...incExt, ...incSim];
  const score = calcularScore(incs, faltantes.length, tol);
  return { motorVersion: QA_MOTOR_VERSION, reconstruccion: rec, inconsistencias: incs, score, faltantes };
}

// Etiquetas amigables
export const dictamenLabel: Record<Dictamen, string> = {
  aprobado: "APROBADO",
  aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN",
  rechazado: "RECHAZADO",
};
export const categoriaLabel: Record<Categoria, string> = {
  excelente: "EXCELENTE",
  aprobado: "APROBADO",
  revisar: "REVISAR",
  rechazado: "RECHAZADO",
};
