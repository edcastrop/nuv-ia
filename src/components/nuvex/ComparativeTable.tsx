import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import { NUVEX } from "./constants";

type RowKey =
  | "cuotas"
  | "anios"
  | "plazo"
  | "nuevaCuota"
  | "abono"
  | "intereses"
  | "seguros"
  | "ahorroTotal"
  | "honorarios"
  | "total";

type Row = { key: RowKey; label: string; values: (string | number)[] };

function buildPesosRows(props: PesosPropuesta[]): Row[] {
  const v = <T,>(map: (p: PesosPropuesta) => T) => props.map(map);
  return [
    { key: "cuotas", label: "Cuotas eliminadas", values: v((p) => p.cuotasEliminadas) },
    { key: "anios", label: "Años eliminados", values: v((p) => formatNumber(p.añosEliminados, 0)) },
    { key: "plazo", label: "Nuevo plazo (meses)", values: v((p) => p.nuevoPlazo) },
    { key: "nuevaCuota", label: "Nueva cuota aproximada", values: v((p) => formatCOP(p.nuevaCuotaConSeguro)) },
    { key: "abono", label: "Abono adicional mensual", values: v((p) => formatCOP(p.abonoAdicionalMensual)) },
    { key: "intereses", label: "Ahorro en intereses", values: v((p) => formatCOP(p.ahorroIntereses)) },
    { key: "seguros", label: "Ahorro en seguros", values: v((p) => formatCOP(p.ahorroSeguros)) },
    { key: "ahorroTotal", label: "Ahorro total estimado", values: v((p) => formatCOP(p.ahorroTotal)) },
    { key: "honorarios", label: "Honorarios NUVEX", values: v((p) => formatCOP(p.honorariosNuvex)) },
    { key: "total", label: "Total aprox. a pagar", values: v((p) => formatCOP(p.totalAproxPagar)) },
  ];
}

function buildUVRRows(props: UVRPropuesta[]): Row[] {
  const v = <T,>(map: (p: UVRPropuesta) => T) => props.map(map);
  return [
    { key: "cuotas", label: "Cuotas eliminadas", values: v((p) => p.cuotasEliminadas) },
    { key: "anios", label: "Años eliminados", values: v((p) => formatNumber(p.añosEliminados, 0)) },
    { key: "plazo", label: "Nuevo plazo (meses)", values: v((p) => p.nuevoPlazo) },
    { key: "nuevaCuota", label: "Nueva cuota aproximada", values: v((p) => formatCOP(p.nuevaCuotaConSeguroAprox)) },
    { key: "abono", label: "Abono adicional mensual", values: v((p) => formatCOP(p.abonoAdicionalMensual)) },
    { key: "intereses", label: "Ahorro en intereses y corrección monetaria", values: v((p) => formatCOP(p.ahorroIntereses)) },
    { key: "seguros", label: "Ahorro en seguros", values: v((p) => formatCOP(p.ahorroSeguros)) },
    { key: "ahorroTotal", label: "Ahorro total estimado", values: v((p) => formatCOP(p.ahorroTotal)) },
    { key: "honorarios", label: "Honorarios NUVEX", values: v((p) => formatCOP(p.honorariosNuvex)) },
    { key: "total", label: "Total aprox. a pagar", values: v((p) => formatCOP(p.totalAproxPagar)) },
  ];
}

interface Props {
  mode: "pesos" | "uvr";
  pesos?: PesosPropuesta[];
  uvr?: UVRPropuesta[];
  bestIndex: number;
  honorariosPct: number;
}

const BORDER = "#DDE3EA";

