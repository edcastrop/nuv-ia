import { formatCOP, formatNumber } from "../../lib/format";
import { NUVEX } from "./constants";

export interface CellStyle {
  bg?: string;
  color?: string;
  fontWeight?: number;
}

export interface ScenarioRow {
  concepto: string;
  actual: string;
  optimizado: string;
  actualStyle?: CellStyle;
  optimizadoStyle?: CellStyle;
}

const BORDER = "#DDE3EA";
const EMPHASIS_KEYS = [
  "cuota mensual",
  "total a pagar",
  "número de veces",
  "ahorro en intereses",
  "ahorro en seguros",
  "ahorro total",
];

function isEmphasized(label: string) {
  const l = label.toLowerCase();
  return EMPHASIS_KEYS.some((k) => l.includes(k));
}

export function getVecesStyle(n: number): { bg: string; color: string } {
  if (!isFinite(n) || n <= 0) return { bg: "#F4FBF6", color: NUVEX.verdeTextoFuerte };
  if (n <= 1.30) return { bg: "#E7F8EC", color: "#1F7A45" };
  if (n <= 1.60) return { bg: "#FEF7C3", color: "#854D0E" };
  if (n <= 2.00) return { bg: "#FFF4E5", color: "#B54708" };
  return { bg: "#FEE4E2", color: "#B42318" };
}

