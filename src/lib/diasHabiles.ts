// Suma días hábiles (excluye sábado/domingo y festivos Colombia).
// V1: festivos 2026 estáticos. Ampliar tabla a medida que se necesite.

const FESTIVOS_CO: string[] = [
  // 2026 — festivos oficiales Colombia (YYYY-MM-DD)
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos
  "2026-03-23", // San José
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión
  "2026-06-08", // Corpus Christi
  "2026-06-15", // Sagrado Corazón
  "2026-06-29", // San Pedro y San Pablo
  "2026-07-20", // Independencia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // Asunción de la Virgen
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos
  "2026-11-16", // Independencia de Cartagena
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
  // 2027 (parcial — Año Nuevo + Reyes)
  "2027-01-01",
  "2027-01-11",
];

const FESTIVOS_SET = new Set(FESTIVOS_CO);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function esHabil(d: Date): boolean {
  const dow = d.getDay(); // 0=dom, 6=sab
  if (dow === 0 || dow === 6) return false;
  if (FESTIVOS_SET.has(isoDate(d))) return false;
  return true;
}

/**
 * Suma N días hábiles a la fecha dada (no cuenta el día de partida).
 */
export function sumarDiasHabiles(base: Date, diasHabiles: number): Date {
  const d = new Date(base.getTime());
  let restantes = Math.max(0, Math.floor(diasHabiles));
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    if (esHabil(d)) restantes -= 1;
  }
  return d;
}

/**
 * Días hábiles que faltan entre hoy y una fecha objetivo.
 * Si la fecha ya pasó, retorna número negativo.
 */
export function diasHabilesHasta(target: Date | string, from: Date = new Date()): number {
  const t = typeof target === "string" ? new Date(target) : target;
  if (t.getTime() < from.getTime()) {
    // contar negativos hábiles
    let n = 0;
    const d = new Date(from.getTime());
    while (d.getTime() > t.getTime()) {
      d.setDate(d.getDate() - 1);
      if (esHabil(d)) n -= 1;
      if (n < -365) break;
    }
    return n;
  }
  let n = 0;
  const d = new Date(from.getTime());
  while (d.getTime() < t.getTime()) {
    d.setDate(d.getDate() + 1);
    if (esHabil(d)) n += 1;
    if (n > 365) break;
  }
  return n;
}
