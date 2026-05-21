import { formatCOP, formatNumber } from "../../lib/format";
import { NUVEX } from "./constants";

export interface ScenarioRow {
  concepto: string;
  actual: string;
  optimizado: string;
}

export function ScenarioTable({ rows }: { rows: ScenarioRow[] }) {
  return (
    <div className="nuvex-avoid-break overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-[0_1px_3px_rgba(36,36,36,0.04)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-[#E3E7EE] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: NUVEX.negro }}>Concepto</th>
            <th className="border border-[#E3E7EE] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: NUVEX.azul }}>Escenario actual</th>
            <th className="border border-[#E3E7EE] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: NUVEX.verde }}>Escenario optimizado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border border-[#E3E7EE] bg-[#F7F9FB] px-4 py-2.5 text-xs font-medium text-[#242424]">{r.concepto}</td>
              <td className="border border-[#E3E7EE] px-4 py-2.5 text-center text-sm text-[#242424]">{r.actual}</td>
              <td className="border border-[#E3E7EE] px-4 py-2.5 text-center text-sm font-semibold" style={{ backgroundColor: NUVEX.verdeClaro, color: NUVEX.verdeTextoFuerte }}>{r.optimizado}</td>
            </tr>
          ))}
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
