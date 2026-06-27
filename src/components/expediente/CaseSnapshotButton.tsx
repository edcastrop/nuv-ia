// Botón "Descargar Case Snapshot" — genera el PDF Executive Snapshot.
// Visible para roles operativos del caso. No modifica permisos existentes.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Loader2, Check } from "lucide-react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { getCaseSnapshotData } from "@/lib/caseSnapshot.functions";
// NOTA: `@/lib/caseSnapshotPdf` se importa dinámicamente dentro del handler
// para evitar que @react-pdf/renderer entre en el bundle de la ruta (causa OOM en build Nitro).

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

export function CaseSnapshotButton({ expedienteId, clienteNombre }: Props) {
  const { roles } = useUserRole();
  const fetchData = useServerFn(getCaseSnapshotData);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const visible = roles.some((r) => ROLES_PERMITIDOS.includes(r));
  if (!visible) return null;

  async function handle() {
    if (state === "loading") return;
    setState("loading");
    try {
      const dto = await fetchData({ data: { expedienteId } });
      const blob = await generarCaseSnapshotPdf(dto);
      descargarSnapshot(blob, clienteNombre ?? dto.meta.cliente);
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      console.error("[CaseSnapshot] error", err);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label =
    state === "loading" ? "Generando…"
    : state === "done" ? "Descargado"
    : state === "error" ? "Reintentar"
    : "Case Snapshot";

  const Icon =
    state === "loading" ? Loader2
    : state === "done" ? Check
    : FileDown;

  return (
    <button
      type="button"
      onClick={handle}
      disabled={state === "loading"}
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
      <Icon size={14} className={state === "loading" ? "animate-spin" : ""} />
      {label}
    </button>
  );
}
