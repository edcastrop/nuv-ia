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
      className="nuvex-avoid-break rounded-2xl border-2 p-6"
      style={{ backgroundColor: NUVEX.verdeClaro, borderColor: NUVEX.verde }}
    >
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NUVEX.verdeTextoFuerte }}>
          Resultado de la propuesta recomendada
        </div>
        <h3 className="mt-2 text-2xl font-semibold" style={{ color: NUVEX.negro }}>
          {mode === "uvr"
            ? `Elimina ${formatNumber(items.añosEliminados, 0)} años de crédito en UVR`
            : `Elimina ${formatNumber(items.añosEliminados, 0)} años de crédito`}
        </h3>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${c.emphasize ? "" : "bg-white"}`}
            style={
              c.emphasize
                ? { backgroundColor: NUVEX.verdeFuerte, borderColor: NUVEX.verde }
                : { borderColor: "#D7E8DC" }
            }
          >
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: c.emphasize ? NUVEX.verdeTextoFuerte : "#5C7A64" }}
            >
              {c.label}
            </div>
            <div
              className={`mt-1.5 leading-tight ${c.emphasize ? "text-2xl font-bold" : "text-lg font-semibold"}`}
              style={{ color: c.emphasize ? NUVEX.verdeTextoFuerte : NUVEX.negro }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
