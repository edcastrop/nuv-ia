import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { getExpediente, updateEstado, deleteExpediente, ESTADOS, type Expediente, type EstadoExpediente } from "@/lib/expedientes";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { EstadoBadge } from "@/components/nuvex/EstadoBadge";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
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
import { ValidacionEntregablesBlock } from "@/components/expediente/ValidacionEntregablesBlock";
import { VersionesDocumentalesBlock } from "@/components/expediente/VersionesDocumentalesBlock";
import { RespuestaBancoBlock } from "@/components/expediente/RespuestaBancoBlock";
import { EtapasFinalesBlock } from "@/components/expediente/EtapasFinalesBlock";
import { readValidacion, puedeGenerarDocumentos, razonBloqueoDocs } from "@/lib/validacionIdentidad";
import { addRecentCase } from "@/lib/recentCases";
import { useUserRole } from "@/hooks/useUserRole";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/casos/$id")({
  component: CasoDetail,
  head: () => ({ meta: [{ title: "Expediente · NUVEX" }] }),
});

function CasoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { canValidarProyeccion } = useUserRole();
  const [exp, setExp] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    getExpediente(id)
      .then(setExp)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  // P28 — Registrar visita en "vistos recientemente" (localStorage).
  useEffect(() => {
    if (exp?.id && exp?.cliente_nombre) addRecentCase(exp.id, exp.cliente_nombre);
  }, [exp?.id, exp?.cliente_nombre]);

  // IMPORTANTE: declarar todos los hooks antes de cualquier return condicional
  // para evitar "Rendered more hooks than during the previous render".
  const maestroLike = useMemo(
    () => (exp ? expedienteToMaestroLike(exp) : null),
    [exp],
  );

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando expediente…</div>;
  if (err || !exp) return <div className="p-12 text-center text-sm text-[#B42318]">{err || "No encontrado"}</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#242424]/55">Expediente</div>
            <h1 className="text-2xl font-semibold text-[#242424]">{exp.cliente_nombre}</h1>
            <div className="mt-1 text-sm text-[#242424]/70">
              {exp.cedula && <>CC {exp.cedula} · </>}
              {exp.banco && <>{exp.banco} · </>}
              {exp.numero_credito && <>Crédito {exp.numero_credito} · </>}
              Modo <span className="uppercase font-semibold">{exp.modo}</span> · Simulado {exp.fecha_simulacion}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EstadoBadge estado={exp.estado} />
            <select
              value={exp.estado}
              onChange={async (e) => {
                const nuevo = e.target.value as EstadoExpediente;
                try {
                  await updateEstado(exp.id, nuevo);
                  reload();
                } catch (err) {
                  alert((err as Error).message);
                }
              }}
              className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium bg-white"
            >
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Link to="/casos" className="text-[11px] text-[#445DA3] hover:underline">← Volver a casos</Link>
          </div>
        </div>
      </Card>

      <EstadoCasoBlock expedienteId={exp.id} onChanged={reload} />

      <ValidacionIdentidadBlock exp={exp} onChanged={reload} />

      <ValidacionQABlock
        expedienteId={exp.id}
        estadoCaso={(exp as unknown as { estado_caso?: string }).estado_caso ?? ""}
        onChanged={reload}
      />

      <ValidacionRadicacionBlock expedienteId={exp.id} />
      <ValidacionEntregablesBlock expedienteId={exp.id} />



      <div id="lector-extracto-qa" className="scroll-mt-6">
        <SoportesBanco
          expedienteId={exp.id}
          estadoCaso={(exp as unknown as { estado_caso?: string }).estado_caso ?? ""}
          allowUploadForQA={canValidarProyeccion}
        />
      </div>

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
          <div id="resultado-bancario" className="scroll-mt-6">
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

      <div id="cierre-operativo" className="scroll-mt-6">
        <EtapasFinalesBlock
          expedienteId={exp.id}
          estadoCaso={(exp as unknown as { estado_caso?: string }).estado_caso ?? null}
          etapaPipeline={(exp as unknown as { etapa_pipeline?: never }).etapa_pipeline ?? null}
          aceptacionAt={(exp as unknown as { aceptacion_cliente_at?: string }).aceptacion_cliente_at ?? null}
          aceptacionMedio={(exp as unknown as { aceptacion_medio?: string }).aceptacion_medio ?? null}
          aceptacionObservaciones={(exp as unknown as { aceptacion_observaciones?: string }).aceptacion_observaciones ?? null}
          onChanged={reload}
        />
      </div>


      {(() => {
        const v = readValidacion(exp as never);
        const ok = puedeGenerarDocumentos(v);
        if (!ok) {
          return (
            <Card>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0" style={{ background: "#7A0E0E" }}>
                  <Lock size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#7A0E0E" }}>Documentos jurídicos bloqueados</div>
                  <h3 className="text-lg font-semibold text-[#242424]">Validación de identidad requerida</h3>
                  <p className="text-xs text-[#242424]/70 mt-1">{razonBloqueoDocs(v)}</p>
                </div>
              </div>
            </Card>
          );
        }
        return (
          <>
            {maestroLike && (
              <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar esta sección.</div></Card>}>
                <DocumentosLegales expediente={maestroLike} simExpediente={exp} expedienteIdToPersist={exp.id} onJuridicaSaved={reload} />
              </ErrorBoundary>
            )}
            {maestroLike && (
              <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar el Módulo Jurídico.</div></Card>}>
                <ModuloJuridico expediente={maestroLike} />
              </ErrorBoundary>
            )}
            {maestroLike && (
              <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar el Checklist Documental.</div></Card>}>
                <Card>
                  <div className="mb-3">
                    <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#1F6F4A" }}>
                      Etapa 7 · Radicación bancaria
                    </div>
                    <h3 className="text-lg font-semibold text-[#242424]">Checklist Documental Inteligente</h3>
                    <p className="text-xs text-[#242424]/65 mt-0.5">
                      Soportes que exige el banco para radicar el caso. La matriz se ajusta por banco, perfil laboral y condiciones del cliente.
                    </p>
                  </div>
                  <ChecklistDocumental expediente={maestroLike} simExpediente={exp} />
                </Card>
              </ErrorBoundary>
            )}
            <VersionesDocumentalesBlock exp={exp} />
          </>
        );
      })()}

      <CarteraBlockExpediente expedienteId={exp.id} estadoCaso={(exp as unknown as { estado_caso?: string }).estado_caso ?? ""} />

      <ConversacionCaso expedienteId={exp.id} clienteNombre={exp.cliente_nombre} />

      <HistorialCaso expedienteId={exp.id} />



      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#242424]/70">¿Eliminar este expediente?</div>
          <button
            onClick={async () => {
              if (!confirm("¿Eliminar definitivamente este expediente?")) return;
              try {
                await deleteExpediente(exp.id);
                navigate({ to: "/casos" });
              } catch (e) {
                alert((e as Error).message);
              }
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "#F5C2C2", color: "#B42318", backgroundColor: "#FDECEC" }}
          >
            Eliminar
          </button>
        </div>
      </Card>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error("[ExpedienteSection]", err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}
