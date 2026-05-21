import { useMemo, useState } from "react";
import { Card, SectionTitle, TextField, Alert } from "./ui";
import { NUVEX, CORPORATIVO } from "./constants";
import { formatCOP, formatNumber, parseCurrency, parseDecimal } from "../../lib/format";
import { applyHonorariosFloor, HONORARIOS_MIN_BASE, HONORARIOS_MIN_FINAL } from "../../lib/finance";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import type { ClientData } from "./ClientFields";

export interface ProyeccionNuvex {
  cuotaProyectada: number;
  plazoProyectado: number;
  cuotasEliminadasProyectadas: number;
  añosEliminadosProyectados: number;
  ahorroInteresesProyectado: number;
  ahorroSegurosProyectado: number;
  ahorroProyectado: number;
  honorariosProyectados: number;
  honorariosBase: number;
  descuentoAplicado: number;
  honorariosFinales: number;
  fechaSimulacion: string;
  fuente: "manual" | "automatica";
}

export interface AprobacionState {
  fechaAprobacion: string;
  radicado: string;
  banco: string;
  cuotaAprobada: string;
  plazoAprobado: string;
  observaciones: string;
}

const defaultAprobacion = (banco: string): AprobacionState => ({
  fechaAprobacion: new Date().toISOString().slice(0, 10),
  radicado: "",
  banco,
  cuotaAprobada: "",
  plazoAprobado: "",
  observaciones: "",
});

function acertividadPct(proy: number, apr: number): number {
  if (proy <= 0 || apr <= 0) return 0;
  return (Math.min(proy, apr) / Math.max(proy, apr)) * 100;
}

function calificacion(global: number) {
  if (global >= 95) return { label: "EXCELENTE", color: "#1F7A45", bg: "#DDF4E3" };
  if (global >= 90) return { label: "MUY BUENO", color: "#2E8B57", bg: "#EAF7EE" };
  if (global >= 85) return { label: "BUENO", color: "#8A5A00", bg: "#FFF4D6" };
  return { label: "REVISAR", color: "#B42318", bg: "#FDECEC" };
}

function nextConsecutivo(): string {
  try {
    const k = "nuvex_cc_consecutivo";
    const cur = parseInt(localStorage.getItem(k) || "0", 10) || 0;
    const next = cur + 1;
    localStorage.setItem(k, String(next));
    return `CC-${String(next).padStart(4, "0")}`;
  } catch {
    return `CC-${String(Date.now()).slice(-4)}`;
  }
}

