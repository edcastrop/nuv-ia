import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import {
  getMaestro,
  upsertMaestro,
  deleteMaestro,
  emptyCliente,
  emptyCotitular,
  emptyCredito,
  emptyFresh,
  emptyAsesor,
  emptyLicenciado,
  emptyApoderado,
  type ExpedienteMaestro,
} from "@/lib/expedienteMaestro";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { MaestroEditor } from "@/components/expediente-maestro/MaestroEditor";
import { DocumentosLegales } from "@/components/expediente-maestro/DocumentosLegales";
import { ModuloJuridico } from "@/components/expediente-maestro/ModuloJuridico";
import { MotorExtractosNUVEX } from "@/components/nuvex/MotorExtractosNUVEX";
import { QAFinancieroBlock } from "@/components/expediente/QAFinancieroBlock";
import { ProyeccionesDropzone } from "@/components/proyecciones/ProyeccionesDropzone";
import { VerificacionCierreBlock } from "@/components/proyecciones/VerificacionCierreBlock";
import { bancoGeneraProyeccionesCierre, motivoSinProyecciones } from "@/lib/bancosProyecciones";
import type { MotorResultado } from "@/lib/motorExtractos.functions";
import { withFreshDerivados, normalizeTipoBeneficio, FRESH_DEFAULT_TOTAL } from "@/lib/cobertura";
import { normalizeCreditMoneyInput } from "@/lib/creditoSanity";
import { PipelineStepper14 } from "@/components/pipeline/PipelineStepper14";
import { EtapasIniciales123 } from "@/components/pipeline/EtapasIniciales123";
import { EtapasMedias456 } from "@/components/pipeline/EtapasMedias456";
import { EtapasOperativas78910 } from "@/components/pipeline/EtapasOperativas78910";
import { EtapasFinales11a14 } from "@/components/pipeline/EtapasFinales11a14";
import { AuditoriaPipeline } from "@/components/pipeline/AuditoriaPipeline";
import { TimelineEtapas14 } from "@/components/pipeline/TimelineEtapas14";
import { computeEtapaActual, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { supabase } from "@/integrations/supabase/client";
import { getExpediente, type Expediente } from "@/lib/expedientes";
import { ExpedienteStepper13 } from "@/components/expediente/ExpedienteStepper13";
import { SiguienteAccionPanel } from "@/components/expediente/SiguienteAccionPanel";
import { QueFaltaPanel } from "@/components/expediente/QueFaltaPanel";
import { ChecklistRolPanel } from "@/components/expediente/ChecklistRolPanel";
import { QABadge } from "@/components/qa-ai/QABadge";


export const Route = createFileRoute("/_authenticated/expediente-maestro/$id")({
  component: MaestroDetail,
  head: () => ({ meta: [{ title: "Expediente Maestro · NUVEX" }] }),
});

function MaestroDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [exp, setExp] = useState<ExpedienteMaestro | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [cliente, setCliente] = useState(emptyCliente());
  const [cotitular, setCotitular] = useState(emptyCotitular());
  const [credito, setCredito] = useState(emptyCredito());
  const [fresh, setFresh] = useState(emptyFresh());
  const [asesor, setAsesor] = useState(emptyAsesor());
  const [licenciado, setLicenciado] = useState(emptyLicenciado());
  const [apoderado, setApoderado] = useState(emptyApoderado());
  const [extractoAplicado, setExtractoAplicado] = useState<MotorResultado | null>(null);
  const [aplicandoExtracto, setAplicandoExtracto] = useState(false);
  const [etapaActual, setEtapaActual] = useState<EtapaPipelineId>("lead");
  const [expOperativo, setExpOperativo] = useState<Expediente | null>(null);
  const resumenRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    setLoading(true);
    getMaestro(id)
      .then(async (e) => {
        setExp(e);
        setCliente({ ...emptyCliente(), ...(e.cliente || {}) });
        setCotitular({ ...emptyCotitular(), ...(e.cotitular || {}) });
        setCredito({ ...emptyCredito(), ...(e.credito || {}) });
        setFresh({ ...emptyFresh(), ...(e.fresh || {}) });
        setAsesor({ ...emptyAsesor(), ...(e.asesor || {}) });
        setLicenciado({ ...emptyLicenciado(), ...(e.licenciado || {}) });
        setApoderado({ ...emptyApoderado(), ...(e.apoderado || {}) });
        // Pipeline / QA: primero busca el expediente operativo homólogo por el
        // mismo id del Maestro; si no existe, conserva el fallback histórico por cédula.
        let loadedOperativo = false;
        try {
          const full = await getExpediente(id);
          setExpOperativo(full);
          setEtapaActual(computeEtapaActual({ estado_caso: full.estado_caso }));
          loadedOperativo = true;
        } catch {
          // fallback histórico por cédula
        }
        if (!loadedOperativo && e.cedula_cliente) {
          const { data: exps } = await supabase
            .from("expedientes")
            .select("id, estado_caso, updated_at")
            .eq("cedula", e.cedula_cliente)
            .order("updated_at", { ascending: false })
            .limit(1);
          const row = exps?.[0] as { id?: string; estado_caso?: string | null } | undefined;
          if (row) {
            setEtapaActual(computeEtapaActual({ estado_caso: row.estado_caso }));
            if (row.id) {
              try {
                const full = await getExpediente(row.id);
                setExpOperativo(full);
              } catch { /* opcional */ }
            }
          }
        }

      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const guardar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const saved = await upsertMaestro({
        id,
        cliente,
        cotitular,
        credito,
        fresh,
        asesor,
        licenciado,
        apoderado,
      });
      setExp(saved);
      setMsg("Expediente guardado");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const aplicarExtracto = async (r: MotorResultado) => {
    setAplicandoExtracto(true);
    setMsg(null);
    try {
      const d = r.datos;
      const onlyDigits = (s: string) => (s || "").replace(/[^\d.,-]/g, "");
      const num = (s: string) => {
        const n = parseFloat((s || "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      const tasaValida = (s: string) => {
        const n = num(s);
        return n >= 7 && n <= 25 ? s : "";
      };
      const sane = normalizeCreditMoneyInput({
        valorDesembolsado: d.valorDesembolsado,
        saldoCapital: d.saldoCapital,
        cuotaActual: d.cuotaActual,
        seguros: d.seguros,
        cuotaSinSubsidio: d.cuotaSinSubsidio,
        cuotaConSubsidio: d.cuotaConSubsidio,
        cuotaConInteresSinSeguros: d.cuotaSinSubsidio || d.cuotaConSubsidio,
        valorBeneficioMensual: d.valorBeneficioMensual,
      });
      const money = (k: keyof typeof sane.numbers, fallback = "") =>
        sane.numbers[k] ?? num(fallback);
      const moneyText = (k: keyof typeof sane.values, fallback = "") =>
        sane.values[k] || onlyDigits(fallback);
      const cuotaRazonable = (v: number) => {
        const saldo = money("saldoCapital", d.saldoCapital);
        const desembolso = money("valorDesembolsado", d.valorDesembolsado);
        const base = Math.max(saldo, desembolso, 1);
        return v > 0 && v <= Math.max(8_000_000, base * 0.04);
      };

      // Beneficio / Cobertura: activamos sólo si hay valor mensual > 0
      const beneficioFlag = (d.beneficioActivo || "").toLowerCase() === "si";
      const valorBenef = money("valorBeneficioMensual", d.valorBeneficioMensual);
      const beneficioReal = beneficioFlag && valorBenef > 0;

      // Cuota actual para simulación: si hay subsidio, usamos la cuota real del crédito
      // antes del beneficio. En Bancolombia, "Valor a Pagar" ya incluye seguros, por eso
      // la base correcta es Valor a Pagar + subsidio, o cuota sin subsidio + seguros.
      const cuotaConSub = money("cuotaConSubsidio", d.cuotaConSubsidio);
      const cuotaActualDoc = money("cuotaActual", d.cuotaActual);
      const cuotaSinSub = money("cuotaSinSubsidio", d.cuotaSinSubsidio);
      const segurosNum = money("seguros", d.seguros);
      const candidatosCuotaBase = beneficioReal
        ? [
            cuotaActualDoc > 0 ? cuotaActualDoc + valorBenef : 0,
            cuotaSinSub > 0 ? cuotaSinSub + segurosNum : 0,
            cuotaConSub > 0 ? cuotaConSub + segurosNum + valorBenef : 0,
          ]
        : [cuotaActualDoc];
      const cuotaBaseSimulacion = Math.max(...candidatosCuotaBase.filter(cuotaRazonable), 0);
      const cuotaActualResuelta =
        cuotaBaseSimulacion > 0
          ? String(Math.round(cuotaBaseSimulacion))
          : moneyText("cuotaActual", d.cuotaActual) || credito.cuotaActual || "";
      const segurosResueltos =
        segurosNum > 0
          ? segurosNum
          : beneficioReal
            ? Math.max(
                0,
                cuotaActualDoc > 0 && cuotaConSub > 0 ? cuotaActualDoc - cuotaConSub : 0,
                cuotaBaseSimulacion > 0 && cuotaSinSub > 0 ? cuotaBaseSimulacion - cuotaSinSub : 0,
              )
            : 0;

      const cuotasPagadasNum = num(d.cuotasPagadas);

      const nuevoCliente = {
        ...cliente,
        nombre: cliente.nombre || d.titular || "",
        cedula: cliente.cedula || d.cedula || "",
      };
      const nuevoCredito = {
        ...credito,
        banco: r.banco || credito.banco || "",
        numeroCredito: d.numeroCredito || credito.numeroCredito || "",
        tipoProducto: r.producto || credito.tipoProducto || "",
        fechaDesembolso: d.fechaDesembolso || credito.fechaDesembolso || "",
        valorDesembolsado:
          moneyText("valorDesembolsado", d.valorDesembolsado) || credito.valorDesembolsado || "",
        plazoOriginal: d.plazoInicial || credito.plazoOriginal || "",
        saldoCapital: moneyText("saldoCapital", d.saldoCapital) || credito.saldoCapital || "",
        cuotaActual: cuotaActualResuelta,
        seguros:
          segurosResueltos > 0
            ? String(Math.round(segurosResueltos))
            : onlyDigits(d.seguros) || credito.seguros || "",
        cuotaConSubsidio:
          cuotaConSub > 0
            ? String(Math.round(cuotaConSub + segurosResueltos))
            : onlyDigits(d.cuotaActual),
        cuotaConInteresSinSeguros:
          moneyText("cuotaConInteresSinSeguros", d.cuotaSinSubsidio || d.cuotaConSubsidio) || "",
        cuotaBaseSimulacion: cuotaActualResuelta,
        tasa: tasaValida(d.tasaEA) || credito.tasa || "",
        cuotasPagadas: d.cuotasPagadas || credito.cuotasPagadas || "",
        cuotasPendientes: d.cuotasPendientes || credito.cuotasPendientes || "",
      };

      // Construcción del bloque Fresh
      const nuevoFresh = beneficioReal
        ? withFreshDerivados(
            {
              activo: true,
              tipoBeneficio: normalizeTipoBeneficio(d.tipoBeneficio || "Subsidio Gobierno"),
              valorMensual: valorBenef,
              tasa: num(d.tasaCobertura),
              cuotasTotales: FRESH_DEFAULT_TOTAL,
              detectadoOCR: true,
              fuente: "ocr",
              ultimaSincronizacion: new Date().toISOString(),
            },
            cuotasPagadasNum || undefined,
          )
        : withFreshDerivados(
            {
              activo: false,
              cuotasTotales: FRESH_DEFAULT_TOTAL,
              detectadoOCR: true,
              fuente: "ocr",
              ultimaSincronizacion: new Date().toISOString(),
            },
            cuotasPagadasNum || undefined,
          );

      setCliente(nuevoCliente);
      setCredito(nuevoCredito);
      setFresh(nuevoFresh);
      const saved = await upsertMaestro({
        id,
        cliente: nuevoCliente,
        cotitular,
        credito: nuevoCredito,
        fresh: nuevoFresh,
        asesor,
        licenciado,
        apoderado,
      });
      setExp(saved);
      setExtractoAplicado(r);
      setMsg("Expediente actualizado automáticamente desde el extracto");
      setTimeout(() => setMsg(null), 3500);
      setTimeout(
        () => resumenRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        100,
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setAplicandoExtracto(false);
    }
  };

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

  return (
    <div
      className="min-h-[calc(100vh-72px)] px-3 py-4 text-[var(--nuvia-text-primary)] sm:px-5 sm:py-6"
      style={{
        background:
          "linear-gradient(180deg, var(--nuvia-bg-primary) 0%, var(--nuvia-bg-secondary) 54%, var(--nuvia-bg-primary) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1680px] space-y-4">
      <section className="glass-panel overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase text-[var(--nuvia-accent-green)]">
              NUVIA · Expediente Maestro
            </div>
            <h1 className="mt-1 break-words text-2xl font-semibold leading-tight text-[var(--nuvia-text-primary)]">
              {cliente.nombre || "Sin nombre"}
            </h1>
            <div className="mt-1 break-words text-sm text-[var(--nuvia-text-secondary)]">
              {cliente.cedula && <>CC {cliente.cedula} · </>}
              {credito.banco && <>{credito.banco} · </>}
              Actualizado {new Date(exp.updated_at).toLocaleString("es-CO")}
            </div>
            {expOperativo?.qa_auditoria_id && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <QABadge
                  categoria={expOperativo.qa_categoria ?? null}
                  score={expOperativo.qa_score ?? null}
                  auditoriaId={expOperativo.qa_auditoria_id}
                  size="md"
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--nuvia-accent-green)]">
                  Auto-QA asociado al expediente
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {msg && <span className="mr-2 text-xs text-[var(--nuvia-text-secondary)]">{msg}</span>}
            <Link
              to="/inicio"
              search={{ maestroId: id, modo: "pesos" as const }}
              className="inline-flex h-10 items-center rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-3 text-xs font-semibold text-[var(--nuvia-text-primary)] transition hover:border-[var(--nuvia-accent-blue)] hover:bg-[rgba(255,255,255,0.06)]"
              title="Abre el simulador en pesos con los datos del expediente"
            >
              Simular en Pesos
            </Link>
            <Link
              to="/inicio"
              search={{ maestroId: id, modo: "uvr" as const }}
              className="inline-flex h-10 items-center rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-3 text-xs font-semibold text-[var(--nuvia-text-primary)] transition hover:border-[var(--nuvia-accent-blue)] hover:bg-[rgba(255,255,255,0.06)]"
              title="Abre el simulador en UVR con los datos del expediente"
            >
              Simular en UVR
            </Link>
            <button
              onClick={guardar}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-lg border border-transparent px-5 text-sm font-semibold text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--nuvia-gradient-primary)" }}
            >
              {saving ? "Guardando…" : "Guardar todo"}
            </button>
            <Link
              to="/expediente-maestro"
              className="ml-1 text-[11px] text-[var(--nuvia-accent-green)] hover:underline"
            >
              ← Volver
            </Link>
          </div>
        </div>
      </section>

      {/* Capa guiada NUVEX (13 etapas + Siguiente acción + Qué falta + Checklist por rol).
          Solo se muestra si existe un caso operativo asociado a la cédula. */}
      {expOperativo && (
        <>
          <ExpedienteStepper13 exp={expOperativo} />
          <SiguienteAccionPanel exp={expOperativo} />
          <div className="grid gap-4 md:grid-cols-2">
            <QueFaltaPanel exp={expOperativo} />
            <ChecklistRolPanel exp={expOperativo} />
          </div>
        </>
      )}

      <PipelineStepper14 etapaActual={etapaActual} />


      <EtapasIniciales123
        expedienteId={id}
        cliente={cliente}
        credito={credito}
        etapaActual={etapaActual}
        qaEstado={null}
      />

      <EtapasMedias456
        expedienteId={id}
        cliente={cliente}
        scrollContratacionId="modulo-juridico-contratacion"
      />

      <EtapasOperativas78910 expedienteId={id} etapaActual={etapaActual} />

      <EtapasFinales11a14 etapaActual={etapaActual} />

      <TimelineEtapas14 expedienteId={id} />

      <AuditoriaPipeline expedienteId={id} />



      <MaestroEditor
        cliente={cliente}
        cotitular={cotitular}
        credito={credito}
        fresh={fresh}
        asesor={asesor}
        licenciado={licenciado}
        apoderado={apoderado}
        onCliente={setCliente}
        onCotitular={setCotitular}
        onCredito={setCredito}
        onFresh={setFresh}
        onAsesor={setAsesor}
        onLicenciado={setLicenciado}
        onApoderado={setApoderado}
      />

      <DocumentosLegales
        expediente={exp}
        liveOverride={{ cliente, cotitular, credito, fresh, asesor, licenciado, apoderado }}
      />

      <div id="modulo-juridico-contratacion">
        <ModuloJuridico
          expediente={exp}
          liveOverride={{ cliente, cotitular, credito, fresh, asesor, licenciado, apoderado }}
        />
      </div>

      <MotorExtractosNUVEX expedienteId={id} onConfirm={aplicarExtracto} />

      <QAFinancieroBlock expedienteId={id} />

      <ProyeccionesDropzone expedienteId={id} variant="expediente" momento="auditoria" />

      {bancoGeneraProyeccionesCierre(credito.banco) ? (
        <>
          <ProyeccionesDropzone expedienteId={id} variant="expediente" momento="cierre" />
          <VerificacionCierreBlock expedienteId={id} bancoHint={credito.banco} variant="expediente" />
        </>
      ) : credito.banco ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-[12.5px] text-[#475569]">
          <strong className="text-[#242424]">Verificación de cierre:</strong>{" "}
          {motivoSinProyecciones(credito.banco) ?? "Este banco no emite proyecciones formales al cierre. NUVIA verificará contra el próximo extracto post-ejecución."}
        </div>
      ) : null}

      {(aplicandoExtracto || extractoAplicado) && (
        <div ref={resumenRef}>
          <Card>
            {aplicandoExtracto && !extractoAplicado ? (
              <div className="flex items-center gap-2 text-sm text-[#242424]/70">
                <Sparkles className="h-4 w-4 animate-pulse" style={{ color: NUVEX.azul }} />
                Aplicando datos del extracto al expediente…
              </div>
            ) : extractoAplicado ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: NUVEX.verdeClaro }}
                  >
                    <CheckCircle2 className="h-5 w-5" style={{ color: NUVEX.verdeTextoFuerte }} />
                  </div>
                  <div className="flex-1">
                    <div
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: NUVEX.verdeTextoFuerte }}
                    >
                      Extracto aplicado al expediente
                    </div>
                    <h3 className="text-lg font-semibold text-[#242424]">Resumen detectado</h3>
                    <p className="text-xs text-[#242424]/60">
                      Los datos del crédito se actualizaron automáticamente. Revisa el resumen y
                      genera una nueva simulación.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <ResumenItem label="Banco" value={extractoAplicado.banco} />
                  <ResumenItem label="Producto" value={extractoAplicado.producto || "—"} />
                  <ResumenItem label="Titular" value={extractoAplicado.datos.titular || "—"} />
                  <ResumenItem
                    label="N° crédito"
                    value={extractoAplicado.datos.numeroCredito || "—"}
                  />
                  <ResumenItem
                    label="Saldo capital"
                    value={extractoAplicado.datos.saldoCapital || "—"}
                  />
                  <ResumenItem
                    label="Cuota actual"
                    value={extractoAplicado.datos.cuotaActual || "—"}
                  />
                  <ResumenItem label="Tasa EA" value={extractoAplicado.datos.tasaEA || "—"} />
                  <ResumenItem
                    label="Cuotas pendientes"
                    value={extractoAplicado.datos.cuotasPendientes || "—"}
                  />
                </div>

                {/* BENEFICIO DE COBERTURA / FRESH / FRECH / Subsidio Gobierno */}
                <BeneficioBlock fresh={fresh} datos={extractoAplicado.datos} />

                <div
                  className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t"
                  style={{ borderColor: "#EEF1F5" }}
                >
                  <div className="text-[11px] text-[#242424]/60">
                    Confianza global:{" "}
                    <strong style={{ color: NUVEX.verdeTextoFuerte }}>
                      {extractoAplicado.confianzaGlobal.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to="/inicio"
                      search={{ maestroId: id, modo: "pesos" as const }}
                      className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90"
                      style={{ background: NUVEX.verde }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generar Nueva Simulación
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/inicio"
                      search={{ maestroId: id, modo: "uvr" as const }}
                      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold"
                      style={{ borderColor: NUVEX.azul, color: NUVEX.azul, background: "#fff" }}
                    >
                      Simular en UVR
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      <section className="glass-panel p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--nuvia-text-secondary)]">¿Eliminar este expediente maestro?</div>
          <button
            onClick={async () => {
              if (!confirm("¿Eliminar definitivamente?")) return;
              try {
                await deleteMaestro(id);
                navigate({ to: "/expediente-maestro" });
              } catch (e) {
                alert((e as Error).message);
              }
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

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: "#E5E7EB", background: "#FBFCFD" }}
    >
      <div className="text-[10px] uppercase tracking-wide text-[#242424]/55">{label}</div>
      <div className="text-sm font-semibold text-[#242424] truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function BeneficioBlock({
  fresh,
  datos,
}: {
  fresh: {
    activo: boolean;
    tipoBeneficio?: string;
    valorMensual: number;
    tasa: number;
    cuotasPagadas: number;
    cuotasPendientes: number;
  };
  datos: Record<string, string>;
}) {
  const activo = !!fresh.activo && fresh.valorMensual > 0;
  const fmt = (n: number) => (n > 0 ? `$ ${Math.round(n).toLocaleString("es-CO")}` : "—");
  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{
        borderColor: activo ? NUVEX.verde : "#E5E7EB",
        background: activo ? NUVEX.verdeClaro : "#FBFCFD",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: activo ? NUVEX.verdeTextoFuerte : "#6b7280" }}
        >
          Beneficio de Cobertura
        </div>
        <div
          className="text-[11px] font-semibold"
          style={{ color: activo ? NUVEX.verdeTextoFuerte : "#6b7280" }}
        >
          {activo ? "Sí aplica" : "No aplica"}
        </div>
      </div>
      {activo ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <ResumenItem
            label="Tipo beneficio"
            value={fresh.tipoBeneficio || datos.tipoBeneficio || "Subsidio Gobierno"}
          />
          <ResumenItem label="Valor mensual" value={fmt(fresh.valorMensual)} />
          <ResumenItem
            label="Tasa cobertura"
            value={fresh.tasa > 0 ? `${fresh.tasa}%` : "Sin dato detectado"}
          />
          <ResumenItem
            label="Cuota con cobertura"
            value={datos.cuotaConSubsidio ? fmt(Number(datos.cuotaConSubsidio)) : "—"}
          />
          <ResumenItem
            label="Cuota sin cobertura"
            value={datos.cuotaSinSubsidio ? fmt(Number(datos.cuotaSinSubsidio)) : "—"}
          />
          <ResumenItem label="Cuotas beneficio pagadas" value={String(fresh.cuotasPagadas)} />
          <ResumenItem label="Cuotas beneficio pendientes" value={String(fresh.cuotasPendientes)} />
          <ResumenItem label="Cuotas totales" value="84" />
        </div>
      ) : (
        <div className="text-xs text-[#242424]/60">
          No se detectó subsidio Gobierno / FRECH / Fresh con valor mensual mayor a cero en este
          extracto.
        </div>
      )}
    </div>
  );
}
