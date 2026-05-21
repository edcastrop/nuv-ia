import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import { NUVEX } from "./constants";

type Row = { label: string; values: (string | number)[]; highlight?: "soft" | "strong" };

function buildPesosRows(props: PesosPropuesta[]): Row[] {
  const v = <T,>(map: (p: PesosPropuesta) => T) => props.map(map);
  return [
    { label: "Cuotas eliminadas", values: v((p) => p.cuotasEliminadas) },
    { label: "Años eliminados", values: v((p) => formatNumber(p.añosEliminados, 0)) },
    { label: "Nuevo plazo (meses)", values: v((p) => p.nuevoPlazo) },
    { label: "Nueva cuota aproximada", values: v((p) => formatCOP(p.nuevaCuotaConSeguro)), highlight: "soft" },
    { label: "Abono adicional mensual", values: v((p) => formatCOP(p.abonoAdicionalMensual)) },
    { label: "Ahorro en intereses", values: v((p) => formatCOP(p.ahorroIntereses)) },
    { label: "Ahorro en seguros", values: v((p) => formatCOP(p.ahorroSeguros)) },
    { label: "Ahorro total estimado", values: v((p) => formatCOP(p.ahorroTotal)), highlight: "strong" },
    { label: "Honorarios NUVEX", values: v((p) => formatCOP(p.honorariosNuvex)) },
    { label: "Total aprox. a pagar", values: v((p) => formatCOP(p.totalAproxPagar)) },
  ];
}

function buildUVRRows(props: UVRPropuesta[]): Row[] {
  const v = <T,>(map: (p: UVRPropuesta) => T) => props.map(map);
  return [
    { label: "Cuotas eliminadas", values: v((p) => p.cuotasEliminadas) },
    { label: "Años eliminados", values: v((p) => formatNumber(p.añosEliminados, 0)) },
    { label: "Nuevo plazo (meses)", values: v((p) => p.nuevoPlazo) },
    { label: "Nueva cuota aproximada", values: v((p) => formatCOP(p.nuevaCuotaConSeguroAprox)), highlight: "soft" },
    { label: "Abono adicional mensual", values: v((p) => formatCOP(p.abonoAdicionalMensual)) },
    { label: "Ahorro en intereses y corrección monetaria", values: v((p) => formatCOP(p.ahorroIntereses)) },
    { label: "Ahorro en seguros", values: v((p) => formatCOP(p.ahorroSeguros)) },
    { label: "Ahorro total estimado", values: v((p) => formatCOP(p.ahorroTotal)), highlight: "strong" },
    { label: "Honorarios NUVEX", values: v((p) => formatCOP(p.honorariosNuvex)) },
    { label: "Total aprox. a pagar", values: v((p) => formatCOP(p.totalAproxPagar)) },
  ];
}

interface Props {
  mode: "pesos" | "uvr";
  pesos?: PesosPropuesta[];
  uvr?: UVRPropuesta[];
  bestIndex: number;
  honorariosPct: number;
}

export function ComparativeTable({ mode, pesos, uvr, bestIndex, honorariosPct }: Props) {
  const propuestas = mode === "pesos" ? pesos! : uvr!;
  const rows = mode === "pesos" ? buildPesosRows(pesos!) : buildUVRRows(uvr!);
  const honorariosLabelIndex = rows.findIndex((r) => r.label === "Honorarios NUVEX");
  if (honorariosLabelIndex >= 0) {
    rows[honorariosLabelIndex].label = `Honorarios NUVEX a éxito ${formatNumber(honorariosPct, 0)}%`;
  }

  return (
    <div className="nuvex-avoid-break overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-[0_1px_3px_rgba(36,36,36,0.04),0_8px_24px_rgba(36,36,36,0.04)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              className="border border-[#E3E7EE] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: NUVEX.negro }}
            >
              Concepto
            </th>
            {propuestas.map((p, i) => {
              const isBest = i === bestIndex;
              return (
                <th
                  key={i}
                  className="border border-[#E3E7EE] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: isBest ? NUVEX.verde : NUVEX.azul }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>Propuesta {i + 1}</span>
                    <span className="text-[10px] font-normal opacity-90">
                      − {p.cuotasEliminadas} cuotas
                    </span>
                    {isBest && (
                      <span className="rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#1F6D3D]">
                        MEJOR PROPUESTA
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="nuvex-avoid-break">
              <td className="border border-[#E3E7EE] bg-[#F7F9FB] px-4 py-2.5 text-left text-xs font-medium text-[#242424]">
                {row.label}
              </td>
              {row.values.map((val, vi) => {
                const isBest = vi === bestIndex;
                let cellStyle: React.CSSProperties = {};
                let cellClass = "border border-[#E3E7EE] px-4 py-2.5 text-center text-sm text-[#242424]";
                if (row.highlight === "soft") {
                  cellStyle = { backgroundColor: NUVEX.verdeClaro };
                }
                if (row.highlight === "strong") {
                  cellStyle = { backgroundColor: NUVEX.verdeFuerte, color: NUVEX.verdeTextoFuerte };
                  cellClass += " font-bold";
                }
                if (isBest && !row.highlight) {
                  cellStyle = { backgroundColor: "#F2F9F4" };
                }
                return (
                  <td key={vi} className={cellClass} style={cellStyle}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
