import { NCard, SectionHeader } from "@/components/nuvia";
import { Gavel, CheckCircle2, AlertTriangle, XCircle, Minus, FileText, Calculator, Sparkles, Brain, Lightbulb } from "lucide-react";
import type { Veredicto, VeredictoEstado, VeredictoFila, VeredictoHallazgo } from "@/lib/qaMath";

const TONO: Record<VeredictoEstado, { color: string; bg: string; label: string }> = {
  ok:      { color: "var(--nuvia-success)", bg: "rgba(34,197,94,0.10)",  label: "OK" },
  warning: { color: "var(--nuvia-warning)", bg: "rgba(234,179,8,0.10)",  label: "Revisar" },
  error:   { color: "var(--nuvia-danger)",  bg: "rgba(239,68,68,0.10)",  label: "Error" },
  neutral: { color: "var(--nuvia-text-secondary)", bg: "rgba(255,255,255,0.04)", label: "—" },
};

const ICONO_FUENTE: Record<VeredictoFila["fuente"], React.ReactNode> = {
  extracto:  <FileText size={14} />,
  excel:     <Calculator size={14} />,
  simulador: <Sparkles size={14} />,
  auditoria: <Brain size={14} />,
};

function EstadoIcono({ estado }: { estado: VeredictoEstado }) {
  if (estado === "ok") return <CheckCircle2 size={16} style={{ color: TONO.ok.color }} />;
  if (estado === "warning") return <AlertTriangle size={16} style={{ color: TONO.warning.color }} />;
  if (estado === "error") return <XCircle size={16} style={{ color: TONO.error.color }} />;
  return <Minus size={16} style={{ color: TONO.neutral.color }} />;
}

export function VeredictoBlock({ veredicto }: { veredicto: Veredicto | null | undefined }) {
  if (!veredicto) return null;

  const errLabel = veredicto.extractoTieneErrores === "no"
    ? "No — el extracto reconcilia internamente."
    : veredicto.extractoTieneErrores === "inconsistencia"
      ? "Inconsistencia matemática (no necesariamente un error contable)."
      : "Sí — hay un dato que no cuadra y debe validarse con el banco.";

  const errColor = veredicto.extractoTieneErrores === "no"
    ? TONO.ok.color
    : veredicto.extractoTieneErrores === "inconsistencia"
      ? TONO.warning.color
      : TONO.error.color;

  return (
    <NCard padding="none">
      <div style={{ padding: "16px 20px 12px" }}>
        <SectionHeader
          title="Veredicto NUVIA"
          description="Resumen automático de quién tiene la razón bajo la matemática financiera."
          icon={<Gavel size={16} />}
        />
      </div>

      {/* Titular */}
      <div style={{ padding: "0 20px 12px" }}>
        <p className="text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
          {veredicto.titular}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--nuvia-text-secondary)" }}>
          {veredicto.resumen}
        </p>

        {veredicto.plazoImplicito !== undefined && veredicto.plazoReportado !== undefined && (
          <div className="flex gap-3 mt-3 flex-wrap text-xs">
            <span
              className="px-2.5 py-1 rounded"
              style={{ background: "rgba(59,130,246,0.10)", color: "var(--nuvia-text-primary)", border: "1px solid var(--nuvia-border)" }}
            >
              Plazo reportado: <strong>{veredicto.plazoReportado}</strong> meses
            </span>
            <span
              className="px-2.5 py-1 rounded"
              style={{ background: "rgba(234,179,8,0.10)", color: "var(--nuvia-text-primary)", border: "1px solid var(--nuvia-border)" }}
            >
              Plazo implícito por cuota: <strong>{veredicto.plazoImplicito}</strong> meses
            </span>
            {veredicto.desfasePlazo !== undefined && Math.abs(veredicto.desfasePlazo) > 0 && (
              <span
                className="px-2.5 py-1 rounded"
                style={{
                  background: Math.abs(veredicto.desfasePlazo) > 30 ? "rgba(239,68,68,0.10)" : "rgba(234,179,8,0.10)",
                  color: "var(--nuvia-text-primary)",
                  border: "1px solid var(--nuvia-border)",
                }}
              >
                Desfase: <strong>{veredicto.desfasePlazo > 0 ? "+" : ""}{veredicto.desfasePlazo}</strong> meses
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabla de responsables */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              {["Fuente", "Estado", "Veredicto"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2 font-medium"
                  style={{ color: "var(--nuvia-text-secondary)", borderTop: "1px solid var(--nuvia-border)", borderBottom: "1px solid var(--nuvia-border)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {veredicto.filas.map((f) => {
              const tono = TONO[f.estado];
              return (
                <tr key={f.fuente} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--nuvia-text-primary)" }}>
                    <div className="flex items-center gap-2 font-medium">
                      {ICONO_FUENTE[f.fuente]}
                      {f.titulo}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top" style={{ color: tono.color }}>
                    <div className="flex items-center gap-1.5">
                      <EstadoIcono estado={f.estado} />
                      <span className="font-semibold uppercase tracking-wider text-[11px]">{tono.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--nuvia-text-secondary)" }}>
                    {f.detalle}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ¿El extracto tiene errores? */}
      <div style={{ padding: "16px 20px 0" }}>
        <p className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
          ¿El extracto tiene errores?
        </p>
        <p className="text-sm mt-1 font-medium" style={{ color: errColor }}>{errLabel}</p>

        {veredicto.causasProbables.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wider mt-4" style={{ color: "var(--nuvia-text-secondary)" }}>
              Causas probables
            </p>
            <ul className="mt-1 space-y-1.5">
              {veredicto.causasProbables.map((c, i) => (
                <li key={i} className="text-sm flex gap-2" style={{ color: "var(--nuvia-text-primary)" }}>
                  <span style={{ color: "var(--nuvia-warning)" }}>•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Recomendaciones */}
      {veredicto.recomendaciones.length > 0 && (
        <div style={{ padding: "16px 20px 20px" }}>
          <p className="text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--nuvia-text-secondary)" }}>
            <Lightbulb size={12} /> Recomendaciones al analista
          </p>
          <ul className="mt-1 space-y-1.5">
            {veredicto.recomendaciones.map((r, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: "var(--nuvia-text-primary)" }}>
                <span style={{ color: "var(--nuvia-accent)" }}>→</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </NCard>
  );
}
