// Botón "Descargar Case Snapshot" — genera el PDF Executive Snapshot.
// Render visual con CaseSnapshotPDF (HTML/CSS) + captura html2canvas → jsPDF.
// Visible para roles operativos del caso. No modifica permisos existentes.

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Loader2, Check } from "lucide-react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { getCaseSnapshotData, type CaseSnapshotDTO } from "@/lib/caseSnapshot.functions";
import {
  CaseSnapshotPDF,
  type CaseSnapshotData,
  type PipelineEstado,
} from "@/components/case-snapshot/CaseSnapshotPDF";
import { usePDFExport } from "@/components/case-snapshot/usePDFExport";

const ROLES_PERMITIDOS: AppRole[] = [
  "asesor",
  "director_financiero_qa",
  "juridica",
  "director_juridico",
  "apoderado",
  "contabilidad",
  "gerencia",
  "admin",
  "super_admin",
  "operaciones",
];

interface Props {
  expedienteId: string;
  clienteNombre?: string;
}

const PIPELINE_STEPS = [
  "Simulación",
  "QA",
  "Contrato",
  "Poder",
  "Checklist",
  "Radicación",
  "Respuesta Banco",
  "Informe Final",
  "Cuenta Cobro",
  "Paz y Salvo",
];

function mapEstadoPipeline(e: "hecho" | "curso" | "pendiente"): PipelineEstado {
  if (e === "hecho") return "completado";
  if (e === "curso") return "en_proceso";
  return "pendiente";
}

function buildPipeline(dto: CaseSnapshotDTO): CaseSnapshotData["pipeline"] {
  const byNombre = new Map<string, PipelineEstado>();
  (dto.timeline ?? []).forEach((t) => {
    byNombre.set(t.etiqueta.toLowerCase(), mapEstadoPipeline(t.estado));
  });
  return PIPELINE_STEPS.map((nombre) => ({
    nombre,
    estado: byNombre.get(nombre.toLowerCase()) ?? "no_iniciado",
  }));
}