export function ComparativeTable({ mode, pesos, uvr, bestIndex, honorariosPct }: Props) {
  const propuestas = mode === "pesos" ? pesos! : uvr!;
  const rows = mode === "pesos" ? buildPesosRows(pesos!) : buildUVRRows(uvr!);
  const honorariosRow = rows.find((r) => r.key === "honorarios");
  if (honorariosRow) {
    honorariosRow.label = `Honorarios NUVEX a éxito ${formatNumber(honorariosPct, 0)}%`;
  }
  const honorariosNegByCol = propuestas.map((p) => p.honorariosNuvex < 0);

  return (
    <div
      className="nuvex-avoid-break overflow-hidden bg-white"
      style={{
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 3px rgba(36,36,36,0.04), 0 12px 32px rgba(36,36,36,0.06)",
      }}
    >
      <div
        className="px-6 pt-6 pb-5 border-b"
        style={{ borderColor: BORDER, fontFamily: "Inter, sans-serif" }}
      >
        <h3 className="text-[15px] font-bold tracking-wider uppercase" style={{ color: NUVEX.negro }}>
          Propuestas de optimización financiera
        </h3>
        <p className="mt-1.5 text-sm text-[#5C6770]">
          Analizamos 4 escenarios posibles para reducir tiempo, intereses y seguros del crédito.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr>
              <th
                className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: NUVEX.negro, border: `1px solid ${BORDER}` }}
              >
                Concepto
              </th>
              {propuestas.map((p, i) => {
                const isBest = i === bestIndex;
                return (
                  <th
                    key={i}
                    className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-white align-top"
                    style={{
                      backgroundColor: isBest ? NUVEX.verde : NUVEX.azul,
                      border: isBest ? `3px solid ${NUVEX.verde}` : `1px solid ${BORDER}`,
                      borderBottom: isBest ? `3px solid ${NUVEX.verde}` : `1px solid ${BORDER}`,
                    }}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[13px]">Propuesta {i + 1}</span>
                      <span className="text-[10px] font-normal opacity-95">− {p.cuotasEliminadas} cuotas</span>
                      {isBest && (
                        <span
                          className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider"
                          style={{ backgroundColor: NUVEX.verde, color: "#FFFFFF", border: "1px solid #FFFFFF" }}
                        >
                          ✓ PROPUESTA RECOMENDADA
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="nuvex-avoid-break">
                <td
                  className="px-5 py-3.5 text-left text-xs font-semibold"
                  style={{
                    border: `1px solid ${BORDER}`,
                    backgroundColor: "#F7F9FB",
                    color: NUVEX.negro,
                  }}
                >
                  {row.label}
                </td>
                {row.values.map((val, vi) => {
                  const isBest = vi === bestIndex;
                  let style: React.CSSProperties = {
                    border: `1px solid ${BORDER}`,
                    color: NUVEX.negro,
                    backgroundColor: isBest ? "#F4FBF6" : "#FFFFFF",
                    fontSize: 14,
                    padding: "14px 20px",
                    textAlign: "center",
                    fontWeight: 500,
                  };

                  if (row.key === "nuevaCuota") {
                    style = { ...style, backgroundColor: "#F4FBF6", color: "#1F7A45", fontWeight: 700 };
                  }
                  if (row.key === "ahorroTotal") {
                    style = { ...style, backgroundColor: "#EAF8EF", color: "#1F7A45", fontWeight: 800, fontSize: 20 };
                  }
                  if (row.key === "honorarios") {
                    if (honorariosNegByCol[vi]) {
                      style = { ...style, backgroundColor: "#FFE5E5", color: "#C62828", fontWeight: 700 };
                    } else {
                      style = { ...style, backgroundColor: "#F8F9FA", color: NUVEX.azul, fontWeight: 600 };
                    }
                  }

                  if (isBest) {
                    style.borderLeft = `3px solid ${NUVEX.verde}`;
                    style.borderRight = `3px solid ${NUVEX.verde}`;
                  }

                  return (
                    <td key={vi} style={style}>
                      {row.key === "honorarios" && honorariosNegByCol[vi] ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden>⚠</span>
                          {val}
                        </span>
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={{ border: `1px solid ${BORDER}`, backgroundColor: "#F7F9FB", padding: 0 }} />
              {propuestas.map((_, vi) => {
                const isBest = vi === bestIndex;
                return (
                  <td
                    key={vi}
                    style={{
                      padding: 0,
                      border: `1px solid ${BORDER}`,
                      borderTop: "none",
                      borderLeft: isBest ? `3px solid ${NUVEX.verde}` : `1px solid ${BORDER}`,
                      borderRight: isBest ? `3px solid ${NUVEX.verde}` : `1px solid ${BORDER}`,
                      borderBottom: isBest ? `3px solid ${NUVEX.verde}` : `1px solid ${BORDER}`,
                      backgroundColor: isBest ? "#F4FBF6" : "#FFFFFF",
                      height: 6,
                    }}
                  />
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