export function ResultadoFinal({
  mode,
  client,
  proyeccion,
  cuotasPendientes,
  cuotaActualConSeguro,
  seguros,
  honorariosPct,
}: {
  mode: "pesos" | "uvr";
  client: ClientData;
  proyeccion: ProyeccionNuvex | null;
  cuotasPendientes: number;
  cuotaActualConSeguro: number;
  seguros: number;
  honorariosPct: number;
}) {
  const [aprob, setAprob] = useState<AprobacionState>(() => defaultAprobacion(client.banco));
  const [consecutivo] = useState<string>(() => nextConsecutivo());
  const set = <K extends keyof AprobacionState>(k: K, v: AprobacionState[K]) =>
    setAprob((s) => ({ ...s, [k]: v }));

  const cuotaAprobadaNum = parseCurrency(aprob.cuotaAprobada);
  const plazoAprobadoNum = parseDecimal(aprob.plazoAprobado);

  const aprobado = useMemo(() => {
    if (!proyeccion || cuotaAprobadaNum <= 0 || plazoAprobadoNum <= 0) return null;
    const cuotasEliminadas = Math.max(0, cuotasPendientes - plazoAprobadoNum);
    const añosEliminados = cuotasEliminadas / 12;
    const totalActual = cuotaActualConSeguro * cuotasPendientes;
    const totalAprobado = cuotaAprobadaNum * plazoAprobadoNum;
    const ahorroTotal = Math.max(0, totalActual - totalAprobado);
    const ahorroSeguros = seguros * cuotasEliminadas;
    const ahorroIntereses = Math.max(0, ahorroTotal - ahorroSeguros);
    const honorariosCalc = ahorroTotal * (honorariosPct / 100);
    const honorariosBase = applyHonorariosFloor(honorariosCalc);
    // Aplicar el mismo descuento comercial absoluto definido en la proyección
    const descuento = Math.min(proyeccion.descuentoAplicado, honorariosBase);
    let honorariosFinales = honorariosBase - descuento;
    // Respetar el piso final cuando aplica
    if (honorariosBase <= HONORARIOS_MIN_BASE + 0.5 && honorariosFinales < HONORARIOS_MIN_FINAL) {
      honorariosFinales = HONORARIOS_MIN_FINAL;
    }
    return {
      cuota: cuotaAprobadaNum,
      plazo: plazoAprobadoNum,
      cuotasEliminadas,
      añosEliminados,
      ahorroIntereses,
      ahorroSeguros,
      ahorroTotal,
      honorariosBase,
      descuento,
      honorariosFinales,
    };
  }, [proyeccion, cuotaAprobadaNum, plazoAprobadoNum, cuotasPendientes, cuotaActualConSeguro, seguros, honorariosPct]);

  const metricas = useMemo(() => {
    if (!proyeccion || !aprobado) return null;
    const aCuota = acertividadPct(proyeccion.cuotaProyectada, aprobado.cuota);
    const aPlazo = acertividadPct(proyeccion.plazoProyectado, aprobado.plazo);
    const aElim = acertividadPct(proyeccion.cuotasEliminadasProyectadas, aprobado.cuotasEliminadas);
    const aAhorro = acertividadPct(proyeccion.ahorroProyectado, aprobado.ahorroTotal);
    const global = (aCuota + aPlazo + aElim + aAhorro) / 4;
    return { aCuota, aPlazo, aElim, aAhorro, global, cal: calificacion(global) };
  }, [proyeccion, aprobado]);

  if (!proyeccion) {
    return (
      <Card>
        <SectionTitle sub="Aparece cuando exista una propuesta calculada en el simulador">
          Resultado final del proceso
        </SectionTitle>
        <Alert>
          Para habilitar este módulo primero debes calcular una propuesta (recomendada o manual) en el simulador.
        </Alert>
      </Card>
    );
  }

  const variacion = (proy: number, apr: number) => {
    if (proy === 0) return apr === 0 ? "—" : "+∞";
    const v = ((apr - proy) / Math.abs(proy)) * 100;
    const signo = v > 0 ? "+" : "";
    return `${signo}${formatNumber(v, 1)}%`;
  };

  const filasComparativo = aprobado
    ? [
        { c: "Cuota", p: formatCOP(proyeccion.cuotaProyectada), a: formatCOP(aprobado.cuota), v: variacion(proyeccion.cuotaProyectada, aprobado.cuota) },
        { c: "Plazo (meses)", p: String(proyeccion.plazoProyectado), a: String(aprobado.plazo), v: variacion(proyeccion.plazoProyectado, aprobado.plazo) },
        { c: "Cuotas eliminadas", p: String(proyeccion.cuotasEliminadasProyectadas), a: String(aprobado.cuotasEliminadas), v: variacion(proyeccion.cuotasEliminadasProyectadas, aprobado.cuotasEliminadas) },
        { c: "Años eliminados", p: formatNumber(proyeccion.añosEliminadosProyectados, 1), a: formatNumber(aprobado.añosEliminados, 1), v: variacion(proyeccion.añosEliminadosProyectados, aprobado.añosEliminados) },
        { c: mode === "uvr" ? "Ahorro intereses + CM" : "Ahorro intereses", p: formatCOP(proyeccion.ahorroInteresesProyectado), a: formatCOP(aprobado.ahorroIntereses), v: variacion(proyeccion.ahorroInteresesProyectado, aprobado.ahorroIntereses) },
        { c: "Ahorro seguros", p: formatCOP(proyeccion.ahorroSegurosProyectado), a: formatCOP(aprobado.ahorroSeguros), v: variacion(proyeccion.ahorroSegurosProyectado, aprobado.ahorroSeguros) },
        { c: "Ahorro total", p: formatCOP(proyeccion.ahorroProyectado), a: formatCOP(aprobado.ahorroTotal), v: variacion(proyeccion.ahorroProyectado, aprobado.ahorroTotal) },
        { c: "Honorarios", p: formatCOP(proyeccion.honorariosFinales), a: formatCOP(aprobado.honorariosFinales), v: variacion(proyeccion.honorariosFinales, aprobado.honorariosFinales) },
      ]
    : [];

  const informeId = `pdf-resultado-final-${mode}`;
  const cuentaId = `pdf-cuenta-cobro-${mode}`;

  return (
    <>
      <Card>
        <SectionTitle sub="Compara la proyección NUVEX contra la aprobación real del banco">
          Resultado final del proceso
        </SectionTitle>

        <div className="rounded-xl border p-3 mb-4" style={{ borderColor: "#E3E7EE", backgroundColor: NUVEX.gris }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#242424]/70">Proyección NUVEX (origen: {proyeccion.fuente === "manual" ? "propuesta manual" : "propuesta recomendada"})</div>
          <div className="mt-2 grid gap-2 md:grid-cols-4 text-xs">
            <div><span className="text-[#242424]/60">Cuota proyectada</span><div className="font-semibold">{formatCOP(proyeccion.cuotaProyectada)}</div></div>
            <div><span className="text-[#242424]/60">Plazo proyectado</span><div className="font-semibold">{proyeccion.plazoProyectado} meses</div></div>
            <div><span className="text-[#242424]/60">Ahorro proyectado</span><div className="font-semibold">{formatCOP(proyeccion.ahorroProyectado)}</div></div>
            <div><span className="text-[#242424]/60">Honorarios finales</span><div className="font-semibold">{formatCOP(proyeccion.honorariosFinales)}</div></div>
          </div>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: NUVEX.azul }}>
          Resultado aprobado por el banco
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label="Fecha aprobación" value={aprob.fechaAprobacion} onChange={(v) => set("fechaAprobacion", v)} placeholder="2026-05-21" />
          <TextField label="Número de radicado" value={aprob.radicado} onChange={(v) => set("radicado", v)} placeholder="RAD-1234567" />
          <TextField label="Banco" value={aprob.banco} onChange={(v) => set("banco", v)} placeholder={client.banco} />
          <TextField label="Nueva cuota aprobada" value={aprob.cuotaAprobada} onChange={(v) => set("cuotaAprobada", v)} placeholder="2.800.000" />
          <TextField label="Nuevo plazo aprobado (meses)" value={aprob.plazoAprobado} onChange={(v) => set("plazoAprobado", v)} placeholder="156" />
          <TextField label="Observaciones" value={aprob.observaciones} onChange={(v) => set("observaciones", v)} placeholder="Opcional" />
        </div>

        {!aprobado && (
          <div className="mt-4">
            <Alert>Ingresa la nueva cuota y el nuevo plazo aprobados para calcular acertividad.</Alert>
          </div>
        )}

        {aprobado && metricas && (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-5">
              <DashCard label="Años eliminados" value={formatNumber(aprobado.añosEliminados, 1)} />
              <DashCard label="Ahorro aprobado" value={formatCOP(aprobado.ahorroTotal)} />
              <DashCard label="Nueva cuota aprobada" value={formatCOP(aprobado.cuota)} />
              <DashCard label="Honorarios finales" value={formatCOP(aprobado.honorariosFinales)} accent="green" />
              <div
                className="rounded-xl border-2 p-4 flex flex-col justify-center"
                style={{ borderColor: metricas.cal.color, backgroundColor: metricas.cal.bg }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: metricas.cal.color }}>
                  Acertividad global
                </div>
                <div className="mt-1 text-3xl font-extrabold leading-none" style={{ color: metricas.cal.color }}>
                  {formatNumber(metricas.global, 1)}%
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: metricas.cal.color }}>
                  {metricas.cal.label}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4 text-[11px]">
              <SubMetric label="Acertividad cuota" value={`${formatNumber(metricas.aCuota, 1)}%`} />
              <SubMetric label="Acertividad plazo" value={`${formatNumber(metricas.aPlazo, 1)}%`} />
              <SubMetric label="Acertividad eliminación" value={`${formatNumber(metricas.aElim, 1)}%`} />
              <SubMetric label="Acertividad ahorro" value={`${formatNumber(metricas.aAhorro, 1)}%`} />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: NUVEX.azul }}>
                Proyectado vs aprobado
              </h3>
              <ComparativeProyVsApr rows={filasComparativo} />
            </div>

            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                onClick={() =>
                  exportElementToPdf(informeId, `NUVEX_Resultado_Final_${sanitizeFileName(client.nombre)}.pdf`)
                }
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.azul }}
              >
                Exportar informe final (PDF)
              </button>
              <button
                onClick={() =>
                  exportElementToPdf(cuentaId, `NUVEX_Cuenta_Cobro_${consecutivo}_${sanitizeFileName(client.nombre)}.pdf`)
                }
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.negro }}
              >
                Generar cuenta de cobro
              </button>
            </div>
          </>
        )}
      </Card>

      {/* PDFs ocultos */}
      {aprobado && metricas && (
        <>
          <PrintInformeFinal
            id={informeId}
            mode={mode}
            client={client}
            aprob={aprob}
            aprobado={aprobado}
            proyeccion={proyeccion}
            metricas={metricas}
            rows={filasComparativo}
          />
          <PrintCuentaCobro
            id={cuentaId}
            consecutivo={consecutivo}
            client={client}
            aprob={aprob}
            aprobado={aprobado}
          />
        </>
      )}
    </>
  );
}

