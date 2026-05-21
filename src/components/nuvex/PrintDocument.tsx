import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber, formatPercentage } from "../../lib/format";
import { ComparativeTable } from "./ComparativeTable";
import { RecommendedResult } from "./RecommendedResult";
import { ScenarioTable, type ScenarioRow } from "./ScenarioTable";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";

interface MetricItem { label: string; value: string }

interface Props {
  mode: "pesos" | "uvr";
  client: ClientData;
  cuotasPendientes: number;
  metrics: MetricItem[];
  pesosPropuestas?: PesosPropuesta[];
  uvrPropuestas?: UVRPropuesta[];
  bestIndex: number;
  honorariosPct: number;
  recommended: {
    añosEliminados: number;
    ahorroIntereses: number;
    ahorroSeguros: number;
    ahorroTotal: number;
    honorarios: number;
    nuevaCuota: number;
  };
  scenarioRows: ScenarioRow[];
}

function PrintHeader() {
  return (
    <div className="flex items-center justify-between border-b-2 pb-3" style={{ borderColor: NUVEX.azul }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: NUVEX.negro }}>N</div>
        <div>
          <div className="text-sm font-bold" style={{ color: NUVEX.negro }}>NUVEX</div>
          <div className="text-[10px]" style={{ color: NUVEX.azul }}>Finanzas Inteligentes</div>
        </div>
      </div>
      <div className="text-right text-[10px]" style={{ color: NUVEX.negro, opacity: 0.7 }}>
        <div>{CORPORATIVO.web}</div>
        <div>{CORPORATIVO.telefono}</div>
      </div>
    </div>
  );
}

function PrintFooter() {
  return (
    <div className="mt-10 border-t pt-3 text-center text-[10px]" style={{ borderColor: "#E3E7EE", color: NUVEX.negro, opacity: 0.75 }}>
      <div className="font-semibold">{CORPORATIVO.nombre}</div>
      <div>{CORPORATIVO.direccion}</div>
      <div>{CORPORATIVO.ciudades}</div>
      <div>{CORPORATIVO.telefono} · {CORPORATIVO.web}</div>
    </div>
  );
}

