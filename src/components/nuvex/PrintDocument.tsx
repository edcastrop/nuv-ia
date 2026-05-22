import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import { getVecesStyle } from "./ScenarioTable";
import { isLeasing } from "./intervinientes";

interface MetricItem { label: string; value: string }

export interface CommercialBenefit {
  honorariosBase: number;
  descuento: number;
  finales: number;
  vigencia?: string;
  hasDiscount: boolean;
}

interface Props {
  mode: "pesos" | "uvr";
  client: ClientData;
  cuotasPendientes: number;
  metrics: MetricItem[];
  pesosPropuestas?: PesosPropuesta[];
  uvrPropuestas?: UVRPropuesta[];
  bestIndex: number;
  honorariosPct: number;
  personalizada?: boolean;
  recommended: {
    añosEliminados: number;
    ahorroIntereses: number;
    ahorroSeguros: number;
    ahorroTotal: number;
    honorarios: number;
    nuevaCuota: number;
  };
  // Escenario actual vs optimizado (valores numéricos)
  scenario: {
    cuotaActual: number;
    nuevaCuota: number;
    plazoActual: number;
    nuevoPlazo: number;
    totalActual: number;
    totalOptimizado: number;
    vecesActual: number;
    vecesOptimizado: number;
  };
  commercial?: CommercialBenefit;
}

const C = {
  negro: NUVEX.negro,
  azul: NUVEX.azul,
  verde: NUVEX.verde,
  verdeClaro: "#EAF8EF",
  gris: "#F7F9FB",
  borde: "#E3E7EE",
  verdeTexto: "#1F7A45",
};

function Header() {
  return (
    <div
      className="flex items-center justify-between"
      style={{ borderBottom: `2px solid ${C.azul}`, paddingBottom: 10 }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-extrabold text-white"
          style={{ backgroundColor: C.negro }}
        >
          N
        </div>
        <div>
          <div className="text-[13px] font-extrabold tracking-wide" style={{ color: C.negro }}>
            NUVEX
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: C.azul }}>
            Finanzas Inteligentes
          </div>
        </div>
      </div>
      <div className="text-right text-[9px]" style={{ color: C.negro, opacity: 0.7 }}>
        <div>{CORPORATIVO.web}</div>
        <div>{CORPORATIVO.telefono}</div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div
      className="mt-6 pt-3 text-center text-[8.5px] leading-relaxed"
      style={{ borderTop: `1px solid ${C.borde}`, color: C.negro, opacity: 0.7 }}
    >
      <div className="font-semibold tracking-wide">{CORPORATIVO.nombre}</div>
      <div>{CORPORATIVO.direccion} · {CORPORATIVO.ciudades}</div>
      <div>{CORPORATIVO.telefono} · {CORPORATIVO.web}</div>
    </div>
  );
}

function metric(label: string): string {
  return label;
}

const SITUATION_KEYS = [
  "Valor desembolsado",
  "Saldo actual",
  "Saldo actual en pesos",
  "Cuota actual con seguros",
  "Seguros mensuales",
  "Dinero pagado a la fecha",
  "Cuotas pendientes",
  "Total por pagar",
  "Total proyectado a pagar",
];

function pickSituation(metrics: MetricItem[]): MetricItem[] {
  const picked: MetricItem[] = [];
  for (const key of SITUATION_KEYS) {
    const m = metrics.find((x) => x.label === key);
    if (m && !picked.find((p) => p.label === m.label)) picked.push(m);
  }
  return picked.slice(0, 7);
}

