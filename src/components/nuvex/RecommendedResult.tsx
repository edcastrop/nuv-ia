import { formatCOP, formatNumber } from "../../lib/format";
import { NUVEX } from "./constants";

export function RecommendedResult({
  mode,
  items,
  honorariosPct,
}: {
  mode: "pesos" | "uvr";
  items: {
    añosEliminados: number;
    ahorroIntereses: number;
    ahorroSeguros: number;
    ahorroTotal: number;
    honorarios: number;
    nuevaCuota: number;
  };
  honorariosPct: number;
}) {
  const intLabel = mode === "uvr" ? "Ahorro intereses + CM" : "Ahorro intereses";
  const cells: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Años eliminados", value: formatNumber(items.añosEliminados, 0) },
    { label: "Nueva cuota", value: formatCOP(items.nuevaCuota) },
    { label: `Honorarios (${formatNumber(honorariosPct, 0)}%)`, value: formatCOP(items.honorarios) },
    { label: intLabel, value: formatCOP(items.ahorroIntereses) },
    { label: "Ahorro seguros", value: formatCOP(items.ahorroSeguros) },
    { label: "Ahorro total", value: formatCOP(items.ahorroTotal), highlight: true },
  ];

  return (
    <div
      className="nuvex-avoid-break"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        border: `1px solid #DDE3EA`,
        boxShadow: "0 1px 3px rgba(36,36,36,0.04), 0 6px 18px rgba(36,36,36,0.05)",
        fontFamily: "Inter, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: NUVEX.verde, color: "#FFFFFF" }}
      >
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider">
          <span>🏆</span>
          <span>Propuesta recomendada</span>
        </div>
        <div className="text-[11px] opacity-90">
          {mode === "uvr" ? "Crédito UVR" : "Crédito en pesos"} · Elimina{" "}
          {formatNumber(items.añosEliminados, 0)} años
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="px-3 py-3"
            style={{
              borderLeft: i === 0 ? "none" : `1px solid #EEF1F4`,
              backgroundColor: c.highlight ? "#EAF8EF" : "#FFFFFF",
            }}
          >
            <div
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: c.highlight ? "#1F7A45" : "#5C6770" }}
            >
              {c.label}
            </div>
            <div
              className="mt-1 leading-tight"
              style={{
                color: c.highlight ? "#1F7A45" : NUVEX.negro,
                fontSize: c.highlight ? 18 : 15,
                fontWeight: c.highlight ? 800 : 700,
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