export function PrintDocument(props: Props) {
  const {
    mode, client, cuotasPendientes, metrics,
    pesosPropuestas, uvrPropuestas, bestIndex, honorariosPct, recommended, scenarioRows,
  } = props;

  const titulo = mode === "uvr"
    ? "PROPUESTA DE OPTIMIZACIÓN FINANCIERA EN UVR"
    : "PROPUESTA DE OPTIMIZACIÓN FINANCIERA";

  const intLabel = mode === "uvr" ? "Reduce en intereses y corrección monetaria" : "Reduce en intereses";

  const explicacion = mode === "uvr"
    ? "Esta optimización representa una oportunidad para reducir el tiempo de permanencia del crédito en UVR, disminuir intereses futuros, reducir el impacto de la corrección monetaria proyectada y evitar el pago de seguros durante los meses eliminados. El objetivo es que el cliente conserve su crédito, pero con una estrategia financiera más eficiente y alineada con su capacidad de pago."
    : "Esta optimización representa una oportunidad para reducir el tiempo de permanencia del crédito, disminuir intereses futuros y evitar el pago de seguros durante los meses eliminados. El objetivo es que el cliente pueda conservar su crédito, pero con una estrategia financiera más eficiente y alineada con su capacidad de pago.";

  const bullets = mode === "uvr"
    ? [
        "Reducción estimada del tiempo del crédito.",
        "Disminución de intereses futuros.",
        "Reducción del impacto proyectado de la corrección monetaria.",
        "Eliminación de seguros asociados a las cuotas eliminadas.",
        "Proyección construida con base en la información suministrada.",
      ]
    : [
        "Reducción estimada de tiempo del crédito.",
        "Disminución de intereses futuros.",
        "Eliminación de seguros asociados a las cuotas eliminadas.",
        "Proyección financiera construida con base en la información suministrada.",
      ];

  const notaLegal = mode === "uvr"
    ? "Esta simulación es una proyección financiera aproximada elaborada con base en la información suministrada por el cliente. En créditos denominados en UVR, los resultados pueden variar por cambios futuros en el valor de la UVR, inflación, políticas internas de la entidad financiera, validación documental, capacidad de pago y respuesta final del banco. NUVEX trabaja bajo modalidad de honorarios a éxito: los honorarios únicamente se causan si el proceso genera un resultado favorable para el cliente."
    : "Esta simulación es una proyección financiera aproximada elaborada con base en la información suministrada por el cliente. Los resultados pueden variar según validación documental, capacidad de pago, políticas internas del banco y respuesta final de la entidad financiera. NUVEX trabaja bajo modalidad de honorarios a éxito: los honorarios únicamente se causan si el proceso genera un resultado favorable para el cliente.";

  return (
    <div className="nuvex-print-only" style={{ background: "#fff", color: NUVEX.negro }}>
      {/* PÁGINA 1 */}
      <section className="nuvex-print-page">
        <PrintHeader />
        <div className="mt-6 text-center">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: NUVEX.negro }}>{titulo}</h1>
          <p className="mt-1 text-xs" style={{ color: NUVEX.azul }}>Simulación de reducción de plazo y ahorro financiero</p>
        </div>

        <div className="mt-5 rounded-lg border" style={{ borderColor: "#E3E7EE" }}>
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: NUVEX.negro }}>Datos del cliente</div>
          <div className="grid grid-cols-3 gap-2 p-3 text-[11px]">
            <div><b>Cliente:</b> {client.nombre || "—"}</div>
            <div><b>Cédula:</b> {client.cedula || "—"}</div>
            <div><b>N° crédito:</b> {client.numeroCredito || "—"}</div>
            <div><b>Banco:</b> {client.banco || "—"}</div>
            <div className="col-span-2"><b>Producto:</b> {client.tipoProducto || "—"}</div>
            <div><b>Asesor:</b> {client.asesor || "—"}</div>
            <div><b>Plazo inicial:</b> {client.plazoInicial || "—"} meses</div>
            <div><b>Cuotas pendientes:</b> {cuotasPendientes}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Situación actual del crédito</div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-md border p-2" style={{ borderColor: "#E3E7EE", backgroundColor: NUVEX.gris }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>{m.label}</div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: NUVEX.negro }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Tabla comparativa de propuestas</div>
          <div className="mt-2 text-[10px]">
            <ComparativeTable
              mode={mode}
              pesos={pesosPropuestas}
              uvr={uvrPropuestas}
              bestIndex={bestIndex}
              honorariosPct={honorariosPct}
            />
          </div>
        </div>
      </section>

      {/* PÁGINA 2 */}
      <section className="nuvex-print-page">
        <PrintHeader />
        <div className="mt-5 text-[10px]">
          <RecommendedResult mode={mode} items={recommended} honorariosPct={honorariosPct} />
        </div>

        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Resumen ejecutivo</div>
          <div className="mt-2 rounded-lg border p-3 text-[11px]" style={{ borderColor: "#E3E7EE", backgroundColor: NUVEX.gris }}>
            <ul className="space-y-1">
              <li>• Elimina <b>{formatNumber(recommended.añosEliminados, 0)}</b> años de crédito.</li>
              <li>• {intLabel} <b>{formatCOP(recommended.ahorroIntereses)}</b>.</li>
              <li>• Evita <b>{formatCOP(recommended.ahorroSeguros)}</b> en seguros.</li>
              <li>• Genera un ahorro total de <b>{formatCOP(recommended.ahorroTotal)}</b>.</li>
              <li>• Honorarios NUVEX: <b>{formatCOP(recommended.honorarios)}</b> ({formatPercentage(honorariosPct, 0)}).</li>
            </ul>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Escenario actual vs escenario optimizado</div>
          <div className="mt-2 text-[10px]">
            <ScenarioTable rows={scenarioRows} />
          </div>
        </div>
      </section>

      {/* PÁGINA 3 */}
      <section className="nuvex-print-page">
        <PrintHeader />
        <div className="mt-6">
          <h2 className="text-base font-bold" style={{ color: NUVEX.negro }}>¿Qué representa esta optimización?</h2>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: NUVEX.negro, textAlign: "left" }}>{explicacion}</p>
          <ul className="mt-3 space-y-1 text-[11px]">
            {bullets.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        </div>

        <div className="mt-8 rounded-lg border-l-4 p-3" style={{ borderColor: NUVEX.azul, backgroundColor: NUVEX.gris }}>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Nota legal</div>
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: NUVEX.negro }}>{notaLegal}</p>
        </div>

        <PrintFooter />
      </section>
    </div>
  );
}