export function PrintDocument(props: Props) {
  const {
    mode, client, metrics,
    pesosPropuestas, uvrPropuestas, bestIndex,
    recommended, scenario, commercial, personalizada = false,
  } = props;

  const titulo = "PROPUESTA DE OPTIMIZACIÓN FINANCIERA";
  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";
  const fecha = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  const situationCards = pickSituation(metrics);
  const vecesStyle = getVecesStyle(scenario.vecesActual);

  // Construir 4 tarjetas comparativas
  type Card = {
    cuotasEliminadas: number;
    añosEliminados: number;
    nuevaCuota: number;
    ahorroTotal: number;
    honorarios: number;
  };
  const cards: Card[] = mode === "pesos"
    ? (pesosPropuestas ?? []).map((p) => ({
        cuotasEliminadas: p.cuotasEliminadas,
        añosEliminados: p.añosEliminados,
        nuevaCuota: p.nuevaCuotaConSeguro,
        ahorroTotal: p.ahorroTotal,
        honorarios: p.honorariosNuvex,
      }))
    : (uvrPropuestas ?? []).map((p) => ({
        cuotasEliminadas: p.cuotasEliminadas,
        añosEliminados: p.añosEliminados,
        nuevaCuota: p.nuevaCuotaConSeguroAprox,
        ahorroTotal: p.ahorroTotal,
        honorarios: p.honorariosNuvex,
      }));

  const badgeLabel = personalizada ? "PROPUESTA PERSONALIZADA" : "PROPUESTA RECOMENDADA";
  const badgeColor = personalizada ? C.azul : C.verde;

  return (
    <div
      id={containerId}
      className="nuvex-print-only"
      style={{
        background: "#fff",
        color: C.negro,
        fontFamily: "Inter, sans-serif",
        width: "210mm",
      }}
    >
      {/* ============== PÁGINA 1 ============== */}
      <section className="nuvex-print-page" style={{ padding: "26px 30px" }}>
        <Header />

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: C.azul }}>
            NUVEX · {fecha}
          </div>
          <h1 className="text-[22px] font-extrabold leading-tight" style={{ color: C.negro, marginTop: 4 }}>
            {titulo}
          </h1>
          <p className="text-[11px]" style={{ color: C.negro, opacity: 0.7, marginTop: 2 }}>
            Diagnóstico financiero personalizado
          </p>
        </div>

        {/* Ficha del cliente */}
        <div
          style={{
            marginTop: 18,
            borderRadius: 14,
            border: `1px solid ${C.borde}`,
            background: C.gris,
            padding: "14px 16px",
          }}
        >
          <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-[10.5px]">
            <FichaItem label="Cliente" value={client.nombre || "—"} strong />
            <FichaItem label="Banco" value={client.banco || "—"} />
            <FichaItem label="Producto" value={client.tipoProducto || "—"} />
            <FichaItem label="N° crédito" value={client.numeroCredito || "—"} />
            <FichaItem label="Fecha" value={fecha} />
            <FichaItem label="Asesor NUVEX" value={client.asesor || "—"} />
          </div>
        </div>

        {/* Intervinientes */}
        {(client.intervinientes ?? []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <SectionLabel>{isLeasing(client.tipoProducto) ? "Datos de los intervinientes (Leasing)" : "Datos de los intervinientes"}</SectionLabel>
            <div className="grid grid-cols-2 gap-2" style={{ marginTop: 8 }}>
              {(client.intervinientes ?? []).map((p, i) => (
                <div key={i} style={{ borderRadius: 10, border: `1px solid ${C.borde}`, padding: "10px 12px", background: i === 0 ? "#F4F6FC" : "#FFFFFF" }}>
                  <div className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: C.azul }}>
                    {i === 0 ? p.rol : `${p.rol} ${i}`}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2, color: C.negro }}>{p.nombreCompleto || "—"}</div>
                  <div style={{ fontSize: 9, color: C.negro, opacity: 0.75, marginTop: 2 }}>
                    CC {p.cedula || "—"}{p.lugarExpedicionCedula ? ` · ${p.lugarExpedicionCedula}` : ""}
                  </div>
                  {p.direccion && (
                    <div style={{ fontSize: 9, color: C.negro, opacity: 0.75, marginTop: 1 }}>{p.direccion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Beneficio de cobertura */}
        {client.cobertura && (client.cobertura.activo || client.cobertura.valorCobertura || client.cobertura.tasaCobertura) && (
          <div style={{ marginTop: 14 }}>
            <SectionLabel>Beneficio de cobertura</SectionLabel>
            <div className="grid grid-cols-2 gap-2" style={{ marginTop: 8 }}>
              <div style={{ borderRadius: 10, border: `1px solid ${NUVEX.verde}`, background: "#EAF8EF", padding: "10px 12px" }}>
                <div className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: C.verdeTexto }}>Valor de cobertura</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.verdeTexto, marginTop: 2 }}>{client.cobertura.valorCobertura || "—"}</div>
              </div>
              <div style={{ borderRadius: 10, border: `1px solid ${NUVEX.verde}`, background: "#EAF8EF", padding: "10px 12px" }}>
                <div className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: C.verdeTexto }}>Tasa de cobertura</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.verdeTexto, marginTop: 2 }}>{client.cobertura.tasaCobertura ? `${client.cobertura.tasaCobertura}%` : "—"}</div>
              </div>
            </div>
          </div>
        )}

        {/* Situación actual */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>Situación actual del crédito</SectionLabel>
          <div className="grid grid-cols-4 gap-2" style={{ marginTop: 8 }}>
            {situationCards.map((m) => (
              <SmallCard key={m.label} label={m.label} value={m.value} />
            ))}
          </div>

          {/* Tarjeta semáforo principal */}
          <div
            style={{
              marginTop: 10,
              borderRadius: 14,
              padding: "14px 18px",
              background: vecesStyle.bg,
              border: `2px solid ${vecesStyle.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: vecesStyle.color, opacity: 0.9 }}>
                Número de veces pagado el crédito
              </div>
              <div className="text-[11px]" style={{ color: vecesStyle.color, marginTop: 4, lineHeight: 1.4 }}>
                Con las condiciones actuales terminarías pagando aproximadamente{" "}
                <b>{formatNumber(scenario.vecesActual, 2)} veces</b> el saldo actual del crédito.
              </div>
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: vecesStyle.color,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {formatNumber(scenario.vecesActual, 2)}x
            </div>
          </div>
        </div>

        {/* Comparativo en 4 tarjetas */}
        <div style={{ marginTop: 22 }}>
          <SectionLabel>Comparativo de propuestas</SectionLabel>
          <div className="grid grid-cols-4 gap-3" style={{ marginTop: 8 }}>
            {cards.slice(0, 4).map((c, i) => {
              const isBest = i === bestIndex;
              return (
                <div
                  key={i}
                  style={{
                    borderRadius: 14,
                    padding: "12px 12px",
                    background: isBest ? C.verdeClaro : "#FFFFFF",
                    border: isBest ? `2px solid ${C.verde}` : `1px solid ${C.borde}`,
                    position: "relative",
                    boxShadow: isBest ? "0 4px 12px rgba(132,185,143,0.18)" : "none",
                  }}
                >
                  {isBest && (
                    <div
                      style={{
                        position: "absolute",
                        top: -9,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: C.verde,
                        color: "#fff",
                        fontSize: 8,
                        fontWeight: 800,
                        letterSpacing: "0.15em",
                        padding: "3px 8px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ★ RECOMENDADA
                    </div>
                  )}
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isBest ? C.verdeTexto : C.azul, marginTop: isBest ? 6 : 0 }}>
                    Propuesta {i + 1}
                  </div>
                  <div className="text-[16px] font-extrabold" style={{ color: isBest ? C.verdeTexto : C.negro, marginTop: 4 }}>
                    {formatNumber(c.añosEliminados, 0)} años
                  </div>
                  <div className="text-[8.5px] uppercase tracking-wider" style={{ color: C.negro, opacity: 0.55, marginTop: -1 }}>
                    eliminados
                  </div>
                  <div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.5, color: C.negro }}>
                    <Row k="Nueva cuota" v={formatCOP(c.nuevaCuota)} />
                    <Row k="Ahorro total" v={formatCOP(c.ahorroTotal)} bold color={C.verdeTexto} />
                    <Row k="Honorarios" v={formatCOP(c.honorarios)} color={C.azul} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Footer />
      </section>

      {/* ============== PÁGINA 2 ============== */}
      <section className="nuvex-print-page" style={{ padding: "26px 30px", pageBreakBefore: "always" }}>
        <Header />

        <div style={{ marginTop: 18 }}>
          <div
            className="text-[9px] font-bold uppercase tracking-[0.22em]"
            style={{ color: badgeColor }}
          >
            {badgeLabel}
          </div>
          <h2
            style={{
              fontSize: 30,
              fontWeight: 900,
              lineHeight: 1.05,
              color: C.negro,
              marginTop: 6,
              letterSpacing: "-0.01em",
            }}
          >
            Elimina <span style={{ color: C.verde }}>{formatNumber(recommended.añosEliminados, 0)} años</span> de crédito
          </h2>
          <p className="text-[11px]" style={{ color: C.negro, opacity: 0.7, marginTop: 4 }}>
            Esta es la propuesta financiera que maximiza tu ahorro y reduce el tiempo de tu crédito.
          </p>
        </div>

        {/* Ahorros */}
        <div style={{ marginTop: 16 }}>
          <SectionLabel>Ahorro generado</SectionLabel>
          <div className="grid grid-cols-3 gap-3" style={{ marginTop: 8 }}>
            <SavingMini label={mode === "uvr" ? "Ahorro intereses + CM" : "Ahorro en intereses"} value={recommended.ahorroIntereses} />
            <SavingMini label="Ahorro en seguros" value={recommended.ahorroSeguros} />
            <div
              style={{
                borderRadius: 16,
                background: C.verdeClaro,
                border: `3px solid ${C.verde}`,
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: C.verdeTexto }}>
                Ahorro total
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.verdeTexto, marginTop: 4, lineHeight: 1.1 }}>
                {formatCOP(recommended.ahorroTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Escenario actual vs optimizado */}
        <div style={{ marginTop: 16 }}>
          <SectionLabel>Escenario actual vs optimizado</SectionLabel>
          <div
            style={{
              marginTop: 8,
              borderRadius: 14,
              border: `1px solid ${C.borde}`,
              overflow: "hidden",
            }}
          >
            <div className="grid grid-cols-3" style={{ background: C.gris }}>
              <CompHead label="Concepto" />
              <CompHead label="Actual" bg={C.azul} />
              <CompHead label="Optimizado" bg={C.verde} />
            </div>
            <CompRow concept="Cuota mensual" actual={formatCOP(scenario.cuotaActual)} optimizado={formatCOP(scenario.nuevaCuota)} />
            <CompRow concept="Plazo restante" actual={`${scenario.plazoActual} meses`} optimizado={`${scenario.nuevoPlazo} meses`} />
            <CompRow concept="Años por pagar" actual={`${formatNumber(scenario.plazoActual/12, 1)} años`} optimizado={`${formatNumber(scenario.nuevoPlazo/12, 1)} años`} />
            <CompRow concept="Total a pagar" actual={formatCOP(scenario.totalActual)} optimizado={formatCOP(scenario.totalOptimizado)} />
            <CompRow
              concept="N° veces pagado"
              actual={`${formatNumber(scenario.vecesActual, 2)}x`}
              optimizado={`${formatNumber(scenario.vecesOptimizado, 2)}x`}
              highlight
            />
          </div>
        </div>

        {/* Qué significa */}
        <div style={{ marginTop: 14 }}>
          <SectionLabel>¿Qué significa esta optimización?</SectionLabel>
          <ul style={{ marginTop: 6, fontSize: 10.5, lineHeight: 1.7, color: C.negro }}>
            <Check>Eliminas <b>{formatNumber(recommended.añosEliminados, 0)} años</b> de crédito.</Check>
            <Check>Ahorras <b>{formatCOP(recommended.ahorroIntereses)}</b> en intereses{mode === "uvr" ? " y corrección monetaria" : ""}.</Check>
            <Check>Ahorras <b>{formatCOP(recommended.ahorroSeguros)}</b> en seguros.</Check>
            <Check>Ahorras <b>{formatCOP(recommended.ahorroTotal)}</b> en total.</Check>
            <Check>Reduces el costo financiero real del crédito.</Check>
            <Check>Finalizas tu crédito más rápido.</Check>
          </ul>
        </div>

        {/* Beneficio comercial */}
        {commercial && commercial.hasDiscount && (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              border: `1px solid ${C.borde}`,
              background: "linear-gradient(135deg, #FFFFFF 0%, #F7F9FB 100%)",
              padding: "16px 18px",
            }}
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: C.azul }}>
              Beneficio exclusivo por pronta firma
            </div>
            <div className="text-[10px]" style={{ color: C.negro, opacity: 0.7, marginTop: 2 }}>
              Beneficio comercial autorizado por NUVEX.
            </div>

            <div className="grid grid-cols-3 items-center gap-2" style={{ marginTop: 12 }}>
              <FlowBlock label="Honorarios originales" value={formatCOP(commercial.honorariosBase)} />
              <FlowBlock label="Descuento otorgado" value={`− ${formatCOP(commercial.descuento)}`} color={C.azul} />
              <div
                style={{
                  borderRadius: 14,
                  background: C.verdeClaro,
                  border: `3px solid ${C.verde}`,
                  padding: "12px 12px",
                  textAlign: "center",
                }}
              >
                <div className="text-[8.5px] font-bold uppercase tracking-[0.18em]" style={{ color: C.verdeTexto }}>
                  Honorarios finales
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.verdeTexto, marginTop: 2, lineHeight: 1.1 }}>
                  {formatCOP(commercial.finales)}
                </div>
              </div>
            </div>

            <p className="text-[10px] leading-relaxed" style={{ color: C.negro, marginTop: 12 }}>
              Como beneficio especial por pronta firma, NUVEX ha autorizado un descuento comercial
              sobre los honorarios de éxito. Este beneficio busca premiar la toma de decisión oportuna
              y acelerar el inicio del proceso ante la entidad financiera.
            </p>
            {commercial.vigencia && (
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  background: C.negro,
                  color: "#fff",
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: "5px 10px",
                  borderRadius: 999,
                  letterSpacing: "0.05em",
                }}
              >
                Beneficio válido hasta: {commercial.vigencia}
              </div>
            )}
          </div>
        )}

        <p className="text-[9px] leading-relaxed" style={{ color: C.negro, opacity: 0.75, marginTop: 12 }}>
          Los honorarios únicamente se generan si el proceso obtiene un resultado favorable para el cliente.
        </p>

        <Footer />
      </section>
    </div>
  );
}

/* -------- helpers -------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: C.azul }}>
      {children}
    </div>
  );
}

function FichaItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: C.azul, opacity: 0.85 }}>
        {label}
      </div>
      <div style={{ color: C.negro, fontWeight: strong ? 700 : 500, fontSize: strong ? 12 : 11, marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}

function SmallCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${C.borde}`,
        padding: "8px 10px",
        background: "#FFFFFF",
      }}
    >
      <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: C.azul, opacity: 0.85 }}>
        {metric(label)}
      </div>
      <div style={{ color: C.negro, fontWeight: 700, fontSize: 11, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Row({ k, v, bold, color }: { k: string; v: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: `1px dashed ${C.borde}` }}>
      <span style={{ color: C.negro, opacity: 0.65 }}>{k}</span>
      <span style={{ color: color ?? C.negro, fontWeight: bold ? 800 : 600 }}>{v}</span>
    </div>
  );
}

