import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle, TextField, Alert } from "./ui";
import { NUVEX, CORPORATIVO } from "./constants";
import { formatCOP, formatNumber, parseCurrency, parseDecimal } from "../../lib/format";
import { applyHonorariosFloor, HONORARIOS_MIN_BASE, HONORARIOS_MIN_FINAL } from "../../lib/finance";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { EnviarDocumentoButton } from "./EnviarDocumentoButton";
import { setAprobado, type AprobadoData, type EstadoExpediente } from "@/lib/expedientes";
import { calcularRecalculoHonorarios, guardarRecalculoHonorarios } from "@/lib/honorarios";
import type { ClientData } from "./ClientFields";
import { PazYSalvo } from "./PazYSalvo";

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
  expedienteId,
  aprobadoInicial,
  estado,
  fechaPagoHonorarios,
  onInformeEnviado,
  onCuentaCobroEnviada,
}: {
  mode: "pesos" | "uvr";
  client: ClientData;
  proyeccion: ProyeccionNuvex | null;
  cuotasPendientes: number;
  cuotaActualConSeguro: number;
  seguros: number;
  honorariosPct: number;
  expedienteId?: string;
  aprobadoInicial?: AprobadoData | null;
  estado?: EstadoExpediente;
  fechaPagoHonorarios?: string;
  onInformeEnviado?: () => void | Promise<void>;
  onCuentaCobroEnviada?: () => void | Promise<void>;
}) {

  const [aprob, setAprob] = useState<AprobacionState>(() =>
    aprobadoInicial
      ? {
          fechaAprobacion: aprobadoInicial.fechaAprobacion,
          radicado: aprobadoInicial.radicado,
          banco: aprobadoInicial.banco,
          cuotaAprobada: String(aprobadoInicial.cuotaAprobada ?? ""),
          plazoAprobado: String(aprobadoInicial.plazoAprobado ?? ""),
          observaciones: aprobadoInicial.observaciones ?? "",
        }
      : defaultAprobacion(client.banco),
  );
  const [savingApr, setSavingApr] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [consecutivo] = useState<string>(() => nextConsecutivo());
  const [honorariosPagadosManual, setHonorariosPagadosManual] = useState(false);

  // ====== Recálculo de honorarios a éxito (Fase 1) ======
  const honorariosPropuesta = proyeccion?.honorariosFinales ?? 0;
  const [cuotasPactadas, setCuotasPactadas] = useState<string>("");
  const [cuotasAprobadasBanco, setCuotasAprobadasBanco] = useState<string>("");
  const [honorariosPactados, setHonorariosPactados] = useState<string>("");
  const [savingRecalc, setSavingRecalc] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);

  // Hidratar valores iniciales desde el expediente
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!expedienteId) {
        if (honorariosPropuesta > 0) setHonorariosPactados(String(honorariosPropuesta));
        return;
      }
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("expedientes")
        .select("cuotas_pactadas, cuotas_aprobadas_banco, honorarios_pactados, propuesta_data")
        .eq("id", expedienteId)
        .maybeSingle();
      if (cancel) return;
      const row = data as { cuotas_pactadas?: number | null; cuotas_aprobadas_banco?: number | null; honorarios_pactados?: number | null; propuesta_data?: { nuevoPlazo?: number } } | null;
      if (row?.cuotas_pactadas != null) setCuotasPactadas(String(row.cuotas_pactadas));
      else if (row?.propuesta_data?.nuevoPlazo) setCuotasPactadas(String(Math.max(0, cuotasPendientes - row.propuesta_data.nuevoPlazo)));
      if (row?.cuotas_aprobadas_banco != null) setCuotasAprobadasBanco(String(row.cuotas_aprobadas_banco));
      if (row?.honorarios_pactados != null) setHonorariosPactados(String(row.honorarios_pactados));
      else if (honorariosPropuesta > 0) setHonorariosPactados(String(honorariosPropuesta));
    })();
    return () => { cancel = true; };
  }, [expedienteId, honorariosPropuesta, cuotasPendientes]);

  const recalculo = useMemo(
    () => calcularRecalculoHonorarios(
      parseDecimal(cuotasPactadas),
      parseDecimal(cuotasAprobadasBanco),
      parseCurrency(honorariosPactados),
    ),
    [cuotasPactadas, cuotasAprobadasBanco, honorariosPactados],
  );

  const set = <K extends keyof AprobacionState>(k: K, v: AprobacionState[K]) =>
    setAprob((s) => ({ ...s, [k]: v }));

  const cuotaAprobadaNum = parseCurrency(aprob.cuotaAprobada);
  const plazoAprobadoNum = parseDecimal(aprob.plazoAprobado);

  const aprobado = useMemo(() => {
    if (!proyeccion || cuotaAprobadaNum <= 0 || plazoAprobadoNum <= 0) return null;
    const cuotasEliminadas = Math.max(0, cuotasPendientes - plazoAprobadoNum);
    const añosEliminados = cuotasEliminadas / 12;

    // REGLA NUVEX: Si el plazo aprobado coincide con el proyectado
    // (y por tanto las cuotas eliminadas también), el ahorro aprobado
    // debe ser exactamente el ahorro proyectado. Una pequeña diferencia
    // en la nueva cuota aprobada NO debe reducir artificialmente el ahorro.
    const mismoPlazo =
      plazoAprobadoNum === proyeccion.plazoProyectado &&
      cuotasEliminadas === proyeccion.cuotasEliminadasProyectadas;

    let ahorroTotal: number;
    let ahorroSeguros: number;
    let ahorroIntereses: number;
    let honorariosBase: number;
    let descuento: number;
    let honorariosFinales: number;

    if (mismoPlazo) {
      ahorroTotal = proyeccion.ahorroProyectado;
      ahorroSeguros = proyeccion.ahorroSegurosProyectado;
      ahorroIntereses = proyeccion.ahorroInteresesProyectado;
      honorariosBase = proyeccion.honorariosBase;
      descuento = proyeccion.descuentoAplicado;
      honorariosFinales = proyeccion.honorariosFinales;
    } else {
      const totalActual = cuotaActualConSeguro * cuotasPendientes;
      const totalAprobado = cuotaAprobadaNum * plazoAprobadoNum;
      ahorroTotal = Math.max(0, totalActual - totalAprobado);
      ahorroSeguros = seguros * cuotasEliminadas;
      ahorroIntereses = Math.max(0, ahorroTotal - ahorroSeguros);
      const honorariosCalc = ahorroTotal * (honorariosPct / 100);
      honorariosBase = applyHonorariosFloor(honorariosCalc);
      descuento = Math.min(proyeccion.descuentoAplicado, honorariosBase);
      honorariosFinales = honorariosBase - descuento;
      if (honorariosBase <= HONORARIOS_MIN_BASE + 0.5 && honorariosFinales < HONORARIOS_MIN_FINAL) {
        honorariosFinales = HONORARIOS_MIN_FINAL;
      }
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

        {/* ====== Reajuste de honorarios a éxito ====== */}
        <div className="mt-6 rounded-xl border-2 p-4" style={{ borderColor: "#F0B429", backgroundColor: "#FFFBEB" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#8A5A00" }}>
              Reajuste de honorarios a éxito
            </h3>
            {recalculo.huboRecalculo && (
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "#F0B429", color: "#2C1810" }}>
                Honorarios recalculados
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[#8A5A00]/80">
            NUVEX trabaja a éxito. Si el banco aprueba menos cuotas eliminadas que las pactadas, los honorarios se recalculan por regla de 3.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <TextField label="Cuotas pactadas en contrato" value={cuotasPactadas} onChange={setCuotasPactadas} placeholder="60" />
            <TextField label="Honorarios pactados" value={honorariosPactados} onChange={setHonorariosPactados} placeholder="3.000.000" />
            <TextField label="Cuotas aprobadas por banco" value={cuotasAprobadasBanco} onChange={setCuotasAprobadasBanco} placeholder="55" />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4 text-xs">
            <div className="rounded-lg bg-white p-2 border border-[#F0B429]/40">
              <div className="text-[10px] uppercase tracking-wider text-[#242424]/60">Cuotas pactadas</div>
              <div className="font-semibold">{recalculo.cuotasPactadas || "—"}</div>
            </div>
            <div className="rounded-lg bg-white p-2 border border-[#F0B429]/40">
              <div className="text-[10px] uppercase tracking-wider text-[#242424]/60">Cuotas aprobadas</div>
              <div className="font-semibold">{recalculo.cuotasAprobadasBanco || "—"}</div>
            </div>
            <div className="rounded-lg bg-white p-2 border border-[#F0B429]/40">
              <div className="text-[10px] uppercase tracking-wider text-[#242424]/60">Honorarios pactados</div>
              <div className="font-semibold">{formatCOP(recalculo.honorariosPactados)}</div>
            </div>
            <div className="rounded-lg p-2 border-2" style={{ borderColor: NUVEX.verde, backgroundColor: "#EAF7EE" }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "#1F7A45" }}>Honorarios recalculados</div>
              <div className="font-extrabold text-base" style={{ color: "#1F7A45" }}>{formatCOP(recalculo.honorariosRecalculados)}</div>
            </div>
          </div>
          {recalculo.huboRecalculo && (
            <div className="mt-3 rounded-lg bg-amber-100 border border-amber-300 p-2 text-xs text-[#8A5A00]">
              Los honorarios fueron recalculados porque el banco aprobó menos cuotas de las pactadas. Diferencia a favor del cliente: <strong>{formatCOP(recalculo.diferencia)}</strong>.
            </div>
          )}
          {expedienteId && (
            <div className="mt-3 flex items-center justify-end gap-3">
              {recalcMsg && <span className="text-xs text-[#242424]/70">{recalcMsg}</span>}
              <button
                disabled={savingRecalc || recalculo.cuotasPactadas <= 0 || recalculo.honorariosPactados <= 0 || recalculo.cuotasAprobadasBanco <= 0}
                onClick={async () => {
                  setSavingRecalc(true); setRecalcMsg(null);
                  try {
                    await guardarRecalculoHonorarios(
                      expedienteId,
                      recalculo.cuotasPactadas,
                      recalculo.cuotasAprobadasBanco,
                      recalculo.honorariosPactados,
                    );
                    setRecalcMsg(`Honorarios oficiales actualizados a ${formatCOP(recalculo.honorariosRecalculados)}`);
                  } catch (e) {
                    setRecalcMsg((e as Error).message);
                  } finally {
                    setSavingRecalc(false);
                  }
                }}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#8A5A00" }}
              >
                {savingRecalc ? "Guardando…" : "Guardar recálculo"}
              </button>
            </div>
          )}
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

            <div className="mt-6 flex flex-wrap gap-3 justify-end items-center">
              {expedienteId && savedMsg && <span className="text-xs text-[#242424]/70">{savedMsg}</span>}
              {expedienteId && (
                <button
                  disabled={savingApr}
                  onClick={async () => {
                    if (!aprobado || !metricas) return;
                    setSavingApr(true);
                    setSavedMsg(null);
                    try {
                      await setAprobado(
                        expedienteId,
                        {
                          fechaAprobacion: aprob.fechaAprobacion,
                          radicado: aprob.radicado,
                          banco: aprob.banco,
                          cuotaAprobada: aprobado.cuota,
                          plazoAprobado: aprobado.plazo,
                          cuotasEliminadas: aprobado.cuotasEliminadas,
                          añosEliminados: aprobado.añosEliminados,
                          ahorroIntereses: aprobado.ahorroIntereses,
                          ahorroSeguros: aprobado.ahorroSeguros,
                          ahorroTotal: aprobado.ahorroTotal,
                          ahorroAprobado: aprobado.ahorroTotal,
                          honorariosBase: aprobado.honorariosBase,
                          descuento: aprobado.descuento,
                          honorariosFinales: aprobado.honorariosFinales,
                          observaciones: aprob.observaciones,
                        },
                        metricas.global,
                      );
                      setSavedMsg("Aprobación guardada");
                    } catch (e) {
                      setSavedMsg((e as Error).message);
                    } finally {
                      setSavingApr(false);
                    }
                  }}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:opacity-50"
                  style={{ backgroundColor: NUVEX.verde, color: "#0F3D1F" }}
                >
                  {savingApr ? "Guardando…" : "Guardar aprobación"}
                </button>
              )}
              <button
                onClick={async () => {
                  const { validateRequired, ensureValidAdvisory } = await import("@/lib/pdfValidator");
                  const v = validateRequired([
                    { key: "nombre", label: "Nombre cliente", value: client.nombre },
                    { key: "cedula", label: "Cédula", value: client.cedula },
                    { key: "banco", label: "Banco", value: aprob.banco || client.banco },
                    { key: "numeroCredito", label: "N° crédito", value: client.numeroCredito },
                    { key: "producto", label: "Producto", value: client.tipoProducto },
                    { key: "honorarios", label: "Honorarios", value: aprobado?.honorariosFinales },
                  ]);
                  ensureValidAdvisory("Resultado Final", v);
                  exportElementToPdf(informeId, `NUVEX_Resultado_Final_${sanitizeFileName(client.nombre)}.pdf`);
                }}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.azul }}
              >
                Exportar informe final (PDF)
              </button>
              <button
                onClick={async () => {
                  const { validateRequired, ensureValidAdvisory } = await import("@/lib/pdfValidator");
                  const v = validateRequired([
                    { key: "nombre", label: "Nombre cliente", value: client.nombre },
                    { key: "cedula", label: "Cédula", value: client.cedula },
                    { key: "banco", label: "Banco", value: aprob.banco || client.banco },
                    { key: "numeroCredito", label: "N° crédito", value: client.numeroCredito },
                    { key: "honorarios", label: "Honorarios finales", value: aprobado?.honorariosFinales },
                  ]);
                  ensureValidAdvisory("Cuenta de Cobro", v);
                  exportElementToPdf(cuentaId, `NUVEX_Cuenta_Cobro_${consecutivo}_${sanitizeFileName(client.nombre)}.pdf`);
                }}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.negro }}
              >
                Generar cuenta de cobro
              </button>
              <EnviarDocumentoButton
                expedienteId={expedienteId}
                tipo="informe_final"
                elementId={informeId}
                filename={`NUVEX_Informe_Final_${sanitizeFileName(client.nombre)}.pdf`}
                label="Enviar informe final al cliente"
                onSent={onInformeEnviado}
              />
              <EnviarDocumentoButton
                expedienteId={expedienteId}
                tipo="cuenta_cobro_cliente"
                elementId={cuentaId}
                filename={`NUVEX_Cuenta_Cobro_${consecutivo}_${sanitizeFileName(client.nombre)}.pdf`}
                label="Enviar cuenta de cobro al cliente"
                bgColor={NUVEX.negro}
                onSent={onCuentaCobroEnviada}
              />

              <PazYSalvo
                client={client}
                enabled={estado === "PAGADO" || honorariosPagadosManual}
                data={{
                  fechaAprobacion: aprob.fechaAprobacion,
                  fechaPago: fechaPagoHonorarios || new Date().toISOString().slice(0, 10),
                  honorariosPagados: aprobado.honorariosFinales,
                  ahorroLogrado: aprobado.ahorroTotal,
                  añosEliminados: aprobado.añosEliminados,
                }}
              />
            </div>

            {estado !== "PAGADO" && (
              <div className="mt-3 flex justify-end">
                <label className="inline-flex items-center gap-2 text-xs text-[#242424]/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={honorariosPagadosManual}
                    onChange={(e) => setHonorariosPagadosManual(e.target.checked)}
                  />
                  Marcar honorarios pagados (habilita Paz y Salvo)
                </label>
              </div>
            )}
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
            expedienteId={expedienteId}
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

// ============ PDFs Premium ============

const printShell: React.CSSProperties = {
  position: "absolute",
  left: "-99999px",
  top: 0,
  width: "794px",
  backgroundColor: "#FFFFFF",
  fontFamily: "Inter, system-ui, sans-serif",
  color: NUVEX.negro,
};

const NUVEX_GRADIENT = `linear-gradient(135deg, ${NUVEX.negro} 0%, ${NUVEX.azul} 100%)`;

function LogoMark({ size = 72, light = false }: { size?: number; light?: boolean }) {
  return (
    <img
      src={new URL("@/assets/logo-nuvex.png", import.meta.url).toString()}
      alt="NUVEX"
      style={{
        height: size,
        width: "auto",
        filter: light ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}

function Watermark() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      <img
        src={new URL("@/assets/logo-nuvex.png", import.meta.url).toString()}
        alt=""
        style={{ width: "75%", maxWidth: "180mm", opacity: 0.05, transform: "rotate(-28deg)", objectFit: "contain" }}
        draggable={false}
      />
    </div>
  );
}


function PremiumFooter() {
  return (
    <div
      style={{
        marginTop: 28,
        paddingTop: 14,
        borderTop: `1px solid #E3E7EE`,
        fontSize: 9.5,
        color: "#5C6770",
        display: "flex",
        justifyContent: "space-between",
        letterSpacing: 0.3,
      }}
    >
      <div>
        <div style={{ fontWeight: 800, color: NUVEX.negro, letterSpacing: 1 }}>NUVEX FINANZAS INTELIGENTES</div>
        <div style={{ marginTop: 2 }}>Carrera 16 # 37-48 Piso 4 · Centro Bucaramanga</div>
        <div>Bogotá | Bucaramanga</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div>+57 316 402 3779</div>
        <div>www.nuvex.com.co</div>
      </div>
    </div>
  );
}

function MetaRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 0, border: "1px solid #E3E7EE", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      {items.map((it, idx) => (
        <div
          key={it.label}
          style={{
            padding: "12px 14px",
            borderRight: idx < items.length - 1 ? "1px solid #EEF1F5" : "none",
          }}
        >
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: "#8892A0", textTransform: "uppercase" }}>{it.label}</div>
          <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: NUVEX.negro }}>{it.value || "—"}</div>
        </div>
      ))}
    </div>
  );
}