function DashCard({ label, value, accent }: { label: string; value: string; accent?: "green" }) {
  const isGreen = accent === "green";
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: isGreen ? NUVEX.verde : "#E3E7EE",
        backgroundColor: isGreen ? NUVEX.verdeClaro : "#FFFFFF",
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isGreen ? NUVEX.verdeTextoFuerte : "#242424", opacity: 0.75 }}>
        {label}
      </div>
      <div className="mt-1 text-base font-extrabold leading-tight" style={{ color: isGreen ? NUVEX.verdeTextoFuerte : NUVEX.negro }}>
        {value}
      </div>
    </div>
  );
}

function SubMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[#242424]/60">{label}</div>
      <div className="text-sm font-bold text-[#242424]">{value}</div>
    </div>
  );
}

function ComparativeProyVsApr({ rows }: { rows: { c: string; p: string; a: string; v: string }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E3E7EE]">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: NUVEX.negro, color: "#fff" }}>
            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider">Concepto</th>
            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider">Proyectado</th>
            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider">Aprobado</th>
            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wider">Variación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.c} style={{ backgroundColor: i % 2 ? "#F7F9FB" : "#fff" }}>
              <td className="px-3 py-2 font-medium text-[#242424]">{r.c}</td>
              <td className="px-3 py-2 text-right text-[#242424]/80">{r.p}</td>
              <td className="px-3 py-2 text-right font-semibold text-[#242424]">{r.a}</td>
              <td className="px-3 py-2 text-right text-[#445DA3] font-semibold">{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ PDFs ============

const printShell: React.CSSProperties = {
  position: "absolute",
  left: "-99999px",
  top: 0,
  width: "794px",
  padding: "28px 32px",
  backgroundColor: "#FFFFFF",
  fontFamily: "Inter, system-ui, sans-serif",
  color: NUVEX.negro,
};

function PrintHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "#E3E7EE" }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold" style={{ backgroundColor: NUVEX.negro }}>N</div>
        <div>
          <div className="text-sm font-extrabold tracking-tight">NUVEX FINANZAS INTELIGENTES</div>
          <div className="text-[10px]" style={{ color: "#5C6770" }}>{subtitle}</div>
        </div>
      </div>
      <div className="text-right text-[10px]" style={{ color: "#5C6770" }}>
        <div>{CORPORATIVO.web}</div>
        <div>{CORPORATIVO.telefono}</div>
      </div>
    </div>
  );
}

