import { useEffect, useMemo, useState } from "react";
import { GitCompare, ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";
import { getCanalDeAuditoria, enviarMensaje } from "@/lib/colaboracion";
import { useUserRole, isDirectorQA } from "@/hooks/useUserRole";

type Modo = "pesos" | "uvr";

type AuditorInputs = {
  saldoCapital?: number;
  tasaEa?: number;
  seguros?: number;
  cuotaBase?: number;
  cuotasPendientes?: number;
  nuevaCuota?: number | null;
  saldoUVR?: number;
  valorUVR?: number;
  variacionUVR?: number;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtN = (n: number, d = 0) =>
  n === 0 ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n: number, d = 4) => (n === 0 ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: d })}%`);
const pctDelta = (a: number, b: number) => (a === 0 ? 0 : ((b - a) / Math.abs(a)) * 100);

/**
 * V2 QA: Comparativa en vivo entre los inputs del analista (snapshot en
 * `auditoria.inputs.reconstruccion`) y los inputs que el auditor está
 * modificando dentro del simulador embebido (sandbox `qa-review-<id>`).
 * Escucha el evento `nuvex:simulador-inputs` que emiten Pesos/UVRSimulator.
 */
export function ComparativaAnalistaAuditor({
  auditoriaId,
  sandboxExpedienteId,
  modo,
  analista,
  cliente,
  banco,
}: {
  auditoriaId: string;
  sandboxExpedienteId: string;
  modo: Modo;
  analista: Record<string, unknown>;
  cliente: string;
  banco: string;
}) {
  const { roles } = useUserRole();
  const puedePublicar = isDirectorQA(roles);
  const [auditor, setAuditor] = useState<AuditorInputs | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as (AuditorInputs & { expedienteId?: string }) | undefined;
      if (!detail || detail.expedienteId !== sandboxExpedienteId) return;
      setAuditor({
        saldoCapital: detail.saldoCapital,
        tasaEa: detail.tasaEa,
        seguros: detail.seguros,
        cuotaBase: detail.cuotaBase,
        cuotasPendientes: detail.cuotasPendientes,
        nuevaCuota: detail.nuevaCuota ?? null,
        saldoUVR: detail.saldoUVR,
        valorUVR: detail.valorUVR,
        variacionUVR: detail.variacionUVR,
      });
    };
    window.addEventListener("nuvex:simulador-inputs", handler);
    return () => window.removeEventListener("nuvex:simulador-inputs", handler);
  }, [sandboxExpedienteId]);

  const rows = useMemo(() => {
    const base: Array<{ label: string; a: number; b: number; kind: "money" | "pct" | "int" }> = [
      { label: "Saldo capital", a: num(analista.saldoCapital), b: num(auditor?.saldoCapital), kind: "money" },
      { label: "Tasa EA", a: num(analista.tasaEa), b: num(auditor?.tasaEa), kind: "pct" },
      { label: "Seguros", a: num(analista.seguros), b: num(auditor?.seguros), kind: "money" },
      { label: "Cuota base (sin subsidio)", a: num(analista.cuotaBaseSinSubsidio), b: num(auditor?.cuotaBase), kind: "money" },
      { label: "Cuotas pendientes", a: num(analista.cuotasPendientes), b: num(auditor?.cuotasPendientes), kind: "int" },
    ];
    if (modo === "uvr") {
      base.push(
        { label: "Saldo UVR", a: num(analista.saldoUVR), b: num(auditor?.saldoUVR), kind: "money" },
        { label: "Valor UVR", a: num(analista.valorUVR), b: num(auditor?.valorUVR), kind: "money" },
        { label: "Variación UVR EA", a: num(analista.variacionUvrEa), b: num(auditor?.variacionUVR), kind: "pct" },
      );
    }
    return base;
  }, [analista, auditor, modo]);

  const formato = (v: number, kind: "money" | "pct" | "int") =>
    kind === "pct" ? fmtPct(v) : kind === "int" ? String(v || "—") : fmtN(v);

  const colorDelta = (delta: number) => {
    const abs = Math.abs(delta);
    if (abs < 0.5) return "#9BD5A8"; // verde — coincide
    if (abs < 5) return "#F5C77E"; // ámbar — divergencia leve
    return "#FF8E8E"; // rojo — material
  };

  const handlePublicar = async () => {
    if (!puedePublicar || enviando) return;
    setEnviando(true);
    try {
      const canal = await getCanalDeAuditoria(
        auditoriaId,
        `${cliente || "Cliente"} · ${banco || "Banco"}`,
        [],
      );
      const lineas = [
        "📊 **Comparativa Analista vs Auditor**",
        `Cliente: ${cliente || "—"} · Banco: ${banco || "—"}`,
        "",
        ...rows.map((r) => {
          const d = pctDelta(r.a, r.b);
          const flag = Math.abs(d) >= 5 ? "🔴" : Math.abs(d) >= 0.5 ? "🟡" : "🟢";
          return `${flag} ${r.label}: ${formato(r.a, r.kind)} → ${formato(r.b, r.kind)} (${d >= 0 ? "+" : ""}${d.toFixed(2)}%)`;
        }),
      ];
      await enviarMensaje(canal.id, lineas.join("\n"), [], []);
      toast.success("Comparativa publicada en el hilo de la auditoría.");
    } catch (e) {
      toast.error(`No se pudo publicar: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div
          className="text-[10.5px] font-bold uppercase tracking-[0.16em] flex items-center gap-2"
          style={{ color: "var(--nuvia-text-muted)" }}
        >
          <GitCompare size={13} style={{ color: "#84B98F" }} />
          Comparativa Analista vs Auditor (en vivo)
        </div>
        {puedePublicar && auditor && (
          <button
            onClick={handlePublicar}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90"
            style={{
              background: "rgba(132,185,143,0.12)",
              color: "#9BD5A8",
              border: "1px solid rgba(132,185,143,0.35)",
              cursor: enviando ? "not-allowed" : "pointer",
              opacity: enviando ? 0.6 : 1,
            }}
          >
            <Send size={12} /> {enviando ? "Publicando…" : "Publicar comparativa"}
          </button>
        )}
      </div>

      {!auditor ? (
        <div
          className="px-3 py-3 rounded-lg text-[12px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed var(--nuvia-border)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          Modifica un campo del simulador embebido para empezar a comparar los inputs del auditor contra los del analista en tiempo real.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--nuvia-border)" }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--nuvia-text-muted)" }}>Campo</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--nuvia-text-muted)" }}>Analista</th>
                <th className="text-center px-2 py-2" style={{ color: "var(--nuvia-text-muted)" }}></th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--nuvia-text-muted)" }}>Auditor</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--nuvia-text-muted)" }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = pctDelta(r.a, r.b);
                const color = colorDelta(d);
                return (
                  <tr key={r.label} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td className="px-3 py-1.5" style={{ color: "var(--nuvia-text-secondary)" }}>{r.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                      {formato(r.a, r.kind)}
                    </td>
                    <td className="px-2 py-1.5 text-center" style={{ color: "var(--nuvia-text-muted)" }}>
                      <ArrowRight size={12} />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                      {formato(r.b, r.kind)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color }}>
                      {r.a === 0 && r.b === 0 ? "—" : `${d >= 0 ? "+" : ""}${d.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
              {auditor.nuevaCuota != null && (
                <tr style={{ borderTop: "1px solid var(--nuvia-border)", background: "rgba(132,185,143,0.04)" }}>
                  <td className="px-3 py-1.5 font-semibold" style={{ color: "#9BD5A8" }}>
                    Recomendada del auditor
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: "var(--nuvia-text-muted)" }}>—</td>
                  <td className="px-2 py-1.5 text-center" style={{ color: "var(--nuvia-text-muted)" }}>
                    <ArrowRight size={12} />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: "#9BD5A8" }} colSpan={2}>
                    {fmtN(num(auditor.nuevaCuota))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