function formatEstadoCaso(raw: string): string {
  if (!raw || raw === "—") return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function dtoToSnapshot(dto: CaseSnapshotDTO): CaseSnapshotData {
  const m = dto.meta;
  const c = dto.credito;
  const p = dto.propuesta;
  const h = dto.honorarios;
  const costoTotal = c.costoReal || c.totalProyectado || 0;

  // NO restar seguros — cuotaActual del extracto ya viene neta
  const cuotaDisplay = c.cuotaActual || 0;

  // Multiplicador: siempre recalcular desde costoTotal/saldoCapital
  // para evitar usar vecesPagado guardado que puede estar mal
  const multiplicador =
    costoTotal > 0 && c.saldoCapital > 0
      ? Math.round((costoTotal / c.saldoCapital) * 100) / 100
      : c.vecesPagado || 0;

  const cuotasPendientesCoherentes =
    p.nuevoPlazo > 0 && p.cuotasEliminadas > 0
      ? p.nuevoPlazo + p.cuotasEliminadas
      : c.cuotasPendientes;
  const tiempoMeses = p.cuotasEliminadas || p.tiempoRecuperado || Math.max(0, cuotasPendientesCoherentes - p.nuevoPlazo);
  const tiempoRecuperado =
    tiempoMeses >= 12
      ? `${Math.floor(tiempoMeses / 12)} años`
      : `${tiempoMeses} meses`;

  return {
    id: m.expedienteId,
    cliente: { nombre: m.cliente, cc: m.cedula },
    banco: m.banco,
    producto: m.producto,
    modalidad: m.modalidad,
    estado: formatEstadoCaso(m.estadoCaso || m.estado || "—"),
    analista: m.analista?.nombre ?? "—",
    qaScore: m.qaScore ?? 0,
    nivelAutonomia: m.nivelAutonomia != null ? `N${m.nivelAutonomia}` : "N—",
    fecha: m.fecha && m.fecha !== "—"
      ? (() => {
          try {
            return new Date(m.fecha).toLocaleDateString("es-CO", {
              day: "numeric", month: "short", year: "numeric"
            });
          } catch { return m.fecha; }
        })()
      : "—",
    credito: {
      saldoActual: c.saldoCapital,
      cuotaActual: cuotaDisplay,
      cuotasPendientes: cuotasPendientesCoherentes,
      costoTotal,
      multiplicador,
    },
    propuesta: {
      nuevaCuota: p.nuevaCuota,
      nuevoPlazo: p.nuevoPlazo,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      ahorroIntereses: p.ahorroIntereses,
      ahorroSeguros: p.ahorroSeguros,
      tiempoRecuperado,
    },
    honorarios: {
      pactados: h.pactados,
      recalculados: h.honorarioRecalculado ?? h.pactados,
      variacion: (h.honorarioRecalculado ?? h.pactados) - h.pactados,
      estadoCobro: h.estadoCobro || "—",
      estadoPago: h.estadoPago || "—",
      pazYSalvo: h.pazYSalvo,
    },
    pipeline: buildPipeline(dto),
    intervinientes: dto.intervinientes.map((i) => ({
      rol: i.rol,
      nombre: i.nombre,
      correo: i.email,
    })),
    trazabilidad: dto.trazabilidad,
  };
}

export function CaseSnapshotButton({ expedienteId, clienteNombre }: Props) {
  const { roles } = useUserRole();
  const fetchData = useServerFn(getCaseSnapshotData);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [snapshot, setSnapshot] = useState<CaseSnapshotData | null>(null);
  const pendingExportRef = useRef(false);

  const snapshotContainerRef = useRef<HTMLDivElement>(null);
  const fileName = `NUVIA_CaseSnapshot_${(clienteNombre ?? snapshot?.cliente.nombre ?? "caso")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "")}_${expedienteId.slice(0, 8)}.pdf`;

  const { exportPDF, isExporting } = usePDFExport(snapshotContainerRef, { fileName });

  // Once snapshot data lands in the DOM, capture & export.
  useEffect(() => {
    if (!snapshot || !pendingExportRef.current) return;
    pendingExportRef.current = false;
    // Two RAFs to ensure layout + fonts settle before html2canvas snapshots.
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          await exportPDF();
          setState("done");
          setTimeout(() => setState("idle"), 2500);
        } catch (err) {
          console.error("[CaseSnapshot] export error", err);
          setState("error");
          setTimeout(() => setState("idle"), 3000);
        }
      });
    });
  }, [snapshot, exportPDF]);

  const visible = roles.some((r) => ROLES_PERMITIDOS.includes(r));
  if (!visible) return null;

  async function handle() {
    if (state === "loading" || isExporting) return;
    setState("loading");
    try {
      const dto = await fetchData({ data: { expedienteId } });
      pendingExportRef.current = true;
      setSnapshot(dtoToSnapshot(dto));
    } catch (err) {
      console.error("[CaseSnapshot] fetch error", err);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const busy = state === "loading" || isExporting;
  const label = busy
    ? "Generando…"
    : state === "done"
      ? "Descargado"
      : state === "error"
        ? "Reintentar"
        : "Case Snapshot";
  const Icon = busy ? Loader2 : state === "done" ? Check : FileDown;

  return (
    <>
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        title="Descargar resumen ejecutivo del caso en PDF"
        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-70"
        style={{
          background:
            state === "done"
              ? "linear-gradient(135deg, rgba(132,185,143,0.25), rgba(132,185,143,0.12))"
              : "linear-gradient(135deg, #4F69B8 0%, #445DA3 100%)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06) inset, 0 8px 22px -10px rgba(68,93,163,0.85)",
        }}
      >
        <Icon size={14} className={busy ? "animate-spin" : ""} />
        {label}
      </button>

      {/* Render fuera de pantalla — html2canvas no captura display:none */}
      {snapshot && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: -10000,
            opacity: 1,
            pointerEvents: "none",
            zIndex: -50,
            // Mantener layout real para que html2canvas mida correctamente
          }}
        >
          <CaseSnapshotPDF ref={snapshotContainerRef} expediente={snapshot} />
        </div>
      )}
    </>
  );
}