function GaugeCircle({ value, color, label }: { value: number; color: string; label: string }) {
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, opacity: 0.85 }}>ACERTIVIDAD</div>
        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>{formatNumber(value, 1)}%</div>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function PremiumStatCard({ label, value, accent }: { label: string; value: string; accent?: "blue" | "green" | "dark" | "default" }) {
  const palette =
    accent === "blue"
      ? { border: NUVEX.azul, label: NUVEX.azul, value: NUVEX.negro, bg: "#fff" }
      : accent === "green"
        ? { border: NUVEX.verde, label: NUVEX.verdeTextoFuerte, value: NUVEX.verdeTextoFuerte, bg: NUVEX.verdeClaro }
        : accent === "dark"
          ? { border: NUVEX.negro, label: "#fff", value: "#fff", bg: NUVEX.negro }
          : { border: "#E3E7EE", label: "#8892A0", value: NUVEX.negro, bg: "#fff" };
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        padding: "16px 16px 18px",
        boxShadow: "0 1px 2px rgba(36,36,36,0.04)",
      }}
    >
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.3, color: palette.label, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, color: palette.value, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function PrintInformeFinal({
  id, mode, client, aprob, aprobado, proyeccion, metricas, rows,
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
  void proyeccion;
  const acertividadFilas: number[] = [
    metricas.aCuota,
    metricas.aPlazo,
    metricas.aElim,
    metricas.aElim,
    metricas.aAhorro,
    metricas.aAhorro,
    metricas.aAhorro,
    100,
  ];

  // Cálculo de fechas ANTES → DESPUÉS
  const hoyDate = new Date();
  const addMonths = (d: Date, m: number) => {
    const nd = new Date(d);
    nd.setMonth(nd.getMonth() + m);
    return nd;
  };
  const fechaFinActual = addMonths(hoyDate, Math.round(aprobado.plazo + aprobado.cuotasEliminadas));
  const fechaFinDespues = addMonths(hoyDate, Math.round(aprobado.plazo));
  const fmtMesAño = (d: Date) =>
    d.toLocaleDateString("es-CO", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());

  return (
    <div id={id} style={printShell}>
      {/* ===== Página 1 ===== */}
      <div style={{ position: "relative", paddingBottom: 24 }}>
        <Watermark />
        <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ background: NUVEX_GRADIENT, padding: "28px 36px 32px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <LogoMark light size={280} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2.2 }}>NUVEX FINANZAS INTELIGENTES</div>
                <div style={{ fontSize: 9.5, letterSpacing: 1.6, opacity: 0.85, marginTop: 3 }}>Bogotá | Bucaramanga</div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 9.5, opacity: 0.9, letterSpacing: 0.5 }}>
              <div style={{ fontWeight: 800, letterSpacing: 2.5 }}>CERTIFICADO DE RESULTADO</div>
              <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700 }}>{aprob.fechaAprobacion || new Date().toISOString().slice(0, 10)}</div>
              <div style={{ marginTop: 2, fontSize: 9.5, opacity: 0.85 }}>{client.nombre || "—"}</div>
            </div>
          </div>


          <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.85, fontWeight: 700 }}>
                {mode === "uvr" ? "CRÉDITO UVR · RESULTADO CERTIFICADO" : "CRÉDITO EN PESOS · RESULTADO CERTIFICADO"}
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, marginTop: 8, lineHeight: 1.1, letterSpacing: -0.5 }}>
                Resultado final<br />del proceso
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, opacity: 0.92, maxWidth: 360, lineHeight: 1.45 }}>
                Tu crédito fue optimizado exitosamente.
              </div>
            </div>
            <GaugeCircle value={metricas.global} color={metricas.cal.color} label={metricas.cal.label} />
          </div>
        </div>

        {/* ANTES → DESPUÉS — fechas de finalización (+35% jerarquía) */}
        <div style={{ padding: "26px 36px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "stretch" }}>
            <div style={{ border: `1px solid #E3E7EE`, borderRadius: 18, padding: "22px 26px", background: "#FAFBFD" }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 4, color: "#8892A0", textTransform: "uppercase" }}>ANTES</div>
              <div style={{ fontSize: 13, color: "#5C6770", marginTop: 6 }}>Fecha estimada de finalización</div>
              <div style={{ fontSize: 27, fontWeight: 900, color: NUVEX.negro, marginTop: 8, letterSpacing: -0.4 }}>
                {fmtMesAño(fechaFinActual)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: NUVEX.azul, lineHeight: 1 }}>→</div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: NUVEX.verdeTextoFuerte, textAlign: "center" }}>
                {formatNumber(aprobado.añosEliminados, 1)} AÑOS<br />ELIMINADOS
              </div>
            </div>
            <div style={{ border: `1px solid ${NUVEX.verde}`, borderRadius: 18, padding: "22px 26px", background: NUVEX.verdeClaro }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 4, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase" }}>DESPUÉS</div>
              <div style={{ fontSize: 13, color: NUVEX.verdeTextoFuerte, marginTop: 6, opacity: 0.85 }}>Nueva fecha de finalización</div>
              <div style={{ fontSize: 27, fontWeight: 900, color: NUVEX.verdeTextoFuerte, marginTop: 8, letterSpacing: -0.4 }}>
                {fmtMesAño(fechaFinDespues)}
              </div>
            </div>
          </div>
        </div>

        {/* AHORRO TOTAL — Hero visual #1 del documento */}
        <div style={{ padding: "22px 36px 0" }}>
          <div
            style={{
              borderRadius: 20,
              background: `linear-gradient(135deg, ${NUVEX.verdeClaro} 0%, #FFFFFF 100%)`,
              border: `2px solid ${NUVEX.verde}`,
              padding: "28px 32px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 5, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase" }}>
              Ahorro total certificado
            </div>
            <div style={{ marginTop: 6, fontSize: 56, fontWeight: 900, color: NUVEX.verdeTextoFuerte, letterSpacing: -1.5, lineHeight: 1.05 }}>
              {formatCOP(aprobado.ahorroTotal)}
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, color: NUVEX.negro, opacity: 0.7, letterSpacing: 0.3 }}>
              Intereses + seguros que dejarás de pagar gracias al proceso NUVEX
            </div>
          </div>
        </div>


        <div style={{ padding: "26px 36px 0" }}>
          <div style={{ marginBottom: 20 }}>
            <MetaRow
              items={[
                { label: "Cliente", value: client.nombre || "—" },
                { label: "Cédula", value: client.cedula || "—" },
                { label: "Banco", value: aprob.banco || client.banco || "—" },
                { label: "N° crédito", value: client.numeroCredito || "—" },
              ]}
            />
            <div style={{ height: 8 }} />
            <MetaRow
              items={[
                { label: "Producto", value: client.tipoProducto || "—" },
                { label: "Fecha aprobación", value: aprob.fechaAprobacion || "—" },
                { label: "Asesor", value: client.asesor || "—" },
                ...(aprob.radicado ? [{ label: "Radicado", value: aprob.radicado }] : []),
              ]}
            />
          </div>

          {(client.intervinientes ?? []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.azul, marginBottom: 8 }}>
                INTERVINIENTES
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {(client.intervinientes ?? []).map((p, i) => (
                  <div key={i} style={{ border: "1px solid #E3E7EE", borderRadius: 10, padding: "10px 12px", background: i === 0 ? "#F4F6FC" : "#FFFFFF" }}>
                    <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: NUVEX.azul, textTransform: "uppercase" }}>
                      {i === 0 ? p.rol : `${p.rol} ${i}`}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: NUVEX.negro, marginTop: 3 }}>{p.nombreCompleto || "—"}</div>
                    <div style={{ fontSize: 9, color: "#5C6770", marginTop: 2 }}>
                      CC {p.cedula || "—"}{p.lugarExpedicionCedula ? ` · ${p.lugarExpedicionCedula}` : ""}
                    </div>
                    {p.direccion && <div style={{ fontSize: 9, color: "#5C6770", marginTop: 1 }}>{p.direccion}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {client.cobertura && (client.cobertura.activo || client.cobertura.valorCobertura || client.cobertura.tasaCobertura) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.verdeTextoFuerte, marginBottom: 8 }}>
                BENEFICIO DE COBERTURA
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <div style={{ border: `1px solid ${NUVEX.verde}`, borderRadius: 10, padding: "10px 12px", background: NUVEX.verdeClaro }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase" }}>Valor de cobertura</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NUVEX.verdeTextoFuerte, marginTop: 3 }}>{client.cobertura.valorCobertura || "—"}</div>
                </div>
                <div style={{ border: `1px solid ${NUVEX.verde}`, borderRadius: 10, padding: "10px 12px", background: NUVEX.verdeClaro }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase" }}>Tasa de cobertura</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NUVEX.verdeTextoFuerte, marginTop: 3 }}>{client.cobertura.tasaCobertura ? `${client.cobertura.tasaCobertura}%` : "—"}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.azul, marginBottom: 10 }}>
              DASHBOARD EJECUTIVO
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              <PremiumStatCard label="Años eliminados" value={formatNumber(aprobado.añosEliminados, 1)} accent="dark" />
              <PremiumStatCard label="Ahorro total" value={formatCOP(aprobado.ahorroTotal)} accent="green" />
              <PremiumStatCard label="Nueva cuota" value={formatCOP(aprobado.cuota)} />
              <PremiumStatCard label="Honorarios finales" value={formatCOP(aprobado.honorariosFinales)} accent="blue" />
              <PremiumStatCard label="Acertividad" value={`${formatNumber(metricas.global, 1)}%`} accent="green" />
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              padding: "22px 26px",
              borderRadius: 16,
              background: `linear-gradient(135deg, ${NUVEX.verdeClaro} 0%, #FFFFFF 100%)`,
              border: `1px solid ${NUVEX.verde}`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: NUVEX.verdeTextoFuerte }}>
              ¡FELICITACIONES!
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.6, color: NUVEX.negro }}>
              Nos alegra profundamente que este proceso haya finalizado exitosamente. Gracias por confiar en
              NUVEX Finanzas Inteligentes. El resultado obtenido demuestra que una estrategia financiera
              adecuada puede transformar por completo el futuro de un crédito.
              <br /><br />
              Hoy no solo eliminaste tiempo de tu deuda: también redujiste intereses futuros y construiste
              un camino más rápido hacia tu libertad financiera. Seguiremos acompañándote en cada paso.
            </div>
          </div>

          <div style={{ padding: "0 0" }}>
            <PremiumFooter />
          </div>
        </div>
        </div>
      </div>

      {/* ===== Página 2 ===== */}
      <div style={{ position: "relative", pageBreakBefore: "always", padding: "32px 36px 28px" }}>
        <Watermark />
        <div style={{ position: "relative", zIndex: 1 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid #E3E7EE`, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LogoMark size={36} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>NUVEX FINANZAS INTELIGENTES</div>
              <div style={{ fontSize: 9, color: "#5C6770", letterSpacing: 1 }}>PROYECTADO VS APROBADO</div>
            </div>
          </div>
          <div style={{ fontSize: 9.5, color: "#5C6770", letterSpacing: 0.5, textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: NUVEX.negro }}>{client.nombre || "—"}</div>
            <div>{aprob.banco || client.banco}</div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: NUVEX.azul }}>COMPARATIVO EJECUTIVO</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, letterSpacing: -0.3 }}>Proyectado vs aprobado</div>
          <div style={{ fontSize: 10.5, color: "#5C6770", marginTop: 4 }}>
            Comparación detallada entre la proyección NUVEX y la aprobación final del banco.
          </div>
        </div>

        <div style={{ marginTop: 18, border: "1px solid #E3E7EE", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: NUVEX_GRADIENT, color: "#fff" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>CONCEPTO</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>PROYECTADO</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>APROBADO</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>VARIACIÓN</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 9, letterSpacing: 1, fontWeight: 700, width: 150 }}>ACERTIVIDAD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cap = Math.max(0, Math.min(100, acertividadFilas[i] ?? 0));
                return (
                  <tr key={r.c} style={{ background: i % 2 ? "#FAFBFD" : "#fff", borderTop: "1px solid #EEF1F5" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: NUVEX.negro }}>{r.c}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", color: "#5C6770" }}>{r.p}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 800, color: NUVEX.negro }}>{r.a}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", color: NUVEX.azul, fontWeight: 700 }}>{r.v}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#EEF1F5", overflow: "hidden" }}>
                          <div style={{ width: `${cap}%`, height: "100%", background: NUVEX.verde, borderRadius: 999 }} />
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: NUVEX.verdeTextoFuerte, minWidth: 38, textAlign: "right" }}>{formatNumber(cap, 0)}%</div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 22,
            padding: "22px 26px",
            borderRadius: 16,
            background: NUVEX_GRADIENT,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, opacity: 0.9 }}>
            ¿CONOCES A ALGUIEN QUE TAMBIÉN PUEDA BENEFICIARSE?
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.6, opacity: 0.95 }}>
            Miles de familias aún desconocen que pueden reducir años de su crédito hipotecario o leasing
            habitacional. Si tienes familiares, amigos o compañeros de trabajo con crédito de vivienda,
            recomiéndales este diagnóstico. Tu recomendación puede ayudarles a ahorrar tiempo, dinero e intereses.
          </div>
        </div>

        {aprob.observaciones && (
          <div style={{ marginTop: 16, padding: "14px 18px", border: `1px dashed #E3E7EE`, borderRadius: 10, fontSize: 10.5, color: "#5C6770" }}>
            <span style={{ fontWeight: 800, color: NUVEX.negro, letterSpacing: 0.5 }}>Observaciones: </span>
            {aprob.observaciones}
          </div>
        )}

        <PremiumFooter />
        </div>
      </div>
    </div>

  );
}