function SavingMini({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${C.borde}`,
        background: "#FFFFFF",
        padding: "12px 14px",
        textAlign: "center",
      }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.azul, opacity: 0.85 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.negro, marginTop: 4 }}>
        {formatCOP(value)}
      </div>
    </div>
  );
}

function CompHead({ label, bg }: { label: string; bg?: string }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        background: bg ?? C.negro,
        color: "#fff",
        fontSize: 9,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        textAlign: bg ? "center" : "left",
      }}
    >
      {label}
    </div>
  );
}

function CompRow({ concept, actual, optimizado, highlight }: { concept: string; actual: string; optimizado: string; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-3" style={{ borderTop: `1px solid ${C.borde}` }}>
      <div style={{ padding: "8px 12px", fontSize: 10.5, fontWeight: 600, background: C.gris, color: C.negro }}>
        {concept}
      </div>
      <div style={{ padding: "8px 12px", fontSize: highlight ? 13 : 11, fontWeight: highlight ? 800 : 600, color: C.negro, textAlign: "center" }}>
        {actual}
      </div>
      <div style={{ padding: "8px 12px", fontSize: highlight ? 13 : 11, fontWeight: highlight ? 800 : 700, color: C.verdeTexto, background: C.verdeClaro, textAlign: "center" }}>
        {optimizado}
      </div>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: C.verde, fontWeight: 900 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}

function FlowBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${C.borde}`,
        background: "#FFFFFF",
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: C.azul, opacity: 0.85 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? C.negro, marginTop: 4 }}>{value}</div>
    </div>
  );
}