function PrintInformeFinal({
  id, mode, client, aprob, aprobado, metricas, rows,
}: {
  id: string;
  mode: "pesos" | "uvr";
  client: ClientData;
  aprob: AprobacionState;
  aprobado: {
    cuota: number; plazo: number; cuotasEliminadas: number; añosEliminados: number;
    ahorroIntereses: number; ahorroSeguros: number; ahorroTotal: number;
    honorariosBase: number; descuento: number; honorariosFinales: number;
  };
  proyeccion: ProyeccionNuvex;
  metricas: { aCuota: number; aPlazo: number; aElim: number; aAhorro: number; global: number; cal: { label: string; color: string; bg: string } };
  rows: { c: string; p: string; a: string; v: string }[];
}) {
  return (
    <div id={id} style={printShell}>
      <PrintHeader subtitle="Informe final del proceso" />

      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>
          {mode === "uvr" ? "Crédito UVR" : "Crédito en pesos"} · Resultado final
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mt-1">Resultado final del proceso</h1>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-[10.5px]">
        <Field label="Cliente" value={client.nombre || "—"} />
        <Field label="Cédula" value={client.cedula || "—"} />
        <Field label="Banco" value={aprob.banco || client.banco || "—"} />
        <Field label="N° de crédito" value={client.numeroCredito || "—"} />
        <Field label="Fecha aprobación" value={aprob.fechaAprobacion || "—"} />
        <Field label="Radicado" value={aprob.radicado || "—"} />
        <Field label="Producto" value={client.tipoProducto || "—"} />
        <Field label="Asesor NUVEX" value={client.asesor || "—"} />
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: NUVEX.azul }}>Dashboard ejecutivo</div>
        <div className="grid grid-cols-5 gap-2">
          <PdfDash label="Años eliminados" value={formatNumber(aprobado.añosEliminados, 1)} />
          <PdfDash label="Ahorro aprobado" value={formatCOP(aprobado.ahorroTotal)} />
          <PdfDash label="Nueva cuota" value={formatCOP(aprobado.cuota)} />
          <PdfDash label="Honorarios finales" value={formatCOP(aprobado.honorariosFinales)} green />
          <div
            style={{
              borderRadius: 10,
              border: `2px solid ${metricas.cal.color}`,
              backgroundColor: metricas.cal.bg,
              padding: 10,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: metricas.cal.color }}>Acertividad global</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: metricas.cal.color, lineHeight: 1, marginTop: 4 }}>{formatNumber(metricas.global, 1)}%</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: metricas.cal.color, marginTop: 4 }}>{metricas.cal.label}</div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: NUVEX.azul }}>Proyectado vs aprobado</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ backgroundColor: NUVEX.negro, color: "#fff" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 10 }}>Concepto</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10 }}>Proyectado</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10 }}>Aprobado</th>
              <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10 }}>Variación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.c} style={{ backgroundColor: i % 2 ? "#F7F9FB" : "#fff" }}>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.c}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.p}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{r.a}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: NUVEX.azul, fontWeight: 700 }}>{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Página 2 */}
      <div style={{ pageBreakBefore: "always", marginTop: 32 }}>
        <PrintHeader subtitle="Certificado de resultado" />
        <div className="mt-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Documento certificado</div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Certificado de resultado</h1>
        </div>

        <div
          style={{
            marginTop: 28,
            padding: 22,
            border: `1px solid #E3E7EE`,
            borderLeft: `4px solid ${NUVEX.azul}`,
            borderRadius: 10,
            backgroundColor: "#F7F9FB",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          NUVEX presentó una proyección financiera con base en la información suministrada por el cliente
          y los criterios técnicos aplicables al crédito. Una vez culminado el proceso ante la entidad financiera,
          se obtuvo un resultado con una <b>acertividad del {formatNumber(metricas.global, 1)}%</b>,
          evidenciando la consistencia y precisión del análisis realizado.
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <CertCell label="Cliente" value={client.nombre || "—"} />
          <CertCell label="Banco" value={aprob.banco || client.banco || "—"} />
          <CertCell label="Nueva cuota aprobada" value={formatCOP(aprobado.cuota)} />
          <CertCell label="Nuevo plazo aprobado" value={`${aprobado.plazo} meses`} />
          <CertCell label="Años eliminados" value={formatNumber(aprobado.añosEliminados, 1)} />
          <CertCell label="Ahorro logrado" value={formatCOP(aprobado.ahorroTotal)} highlight />
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 18,
            borderRadius: 10,
            backgroundColor: metricas.cal.bg,
            border: `2px solid ${metricas.cal.color}`,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: metricas.cal.color }}>Acertividad global NUVEX</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: metricas.cal.color, lineHeight: 1, margin: "6px 0" }}>
            {formatNumber(metricas.global, 1)}%
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: metricas.cal.color, letterSpacing: 1 }}>{metricas.cal.label}</div>
        </div>

        <div className="mt-10 text-[10px] text-center" style={{ color: "#5C6770" }}>
          {CORPORATIVO.nombre} · {CORPORATIVO.direccion} · {CORPORATIVO.ciudades} · {CORPORATIVO.telefono} · {CORPORATIVO.web}
        </div>
      </div>
    </div>
  );
}

