import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { getExpediente, updateEstado, deleteExpediente, ESTADOS, type Expediente, type EstadoExpediente } from "@/lib/expedientes";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { EstadoBadge } from "@/components/nuvex/EstadoBadge";
import { Card } from "@/components/nuvex/ui";
import { DocumentosLegales } from "@/components/expediente-maestro/DocumentosLegales";
import { ModuloJuridico } from "@/components/expediente-maestro/ModuloJuridico";
import { ChecklistDocumental } from "@/components/expediente-maestro/ChecklistDocumental";
import { expedienteToMaestroLike } from "@/lib/expedienteMaestro";
import { EstadoCasoBlock } from "@/components/expediente/EstadoCasoBlock";
import { HistorialCaso } from "@/components/expediente/HistorialCaso";
import { SoportesBanco } from "@/components/expediente/SoportesBanco";
import { ValidacionQABlock } from "@/components/qa/ValidacionQABlock";
import { CarteraBlockExpediente } from "@/components/cartera/CarteraBlockExpediente";
import { ConversacionCaso } from "@/components/expediente/ConversacionCaso";
import { ValidacionIdentidadBlock } from "@/components/expediente/ValidacionIdentidadBlock";
import { ValidacionRadicacionBlock } from "@/components/expediente/ValidacionRadicacionBlock";
import { EntregaDocumentalBlock } from "@/components/expediente/EntregaDocumentalBlock";
import { ValidacionEntregablesBlock } from "@/components/expediente/ValidacionEntregablesBlock";
import { VersionesDocumentalesBlock } from "@/components/expediente/VersionesDocumentalesBlock";
import { RespuestaBancoBlock } from "@/components/expediente/RespuestaBancoBlock";
import { AnalisisCapacidadPagoBlock } from "@/components/expediente/AnalisisCapacidadPagoBlock";
import { EtapasFinalesBlock } from "@/components/expediente/EtapasFinalesBlock";
import { ResultadoFinal, type ProyeccionNuvex } from "@/components/nuvex/ResultadoFinal";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { ACCION_A_ESTADO } from "@/lib/casoEstados";

import { parseCurrency, parseDecimal, parsePercentage } from "@/lib/format";
import { readValidacion, puedeGenerarDocumentos, razonBloqueoDocs } from "@/lib/validacionIdentidad";
import { addRecentCase } from "@/lib/recentCases";
import { useUserRole } from "@/hooks/useUserRole";
import { Lock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExpedienteStepper13 } from "@/components/expediente/ExpedienteStepper13";
import { SiguienteAccionPanel } from "@/components/expediente/SiguienteAccionPanel";
import { QueFaltaPanel } from "@/components/expediente/QueFaltaPanel";
import { ChecklistRolPanel } from "@/components/expediente/ChecklistRolPanel";
import { ResumenEjecutivo } from "@/components/expediente/ResumenEjecutivo";
import { ControlOperativoPanel } from "@/components/expediente/ControlOperativoPanel";
import { ETAPA_A_DESTINO, type EtapaGuiadaId, type TabId } from "@/lib/expedienteGuiado";

export const Route = createFileRoute("/_authenticated/casos/$id")({
  component: CasoDetail,
  head: () => ({ meta: [{ title: "Expediente · NUVEX" }] }),
});

function CasoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { canValidarProyeccion, isManager } = useUserRole();
  const [exp, setExp] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");

  const reload = () => {
    setLoading(true);
    getExpediente(id)
      .then(setExp)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  useEffect(() => {
    if (exp?.id && exp?.cliente_nombre) addRecentCase(exp.id, exp.cliente_nombre);
  }, [exp?.id, exp?.cliente_nombre]);

  const maestroLike = useMemo(
    () => (exp ? expedienteToMaestroLike(exp) : null),
    [exp],
  );

  if (loading)
    return (
      <div
        className="min-h-[calc(100vh-72px)] p-12 text-center text-sm text-[var(--nuvia-text-secondary)]"
        style={{ background: "linear-gradient(180deg, var(--nuvia-bg-primary) 0%, var(--nuvia-bg-secondary) 54%, var(--nuvia-bg-primary) 100%)" }}
      >
        Cargando expediente…
      </div>
    );
  if (err || !exp)
    return (
      <div
        className="min-h-[calc(100vh-72px)] p-12 text-center text-sm text-[var(--nuvia-danger)]"
        style={{ background: "linear-gradient(180deg, var(--nuvia-bg-primary) 0%, var(--nuvia-bg-secondary) 54%, var(--nuvia-bg-primary) 100%)" }}
      >
        {err || "No encontrado"}
      </div>
    );

  const estadoCaso = (exp as unknown as { estado_caso?: string }).estado_caso ?? "";
  const validacionIdentidad = readValidacion(exp as never);
  const puedeDocs = puedeGenerarDocumentos(validacionIdentidad);

  // Iniciales del titular para el avatar
  const iniciales = (exp.cliente_nombre || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  const TAB_TRIGGER =
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer " +
    "text-[var(--nuvia-text-secondary)] hover:text-[var(--nuvia-text-primary)] hover:bg-[rgba(255,255,255,0.05)] " +
    "data-[state=active]:bg-[rgba(68,93,163,0.22)] data-[state=active]:text-[var(--nuvia-text-primary)] data-[state=active]:shadow-[0_0_0_1px_rgba(68,93,163,0.45)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nuvia-accent-blue)] focus-visible:ring-offset-0";

  return (
    <div
      className="min-h-[calc(100vh-72px)] px-3 py-4 text-[var(--nuvia-text-primary)] sm:px-5 sm:py-6"
      style={{
        background:
          "linear-gradient(180deg, var(--nuvia-bg-primary) 0%, var(--nuvia-bg-secondary) 54%, var(--nuvia-bg-primary) 100%)",
      }}
    >
      <div className="nuvia-shell-soft mx-auto max-w-[1680px] space-y-4">
      {/* Hero ejecutivo */}
      <section
        className="glass-panel overflow-hidden"
        style={{ padding: "var(--nuvia-space-5)" }}
      >
        <Link
          to="/casos"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--nuvia-text-secondary)] hover:text-[var(--nuvia-accent-green)] transition"
        >
          ← Casos
        </Link>
        <div className="mt-2 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          {/* Identidad del titular */}
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="grid place-items-center rounded-2xl text-base font-bold shrink-0"
              style={{
                width: 56,
                height: 56,
                background: "linear-gradient(135deg, rgba(68,93,163,0.45), rgba(132,185,143,0.35))",
                color: "var(--nuvia-text-primary)",
                border: "1px solid var(--nuvia-border-strong)",
              }}
              aria-hidden
            >
              {iniciales || "·"}
            </div>
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold uppercase"
                style={{
                  background: "rgba(132,185,143,0.16)",
                  color: "#9BCB9F",
                  border: "1px solid rgba(132,185,143,0.40)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                }}
              >
                NUVEX · Expediente Guiado
              </span>
              <h1
                className="mt-1.5 font-bold tracking-tight break-words"
                style={{
                  fontSize: "clamp(20px, 2.2vw, 26px)",
                  lineHeight: 1.15,
                  color: "var(--nuvia-text-primary)",
                }}
              >
                {exp.cliente_nombre}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--nuvia-text-secondary)]">
                {exp.cedula && (
                  <span className="inline-flex items-center gap-1">
                    <span className="opacity-60">CC</span>
                    <span className="font-semibold text-[var(--nuvia-text-primary)]">{exp.cedula}</span>
                  </span>
                )}
                {exp.banco && (
                  <>
                    <span className="opacity-30">·</span>
                    <span className="font-semibold text-[var(--nuvia-text-primary)]">{exp.banco}</span>
                  </>
                )}
                {exp.numero_credito && (
                  <>
                    <span className="opacity-30">·</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="opacity-60">Crédito</span>
                      <span className="font-semibold text-[var(--nuvia-text-primary)]">{exp.numero_credito}</span>
                    </span>
                  </>
                )}
                <span className="opacity-30">·</span>
                <span
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--nuvia-border)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {exp.modo}
                </span>
                <span className="opacity-30">·</span>
                <span>
                  <span className="opacity-60">Simulado</span>{" "}
                  <span className="font-semibold text-[var(--nuvia-text-primary)]">{exp.fecha_simulacion}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Estado + cambio de estado */}
          <div className="flex flex-col items-stretch gap-2 lg:items-end shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nuvia-text-secondary)]">
                Estado
              </span>
              <EstadoBadge estado={exp.estado} />
            </div>
            <select
              value={exp.estado}
              onChange={async (e) => {
                const nuevo = e.target.value as EstadoExpediente;
                try { await updateEstado(exp.id, nuevo); reload(); }
                catch (err) { alert((err as Error).message); }
              }}
              className="h-9 min-w-[200px] rounded-lg border px-3 text-xs font-medium outline-none transition focus:ring-2"
              style={{
                background: "var(--nuvia-bg-tertiary)",
                borderColor: "var(--nuvia-border-strong)",
                color: "var(--nuvia-text-primary)",
              }}
            >
              {ESTADOS.map((s) => <option key={s} value={s} style={{ background: "var(--nuvia-bg-card)", color: "var(--nuvia-text-primary)" }}>{s}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Stepper 13 etapas — clic salta a la pestaña y bloque correspondiente */}
      <ExpedienteStepper13
        exp={exp}
        onSelectEtapa={(id: EtapaGuiadaId) => {
          const dest = ETAPA_A_DESTINO[id];
          if (!dest) return;
          setTab(dest.tab);
          if (dest.scrollToId) {
            // Esperar a que la pestaña pinte el bloque antes de hacer scroll
            setTimeout(() => {
              const el = document.getElementById(dest.scrollToId!);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 120);
          }
        }}
      />

      {/* Tu siguiente acción */}
      <SiguienteAccionPanel exp={exp} onIrATab={setTab} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-4">
        <TabsList
          className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border p-1.5"
          style={{
            background: "rgba(13,18,36,0.55)",
            borderColor: "var(--nuvia-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          <TabsTrigger value="resumen" className={TAB_TRIGGER}>Resumen</TabsTrigger>
          <TabsTrigger value="tareas" className={TAB_TRIGGER}>Tareas</TabsTrigger>
          <TabsTrigger value="documentos" className={TAB_TRIGGER}>Documentos</TabsTrigger>
          <TabsTrigger value="comunicaciones" className={TAB_TRIGGER}>Comunicaciones</TabsTrigger>
          <TabsTrigger value="financiero" className={TAB_TRIGGER}>Financiero</TabsTrigger>
          <TabsTrigger value="juridico" className={TAB_TRIGGER}>Jurídico</TabsTrigger>
          <TabsTrigger value="auditoria" className={TAB_TRIGGER}>Auditoría</TabsTrigger>
          <TabsTrigger value="historial" className={TAB_TRIGGER}>Historial</TabsTrigger>
        </TabsList>



        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4">
          <ResumenEjecutivo exp={exp} />
          <QueFaltaPanel exp={exp} onIrATab={setTab} />
          <ChecklistRolPanel exp={exp} onIrATab={setTab} />
          {isManager && <ControlOperativoPanel exp={exp} />}
        </TabsContent>

        {/* TAREAS */}
        <TabsContent value="tareas" className="space-y-4">
          <EstadoCasoBlock expedienteId={exp.id} onChanged={reload} />
          <div id="validacion-identidad" className="scroll-mt-6">
            <ValidacionIdentidadBlock exp={exp} onChanged={reload} />
          </div>
          <ValidacionRadicacionBlock expedienteId={exp.id} />
          <EntregaDocumentalBlock
            expedienteId={exp.id}
            onIrAFinanciero={() => {
              setTab("financiero");
              setTimeout(() => {
                document
                  .getElementById("simulador-financiero-qa")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }}
          />
          <ValidacionEntregablesBlock expedienteId={exp.id} />
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-4">
          {!puedeDocs ? (
            <Card>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0" style={{ background: "#7A0E0E" }}>
                  <Lock size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#7A0E0E" }}>Documentos jurídicos bloqueados</div>
                  <h3 className="text-lg font-semibold text-[#242424]">Validación de identidad requerida</h3>
                  <p className="text-xs text-[#242424]/70 mt-1">{razonBloqueoDocs(validacionIdentidad)}</p>
                  <button
                    type="button"
                    onClick={() => setTab("tareas")}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#E3E7EE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#445DA3] hover:bg-[#EEF1FA]"
                  >Ir a validar identidad →</button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {maestroLike && (
                <div id="documentos-juridicos" className="scroll-mt-6 space-y-4">
                  <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar esta sección.</div></Card>}>
                    <DocumentosLegales expediente={maestroLike} simExpediente={exp} expedienteIdToPersist={exp.id} onJuridicaSaved={reload} />
                  </ErrorBoundary>
                </div>
              )}
              {maestroLike && (
                <div id="checklist-documental" className="scroll-mt-6">
                  <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar el Checklist Documental.</div></Card>}>
                    <Card>
                      <div className="mb-3">
                        <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#1F6F4A" }}>
                          Etapa 5 · Documentación bancaria
                        </div>
                        <h3 className="text-lg font-semibold text-[#242424]">Checklist Documental Inteligente</h3>
                        <p className="text-xs text-[#242424]/65 mt-0.5">
                          Soportes que exige el banco para radicar el caso. La matriz se ajusta por banco, perfil laboral y condiciones del cliente.
                        </p>
                      </div>
                      <ChecklistDocumental expediente={maestroLike} simExpediente={exp} />
                    </Card>
                  </ErrorBoundary>
                </div>
              )}
              <VersionesDocumentalesBlock exp={exp} />
            </>
          )}
        </TabsContent>

        {/* COMUNICACIONES */}
        <TabsContent value="comunicaciones" className="space-y-4">
          <ConversacionCaso expedienteId={exp.id} clienteNombre={exp.cliente_nombre} />
        </TabsContent>

        {/* FINANCIERO */}
        <TabsContent value="financiero" className="space-y-4 nuvia-financiero-dark">
          <div id="simulador-financiero-qa" className="scroll-mt-6">
            {exp.modo === "pesos" ? (
              <PesosSimulator initialExpediente={exp} onSaved={reload} />
            ) : (
              <UVRSimulator initialExpediente={exp} onSaved={reload} />
            )}
          </div>

          {(() => {
            const prop = (exp as unknown as { propuesta_data?: Record<string, unknown> }).propuesta_data ?? {};
            const cli = (exp.cliente_data ?? {}) as unknown as Record<string, unknown>;
            const cuotasPactadas = Number((exp as unknown as { cuotas_pactadas?: number }).cuotas_pactadas ?? 0)
              || Number(prop.cuotasEliminadas ?? 0);
            const honorariosPactados = Number((exp as unknown as { honorarios_pactados?: number }).honorarios_pactados ?? 0)
              || Number(prop.honorarios ?? 0);
            return (
              <div id="resultado-bancario" className="scroll-mt-6 space-y-4">
                <AnalisisCapacidadPagoBlock
                  expedienteId={exp.id}
                  banco={String(cli.banco ?? "")}
                  cuotaPropuesta={Number(prop.nuevaCuota ?? 0)}
                />
                <RespuestaBancoBlock
                  expedienteId={exp.id}
                  simulacionId={(exp as unknown as { simulacion_id?: string }).simulacion_id ?? null}
                  analistaId={(exp as unknown as { user_id?: string }).user_id ?? null}
                  numeroExpediente={exp.id.slice(0, 8)}
                  clienteNombre={String(cli.nombre ?? "")}
                  clienteCedula={String(cli.cedula ?? "")}
                  bancoNombre={String(cli.banco ?? "")}
                  cuotasPactadas={cuotasPactadas}
                  honorariosPactados={honorariosPactados}
                  cuotaPropuesta={Number(prop.nuevaCuota ?? 0)}
                  plazoPropuesto={Number(prop.nuevoPlazo ?? 0)}
                  cuotasEliminadasPropuestas={Number(prop.cuotasEliminadas ?? cuotasPactadas)}
                  ahorroPropuesto={Number(prop.ahorroTotal ?? 0)}
                />
              </div>
            );
          })()}

          {(() => {
            const prop = (exp as unknown as { propuesta_data?: Record<string, unknown> }).propuesta_data ?? {};
            const cli = (exp.cliente_data ?? {}) as unknown as Record<string, unknown>;
            const cred = (exp.credito_data ?? {}) as unknown as Record<string, unknown>;
            const plazoInicial = parseDecimal(String(cli.plazoInicial ?? ""));
            const cuotasPagadas = parseDecimal(String(cli.cuotasPagadas ?? ""));
            const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
            const honorariosPct = parsePercentage(String(cli.porcentajeHonorarios ?? "")) || 6;
            const cuotaActualConSeguro = parseCurrency(String(cred.cuotaActual ?? ""));
            const seguros = parseCurrency(String(cred.seguros ?? ""));
            const nuevoPlazo = Number(prop.nuevoPlazo ?? 0);
            const proyeccion: ProyeccionNuvex | null = (prop.nuevaCuota || prop.honorarios)
              ? {
                  cuotaProyectada: Number(prop.nuevaCuota ?? 0),
                  plazoProyectado: nuevoPlazo,
                  cuotasEliminadasProyectadas: Number(prop.cuotasEliminadas ?? Math.max(0, cuotasPendientes - nuevoPlazo)),
                  añosEliminadosProyectados: Number(prop.añosEliminados ?? 0),
                  ahorroInteresesProyectado: Number(prop.ahorroIntereses ?? 0),
                  ahorroSegurosProyectado: Number(prop.ahorroSeguros ?? 0),
                  ahorroProyectado: Number(prop.ahorroTotal ?? 0),
                  honorariosProyectados: Number(prop.honorarios ?? 0),
                  honorariosBase: Number(exp.honorarios_base ?? prop.honorarios ?? 0),
                  descuentoAplicado: Number(exp.descuento ?? 0),
                  honorariosFinales: Number(exp.honorarios_final ?? prop.honorarios ?? 0),
                  fechaSimulacion: exp.fecha_simulacion,
                  fuente: (prop.fuente as "manual" | "automatica") ?? "automatica",
                }
              : null;
            return (
              <div id="informe-final" className="scroll-mt-6">
                <ResultadoFinal
                  mode={exp.modo}
                  client={exp.cliente_data}
                  proyeccion={proyeccion}
                  cuotasPendientes={cuotasPendientes}
                  cuotaActualConSeguro={cuotaActualConSeguro}
                  seguros={seguros}
                  honorariosPct={honorariosPct}
                  expedienteId={exp.id}
                  aprobadoInicial={exp.aprobado_data}
                  estado={exp.estado}
                  onInformeEnviado={async () => {
                    try {
                      await cambiarEstadoConValidacion(exp.id, ACCION_A_ESTADO["resultado_final"], "resultado_final");
                    } catch (e) {
                      console.warn("[informe_final] avance etapa", e);
                      throw e instanceof Error ? e : new Error("No se pudo completar la etapa de informe final.");
                    } finally {
                      reload();
                    }
                  }}
                  onCuentaCobroEnviada={async () => {
                    try {
                      await cambiarEstadoConValidacion(exp.id, ACCION_A_ESTADO["cuenta_cobro_enviada"], "cuenta_cobro_enviada");
                    } catch (e) {
                      console.warn("[cuenta_cobro] avance etapa", e);
                      throw e instanceof Error ? e : new Error("No se pudo completar la etapa de cuenta de cobro.");
                    } finally {
                      reload();
                    }
                  }}
                />
              </div>

            );
          })()}

          <div id="cierre-operativo" className="scroll-mt-6">
            <EtapasFinalesBlock
              expedienteId={exp.id}
              estadoCaso={estadoCaso || null}
              etapaPipeline={(exp as unknown as { etapa_pipeline?: never }).etapa_pipeline ?? null}
              aceptacionAt={(exp as unknown as { aceptacion_cliente_at?: string }).aceptacion_cliente_at ?? null}
              aceptacionMedio={(exp as unknown as { aceptacion_medio?: string }).aceptacion_medio ?? null}
              aceptacionObservaciones={(exp as unknown as { aceptacion_observaciones?: string }).aceptacion_observaciones ?? null}
              onChanged={reload}
            />
          </div>

          <div id="cartera-expediente" className="scroll-mt-6">
            <CarteraBlockExpediente expedienteId={exp.id} estadoCaso={estadoCaso} />
          </div>
        </TabsContent>

        {/* JURÍDICO */}
        <TabsContent value="juridico" className="space-y-4">
          {maestroLike ? (
            <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar el Módulo Jurídico.</div></Card>}>
              <ModuloJuridico expediente={maestroLike} />
            </ErrorBoundary>
          ) : (
            <Card><div className="text-sm text-[#242424]/60">Sin datos jurídicos disponibles.</div></Card>
          )}
        </TabsContent>

        {/* AUDITORÍA */}
        <TabsContent value="auditoria" className="space-y-4">
          <div id="validacion-qa" className="scroll-mt-6">
            <ValidacionQABlock
              expedienteId={exp.id}
              estadoCaso={estadoCaso}
              onChanged={reload}
            />
          </div>
          <div id="lector-extracto-qa" className="scroll-mt-6">
            <SoportesBanco
              expedienteId={exp.id}
              estadoCaso={estadoCaso}
              allowUploadForQA={canValidarProyeccion}
            />
          </div>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="historial" className="space-y-4">
          <HistorialCaso expedienteId={exp.id} />
        </TabsContent>
      </Tabs>

      {/* Zona peligro */}
      <section className="glass-panel p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--nuvia-text-secondary)]">¿Eliminar este expediente?</div>
          <button
            onClick={async () => {
              if (!confirm("¿Eliminar definitivamente este expediente?")) return;
              try { await deleteExpediente(exp.id); navigate({ to: "/casos" }); }
              catch (e) { alert((e as Error).message); }
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-110"
            style={{
              borderColor: "color-mix(in oklab, var(--nuvia-danger) 40%, transparent)",
              background: "color-mix(in oklab, var(--nuvia-danger) 14%, transparent)",
              color: "var(--nuvia-danger)",
            }}
          >
            Eliminar
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error("[ExpedienteSection]", err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}