export function ScenarioTable({ rows }: { rows: ScenarioRow[] }) {
  return (
    <div
      className="nuvex-avoid-break overflow-hidden bg-white h-full"
      style={{
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 3px rgba(36,36,36,0.04), 0 4px 12px rgba(36,36,36,0.04)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th
              className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: NUVEX.negro, border: `1px solid ${BORDER}` }}
            >
              Concepto
            </th>
            <th
              className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: NUVEX.azul, border: `1px solid ${BORDER}` }}
            >
              Escenario actual
            </th>
            <th
              className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: NUVEX.verde, border: `1px solid ${BORDER}` }}
            >
              Escenario optimizado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const emph = isEmphasized(r.concepto);
            const baseCell: React.CSSProperties = {
              border: `1px solid ${BORDER}`,
              padding: "6px 12px",
              fontSize: emph ? 13 : 12,
              fontWeight: emph ? 700 : 500,
            };
            const actualBg = r.actualStyle?.bg ?? "#F7F7F7";
            const actualColor = r.actualStyle?.color ?? NUVEX.negro;
            const actualFw = r.actualStyle?.fontWeight ?? baseCell.fontWeight;
            const optBg = r.optimizadoStyle?.bg ?? "#F4FBF6";
            const optColor = r.optimizadoStyle?.color ?? (emph ? "#1F7A45" : NUVEX.verdeTextoFuerte);
            const optFw = r.optimizadoStyle?.fontWeight ?? baseCell.fontWeight;
            return (
              <tr key={i}>
                <td
                  style={{
                    ...baseCell,
                    backgroundColor: "#F7F9FB",
                    color: NUVEX.negro,
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {r.concepto}
                </td>
                <td style={{ ...baseCell, backgroundColor: actualBg, color: actualColor, textAlign: "center", fontWeight: actualFw }}>
                  {r.actual}
                </td>
                <td style={{ ...baseCell, backgroundColor: optBg, color: optColor, textAlign: "center", fontWeight: optFw }}>
                  {r.optimizado}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function buildPesosScenarioRows(args: {
  cuotaActual: number;
  cuotasPendientes: number;
  totalActualPendiente: number;
  saldoCapital: number;
  nuevaCuota: number;
  nuevoPlazo: number;
  totalProyectado: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
}): ScenarioRow[] {
  const vecesActual = args.saldoCapital > 0 ? args.totalActualPendiente / args.saldoCapital : 0;
  const vecesOpt = args.saldoCapital > 0 ? args.totalProyectado / args.saldoCapital : 0;
  const vsA = getVecesStyle(vecesActual);
  const vsO = getVecesStyle(vecesOpt);
  return [
    { concepto: "Cuota mensual", actual: formatCOP(args.cuotaActual), optimizado: formatCOP(args.nuevaCuota) },
    { concepto: "Plazo restante (meses)", actual: String(args.cuotasPendientes), optimizado: String(args.nuevoPlazo) },
    { concepto: "Años por pagar", actual: formatNumber(args.cuotasPendientes / 12, 1), optimizado: formatNumber(args.nuevoPlazo / 12, 1) },
    { concepto: "Total a pagar", actual: formatCOP(args.totalActualPendiente), optimizado: formatCOP(args.totalProyectado) },
    {
      concepto: "Número de veces pagado el crédito",
      actual: `${formatNumber(vecesActual, 2)} veces`,
      optimizado: `${formatNumber(vecesOpt, 2)} veces`,
      actualStyle: { bg: vsA.bg, color: vsA.color, fontWeight: 800 },
      optimizadoStyle: { bg: vsO.bg, color: vsO.color, fontWeight: 800 },
    },
    { concepto: "Ahorro en intereses", actual: "—", optimizado: formatCOP(args.ahorroIntereses) },
    { concepto: "Ahorro en seguros", actual: "—", optimizado: formatCOP(args.ahorroSeguros) },
    { concepto: "Ahorro total estimado", actual: "—", optimizado: formatCOP(args.ahorroTotal) },
  ];
}

export function buildUVRScenarioRows(args: {
  cuotaActual: number;
  cuotasPendientes: number;
  totalActualPendiente: number;
  saldoPesos: number;
  nuevaCuota: number;
  nuevoPlazo: number;
  totalProyectado: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
}): ScenarioRow[] {
  const vecesActual = args.saldoPesos > 0 ? args.totalActualPendiente / args.saldoPesos : 0;
  const vecesOpt = args.saldoPesos > 0 ? args.totalProyectado / args.saldoPesos : 0;
  const vsA = getVecesStyle(vecesActual);
  const vsO = getVecesStyle(vecesOpt);
  return [
    { concepto: "Cuota mensual (aprox.)", actual: formatCOP(args.cuotaActual), optimizado: formatCOP(args.nuevaCuota) },
    { concepto: "Plazo restante (meses)", actual: String(args.cuotasPendientes), optimizado: String(args.nuevoPlazo) },
    { concepto: "Años por pagar", actual: formatNumber(args.cuotasPendientes / 12, 1), optimizado: formatNumber(args.nuevoPlazo / 12, 1) },
    { concepto: "Total a pagar (proyectado)", actual: formatCOP(args.totalActualPendiente), optimizado: formatCOP(args.totalProyectado) },
    {
      concepto: "Número de veces pagado el crédito",
      actual: `${formatNumber(vecesActual, 2)} veces`,
      optimizado: `${formatNumber(vecesOpt, 2)} veces`,
      actualStyle: { bg: vsA.bg, color: vsA.color, fontWeight: 800 },
      optimizadoStyle: { bg: vsO.bg, color: vsO.color, fontWeight: 800 },
    },
    { concepto: "Ahorro en intereses y corrección", actual: "—", optimizado: formatCOP(args.ahorroIntereses) },
    { concepto: "Ahorro en seguros", actual: "—", optimizado: formatCOP(args.ahorroSeguros) },
    { concepto: "Ahorro total estimado", actual: "—", optimizado: formatCOP(args.ahorroTotal) },
  ];
}

export function SavingsCard({
  ahorroTotal,
  añosEliminados,
  mode,
}: {
  ahorroTotal: number;
  añosEliminados: number;
  mode: "pesos" | "uvr";
}) {
  return (
    <div
      className="nuvex-avoid-break flex h-full flex-col justify-center p-4 text-center"
      style={{
        backgroundColor: NUVEX.verde,
        color: "#FFFFFF",
        borderRadius: 14,
        boxShadow: "0 6px 18px rgba(132,185,143,0.30)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-95">
        Tu ahorro con la propuesta recomendada
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-tight">
        {formatCOP(ahorroTotal)}
      </div>
      <div className="mt-1 text-[11px] opacity-95">
        Elimina {formatNumber(añosEliminados, 0)} años de crédito
        {mode === "uvr" ? " en UVR" : ""}
      </div>
    </div>
  );
}

export function ImpactCard({
  vecesActual,
  vecesOptimizado,
}: {
  vecesActual: number;
  vecesOptimizado: number;
}) {
  const vsA = getVecesStyle(vecesActual);
  const vsO = getVecesStyle(vecesOptimizado);
  return (
    <div
      className="nuvex-avoid-break flex h-full flex-col p-4"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        border: `1px solid ${NUVEX.verde}`,
        boxShadow: "0 1px 3px rgba(36,36,36,0.04), 0 4px 12px rgba(132,185,143,0.12)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NUVEX.negro }}>
        ¿Qué significan estos números?
      </h4>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2 text-center" style={{ backgroundColor: vsA.bg }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: vsA.color, opacity: 0.85 }}>
            Condición actual
          </div>
          <div className="mt-0.5 text-[18px] font-extrabold leading-tight" style={{ color: vsA.color }}>
            {formatNumber(vecesActual, 2)}x
          </div>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ backgroundColor: vsO.bg }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: vsO.color, opacity: 0.85 }}>
            Con optimización
          </div>
          <div className="mt-0.5 text-[18px] font-extrabold leading-tight" style={{ color: vsO.color }}>
            {formatNumber(vecesOptimizado, 2)}x
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-snug" style={{ color: NUVEX.negro }}>
        Esto significa que el crédito pasa de costarte{" "}
        <b>{formatNumber(vecesActual, 2)} veces</b> el saldo actual a solo{" "}
        <b>{formatNumber(vecesOptimizado, 2)} veces</b>, reduciendo significativamente el costo financiero.
      </p>
    </div>
  );
}