function PrintCuentaCobro({
  id, consecutivo, expedienteId, client, aprob, aprobado,
}: {
  id: string;
  consecutivo: string;
  expedienteId?: string;
  client: ClientData;
  aprob: AprobacionState;
  aprobado: { honorariosBase: number; descuento: number; honorariosFinales: number };
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hasDiscount = aprobado.descuento > 0;
  const expedienteCorto = expedienteId ? `EXP-${expedienteId.slice(0, 8).toUpperCase()}` : "—";
  return (
    <div id={id} style={printShell}>
      <div style={{ display: "flex", minHeight: 1080 }}>
        <div
          style={{
            width: 220,
            background: NUVEX_GRADIENT,
            color: "#fff",
            padding: "36px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <LogoMark light size={180} />
            <div style={{ marginTop: 18, fontSize: 9.5, letterSpacing: 2.5, fontWeight: 700, opacity: 0.85 }}>
              DOCUMENTO
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1, marginTop: 4, letterSpacing: -0.3 }}>
              Cuenta<br />de cobro
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 8.5, letterSpacing: 1.5, opacity: 0.75, fontWeight: 700 }}>CONSECUTIVO</div>
              <div style={{ fontSize: 15, fontWeight: 900, marginTop: 4 }}>{consecutivo}</div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 8.5, letterSpacing: 1.5, opacity: 0.75, fontWeight: 700 }}>EXPEDIENTE</div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>{expedienteCorto}</div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 8.5, letterSpacing: 1.5, opacity: 0.75, fontWeight: 700 }}>FECHA</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{hoy}</div>
            </div>
          </div>

          <div style={{ fontSize: 9, opacity: 0.85, lineHeight: 1.5, letterSpacing: 0.3 }}>
            <div style={{ fontWeight: 800, letterSpacing: 1.5, marginBottom: 6 }}>NUVEX</div>
            Carrera 16 # 37-48 Piso 4<br />
            Centro Bucaramanga<br />
            Bogotá | Bucaramanga<br />
            +57 316 402 3779<br />
            www.nuvex.com.co
          </div>
        </div>

        <div style={{ flex: 1, padding: "44px 40px 32px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: NUVEX.azul }}>
            FIRMA ESPECIALIZADA EN OPTIMIZACIÓN FINANCIERA
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8, letterSpacing: -0.3 }}>
            Liquidación de honorarios
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 14, columnGap: 24, border: "1px solid #E3E7EE", borderRadius: 12, padding: "18px 20px" }}>
            <CcRow label="Cliente" value={client.nombre || "—"} />
            <CcRow label="Cédula" value={client.cedula || "—"} />
            <CcRow label="Banco" value={aprob.banco || client.banco || "—"} />
            <CcRow label="N° crédito" value={client.numeroCredito || "—"} />
            <CcRow label="Producto" value={client.tipoProducto || "—"} />
            <CcRow label="Fecha aprobación" value={aprob.fechaAprobacion || "—"} />
            <CcRow label="Asesor responsable" value={client.asesor || "—"} />
            <CcRow label="N° expediente" value={expedienteCorto} />
          </div>

          {(() => {
            // Solo renderizar bloque INTERVINIENTES si existen titulares con datos reales
            const ints = (client.intervinientes ?? []).filter(
              (p) => (p.nombreCompleto || "").trim() !== "" || (p.cedula || "").trim() !== "",
            );
            if (ints.length === 0) return null;
            return (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.azul, marginBottom: 8 }}>INTERVINIENTES</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {ints.map((p, i) => (
                    <div key={i} style={{ border: "1px solid #E3E7EE", borderRadius: 10, padding: "10px 12px", background: i === 0 ? "#F4F6FC" : "#FFFFFF" }}>
                      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: NUVEX.azul, textTransform: "uppercase" }}>
                        {i === 0 ? p.rol : `${p.rol} ${i}`}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: NUVEX.negro, marginTop: 3 }}>{p.nombreCompleto || "—"}</div>
                      <div style={{ fontSize: 9, color: "#5C6770", marginTop: 2 }}>
                        CC {p.cedula || "—"}{p.lugarExpedicionCedula ? ` · ${p.lugarExpedicionCedula}` : ""}
                      </div>
                      {p.direccion && <div style={{ fontSize: 9, color: "#5C6770", marginTop: 1 }}>{p.direccion}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {client.cobertura && (client.cobertura.activo || client.cobertura.valorCobertura || client.cobertura.tasaCobertura) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.verdeTextoFuerte, marginBottom: 8 }}>BENEFICIO DE COBERTURA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ border: `1px solid ${NUVEX.verde}`, borderRadius: 10, padding: "10px 12px", background: NUVEX.verdeClaro }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase" }}>Valor de cobertura</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NUVEX.verdeTextoFuerte, marginTop: 3 }}>{client.cobertura.valorCobertura || "No aplica"}</div>
                </div>
                <div style={{ border: `1px solid ${NUVEX.verde}`, borderRadius: 10, padding: "10px 12px", background: NUVEX.verdeClaro }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: NUVEX.verdeTextoFuerte, textTransform: "uppercase" }}>Tasa de cobertura</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NUVEX.verdeTextoFuerte, marginTop: 3 }}>{client.cobertura.tasaCobertura ? `${client.cobertura.tasaCobertura}%` : "No aplica"}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.azul, marginBottom: 8 }}>CONCEPTO</div>
            <div
              style={{
                padding: "18px 20px",
                border: "1px solid #E3E7EE",
                borderLeft: `4px solid ${NUVEX.azul}`,
                borderRadius: 12,
                background: "#FAFBFD",
                fontSize: 11.5,
                lineHeight: 1.6,
                color: NUVEX.negro,
              }}
            >
              <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>
                SERVICIO TECNOLÓGICO FINANCIERO
              </div>
              <div style={{ marginTop: 6, color: "#5C6770" }}>
                Servicio Tecnológico Financiero prestado por NUVEX Finanzas Inteligentes,
                asociado al análisis, proyección, gestión tecnológica y acompañamiento
                financiero del proceso de optimización del crédito hipotecario o leasing
                habitacional.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: NUVEX.azul, marginBottom: 8 }}>LIQUIDACIÓN</div>
            <div style={{ border: "1px solid #E3E7EE", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #EEF1F5" }}>
                <div style={{ fontSize: 11, color: "#5C6770" }}>Honorarios originales</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NUVEX.negro, textDecoration: hasDiscount ? "line-through" : "none", opacity: hasDiscount ? 0.55 : 1 }}>
                  {formatCOP(aprobado.honorariosBase)}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #EEF1F5", background: "#FAFBFD" }}>
                <div style={{ fontSize: 11, color: "#5C6770" }}>Descuento comercial</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: hasDiscount ? NUVEX.azul : "#8892A0" }}>
                  {hasDiscount ? `− ${formatCOP(aprobado.descuento)}` : formatCOP(0)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "20px 22px",
                  background: NUVEX_GRADIENT,
                  color: "#fff",
                }}
              >
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.85, fontWeight: 700 }}>TOTAL A PAGAR</div>
                  <div style={{ fontSize: 9.5, opacity: 0.85, marginTop: 2 }}>Honorarios finales</div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>
                  {formatCOP(aprobado.honorariosFinales)}
                </div>
              </div>
            </div>
            {hasDiscount && (
              <div style={{ marginTop: 8, fontSize: 10, color: NUVEX.verdeTextoFuerte, fontWeight: 700, letterSpacing: 0.4 }}>
                Beneficio aplicado: ahorras {formatCOP(aprobado.descuento)} sobre los honorarios originales.
              </div>
            )}
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              "Solo pagas si el proceso fue exitoso",
              "Estrategia financiera especializada",
              "Acompañamiento profesional NUVEX",
            ].map((t) => (
              <div key={t} style={{ border: `1px solid ${NUVEX.verde}`, background: NUVEX.verdeClaro, borderRadius: 12, padding: "12px 14px", fontSize: 10.5, fontWeight: 700, color: NUVEX.verdeTextoFuerte, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>✓</span>
                <span>{t}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, padding: "18px 20px", borderRadius: 12, border: "1px solid #E3E7EE", fontSize: 11, lineHeight: 1.6, color: "#5C6770" }}>
            <div style={{ fontWeight: 800, color: NUVEX.negro, letterSpacing: 0.4, marginBottom: 4 }}>Gracias por confiar en NUVEX.</div>
            Nos sentimos orgullosos de haber contribuido a mejorar las condiciones de tu crédito.
            Cada año eliminado representa más tranquilidad financiera para tu familia.
          </div>
        </div>
      </div>
    </div>
  );
}

function CcRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: "#8892A0", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, color: NUVEX.negro }}>{value}</div>
    </div>
  );
}