function PrintCuentaCobro({
  id, consecutivo, client, aprob, aprobado,
}: {
  id: string;
  consecutivo: string;
  client: ClientData;
  aprob: AprobacionState;
  aprobado: { honorariosBase: number; descuento: number; honorariosFinales: number };
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <div id={id} style={printShell}>
      <PrintHeader subtitle="Cuenta de cobro" />

      <div className="mt-4 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>Documento corporativo</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cuenta de cobro</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px]" style={{ color: "#5C6770" }}>Consecutivo</div>
          <div className="text-lg font-extrabold" style={{ color: NUVEX.negro }}>{consecutivo}</div>
          <div className="text-[10px] mt-1" style={{ color: "#5C6770" }}>Fecha</div>
          <div className="text-sm font-bold">{hoy}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-[11px]">
        <Field label="Cliente" value={client.nombre || "—"} />
        <Field label="Cédula" value={client.cedula || "—"} />
        <Field label="Banco" value={aprob.banco || client.banco || "—"} />
        <Field label="Número de crédito" value={client.numeroCredito || "—"} />
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: NUVEX.azul }}>Concepto</div>
        <div
          style={{
            padding: 14,
            border: "1px solid #E3E7EE",
            borderLeft: `4px solid ${NUVEX.verde}`,
            borderRadius: 10,
            backgroundColor: "#F7F9FB",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Honorarios por optimización financiera exitosa del crédito hipotecario / leasing habitacional
          gestionado ante la entidad financiera. Servicio prestado conforme a los términos comerciales
          acordados con el cliente.
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: NUVEX.azul }}>Liquidación</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr style={{ backgroundColor: "#fff" }}>
              <td style={{ padding: "10px 12px", border: "1px solid #E3E7EE" }}>Honorarios originales</td>
              <td style={{ padding: "10px 12px", border: "1px solid #E3E7EE", textAlign: "right", fontWeight: 700 }}>{formatCOP(aprobado.honorariosBase)}</td>
            </tr>
            <tr style={{ backgroundColor: "#F7F9FB" }}>
              <td style={{ padding: "10px 12px", border: "1px solid #E3E7EE" }}>Descuento comercial</td>
              <td style={{ padding: "10px 12px", border: "1px solid #E3E7EE", textAlign: "right", color: NUVEX.azul, fontWeight: 700 }}>
                {aprobado.descuento > 0 ? `− ${formatCOP(aprobado.descuento)}` : formatCOP(0)}
              </td>
            </tr>
            <tr style={{ backgroundColor: NUVEX.verdeClaro }}>
              <td style={{ padding: "12px", border: `2px solid ${NUVEX.verde}`, fontWeight: 800, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Total a pagar (honorarios finales)
              </td>
              <td style={{ padding: "12px", border: `2px solid ${NUVEX.verde}`, textAlign: "right", fontSize: 18, fontWeight: 900, color: NUVEX.verdeTextoFuerte }}>
                {formatCOP(aprobado.honorariosFinales)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-[10.5px]" style={{ color: "#5C6770", lineHeight: 1.5 }}>
        El presente documento corresponde a la cuenta de cobro generada por NUVEX Finanzas Inteligentes
        por concepto de honorarios derivados de la optimización financiera exitosa del crédito referenciado.
        Para consultas escribir a {CORPORATIVO.web}.
      </div>

      <div className="mt-12 grid grid-cols-2 gap-12">
        <div>
          <div style={{ borderTop: "1px solid #242424", paddingTop: 6, fontSize: 10, textAlign: "center" }}>
            Firma autorizada NUVEX
          </div>
        </div>
        <div>
          <div style={{ borderTop: "1px solid #242424", paddingTop: 6, fontSize: 10, textAlign: "center" }}>
            Recibido por el cliente
          </div>
        </div>
      </div>

      <div className="mt-8 text-[9.5px] text-center" style={{ color: "#5C6770" }}>
        {CORPORATIVO.nombre} · {CORPORATIVO.direccion} · {CORPORATIVO.ciudades} · {CORPORATIVO.telefono} · {CORPORATIVO.web}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #E3E7EE", borderRadius: 8, padding: "6px 8px", backgroundColor: "#FFFFFF" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, color: "#5C6770", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: NUVEX.negro, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function PdfDash({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${green ? NUVEX.verde : "#E3E7EE"}`,
        backgroundColor: green ? NUVEX.verdeClaro : "#FFFFFF",
        padding: 10,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: green ? NUVEX.verdeTextoFuerte : "#5C6770" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: green ? NUVEX.verdeTextoFuerte : NUVEX.negro, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function CertCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${highlight ? NUVEX.verde : "#E3E7EE"}`,
        backgroundColor: highlight ? NUVEX.verdeClaro : "#FFFFFF",
        padding: 12,
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: highlight ? NUVEX.verdeTextoFuerte : "#5C6770" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: highlight ? NUVEX.verdeTextoFuerte : NUVEX.negro, marginTop: 4 }}>{value}</div>
    </div>
  );
}
