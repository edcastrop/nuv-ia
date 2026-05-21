import { formatCOP, formatNumber } from "../../lib/format";
import { NUVEX } from "./constants";

interface Item {
  label: string;
  value: string;
  emphasize?: boolean;
}

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
  const intLabel = mode === "uvr" ? "Ahorro en intereses y corrección monetaria" : "Ahorro en intereses";
  const cards: Item[] = [
    { label: "Años eliminados", value: formatNumber(items.añosEliminados, 0) },
    { label: "Nueva cuota proyectada", value: formatCOP(items.nuevaCuota) },
    { label: `Honorarios NUVEX (${formatNumber(honorariosPct, 0)}%)`, value: formatCOP(items.honorarios) },
    { label: intLabel, value: formatCOP(items.ahorroIntereses) },
    { label: "Ahorro en seguros", value: formatCOP(items.ahorroSeguros) },
    { label: "Ahorro total estimado", value: formatCOP(items.ahorroTotal), emphasize: true },
  ];

  return (
    <div
      className="nuvex-avoid-break p-8"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        border: `1px solid #DDE3EA`,
        boxShadow: "0 1px 3px rgba(36,36,36,0.04), 0 12px 32px rgba(36,36,36,0.06)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="text-center">
        <div
          className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: NUVEX.verde, color: "#FFFFFF" }}
        >
          ✓ Propuesta recomendada
        </div>
        <h3 className="mt-3 text-[18px] font-bold uppercase tracking-wider" style={{ color: NUVEX.negro }}>
          Resultado de la propuesta recomendada
        </h3>
        <p className="mt-1.5 text-sm text-[#5C6770]">
          Impacto financiero estimado bajo el escenario sugerido.
        </p>
        <div className="mt-4 text-[22px] font-semibold" style={{ color: NUVEX.negro }}>
          {mode === "uvr"
            ? `Elimina ${formatNumber(items.añosEliminados, 0)} años de crédito en UVR`
            : `Elimina ${formatNumber(items.añosEliminados, 0)} años de crédito`}
        </div>
      </div>
      <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const isStar = c.emphasize;
          return (
            <div
              key={c.label}
              className="flex flex-col justify-between p-5"
              style={{
                borderRadius: 16,
                minHeight: 130,
                backgroundColor: isStar ? "#EAF8EF" : "#FFFFFF",
                border: isStar ? `2px solid ${NUVEX.verde}` : `1px solid #DDE3EA`,
                boxShadow: isStar
                  ? "0 8px 20px rgba(132,185,143,0.18)"
                  : "0 1px 2px rgba(36,36,36,0.04)",
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: isStar ? "#1F7A45" : "#5C6770" }}
              >
                {c.label}
              </div>
              <div
                className="mt-3 leading-tight"
                style={{
                  color: isStar ? "#1F7A45" : NUVEX.negro,
                  fontSize: isStar ? 32 : 22,
                  fontWeight: isStar ? 800 : 700,
                }}
              >
                {c.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
