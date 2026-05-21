import { formatCOP, formatNumber } from "../../lib/format";
import { NUVEX } from "./constants";

export interface ScenarioRow {
  concepto: string;
  actual: string;
  optimizado: string;
}

const BORDER = "#DDE3EA";
const EMPHASIS_KEYS = [
  "cuota mensual",
  "total a pagar",
  "número de veces",
  "ahorro en intereses",
  "ahorro en seguros",
  "ahorro estimado",
  "ahorro total",
];

function isEmphasized(label: string) {
  const l = label.toLowerCase();
  return EMPHASIS_KEYS.some((k) => l.includes(k));
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
              padding: "7px 12px",
              fontSize: emph ? 13 : 12,
              fontWeight: emph ? 700 : 500,
            };
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
                <td
                  style={{
                    ...baseCell,
                    backgroundColor: "#F7F7F7",
                    color: NUVEX.negro,
                    textAlign: "center",
                  }}
                >
                  {r.actual}
                </td>
                <td
                  style={{
                    ...baseCell,
                    backgroundColor: "#F4FBF6",
                    color: emph ? "#1F7A45" : NUVEX.verdeTextoFuerte,
                    textAlign: "center",
                  }}
                >
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
  nuevaCuota: number;
  nuevoPlazo: number;
  totalProyectado: number;
  ahorroTotal: number;
  añosEliminados: number;
}): ScenarioRow[] {
  return [
    { concepto: "Cuota mensual", actual: formatCOP(args.cuotaActual), optimizado: formatCOP(args.nuevaCuota) },
    { concepto: "Plazo restante (meses)", actual: String(args.cuotasPendientes), optimizado: String(args.nuevoPlazo) },
    { concepto: "Años por pagar", actual: formatNumber(args.cuotasPendientes / 12, 1), optimizado: formatNumber(args.nuevoPlazo / 12, 1) },
    { concepto: "Total a pagar", actual: formatCOP(args.totalActualPendiente), optimizado: formatCOP(args.totalProyectado) },
    { concepto: "Ahorro estimado", actual: "—", optimizado: formatCOP(args.ahorroTotal) },
    { concepto: "Años eliminados", actual: "—", optimizado: formatNumber(args.añosEliminados, 0) },
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
  mode,
  añosEliminados,
  ahorroIntereses,
  ahorroSeguros,
  ahorroTotal,
}: {
  mode: "pesos" | "uvr";
  añosEliminados: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
}) {
  const interesesLabel = mode === "uvr" ? "intereses + CM" : "intereses";
  const items = [
    `Eliminas ${formatNumber(añosEliminados, 0)} años de crédito`,
    `Ahorras ${formatCOP(ahorroIntereses)} en ${interesesLabel}`,
    `Ahorras ${formatCOP(ahorroSeguros)} en seguros`,
    `Ahorras ${formatCOP(ahorroTotal)} en total`,
    `Disminuyes tu tiempo de endeudamiento`,
    `Finalizas tu crédito más rápido`,
  ];
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
      <h4
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{ color: NUVEX.negro }}
      >
        ¿Qué significan estos números?
      </h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] leading-snug" style={{ color: NUVEX.negro }}>
            <span
              className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
              style={{ backgroundColor: NUVEX.verde, color: "#FFFFFF" }}
            >
              ✓
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
