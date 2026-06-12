import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLayout, ExecutiveHero, KpiGrid, KpiCard, NCard, SectionHeader } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { obtenerAuditoriaQA } from "@/lib/qaAI.functions";
import { Brain, Gauge, ArrowLeft, AlertTriangle, CheckCircle2, Coins, Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/$id")({
  component: ResultadoQaAi,
  head: () => ({ meta: [{ title: "Resultado auditoría · QA AI" }] }),
});

type Inc = {
  id: string; tipo: string; severidad: string; campo: string | null;
  valor_extracto: number | null; valor_calculado: number | null; diferencia: number | null;
  mensaje: string; sugerencia: string | null;
};

const dictamenLabel: Record<string, string> = {
  aprobado: "APROBADO", aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN", rechazado: "RECHAZADO",
};

const fmt = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

function ResultadoQaAi() {
  const { id } = Route.useParams();
  const fetchAud = useServerFn(obtenerAuditoriaQA);
  const [data, setData] = useState<{ auditoria: Record<string, unknown> | null; inconsistencias: Inc[] } | null>(null);

  useEffect(() => { (async () => setData(await fetchAud({ data: { id } })))(); }, [id, fetchAud]);

  if (!data?.auditoria) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando dictamen…</p></NCard></PageLayout>;
  }
  const a = data.auditoria as Record<string, unknown> & {
    qa_score: number; categoria: string; dictamen: string; modalidad: string;
    motor_version: string; ejecutado_at: string; outputs: Record<string, number | unknown[]>;
  };
  const o = (a.outputs ?? {}) as Record<string, number | unknown[]>;
  const score = Number(a.qa_score);
  const scoreColor = score >= 95 ? "var(--nuvia-success)" : score >= 85 ? "var(--nuvia-warning)" : "var(--nuvia-danger)";
  const dictColor = a.dictamen === "aprobado" ? "var(--nuvia-success)"
    : a.dictamen === "aprobado_obs" ? "var(--nuvia-warning)"
    : a.dictamen === "requiere_revision" ? "var(--nuvia-warning)" : "var(--nuvia-danger)";

  const sevTone = (s: string) => s === "critica" ? "var(--nuvia-danger)" : s === "warning" ? "var(--nuvia-warning)" : "var(--nuvia-text-secondary)";

  const primeras = (o.primerasCuotas as Array<{ k: number; cuota: number; interes: number; capital: number; saldo: number }>) ?? [];
  const ultimas = (o.ultimasCuotas as Array<{ k: number; cuota: number; interes: number; capital: number; saldo: number }>) ?? [];

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Brain size={12} />, label: `Motor v${a.motor_version}`, tone: "blue" }}
        title={`Dictamen: ${dictamenLabel[a.dictamen] ?? a.dictamen}`}
        description={`Modalidad ${a.modalidad} · ejecutado ${new Date(a.ejecutado_at).toLocaleString("es-CO")}`}
        actions={
          <Link to="/qa-ai">
            <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}>
              <ArrowLeft size={14} /> Volver
            </button>
          </Link>
        }
      />

      <NCard>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>QA Score</p>
            <p className="text-5xl font-bold tabular-nums" style={{ color: scoreColor }}>{score.toFixed(1)}<span className="text-lg opacity-50"> / 100</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>Categoría</p>
            <p className="text-2xl font-semibold uppercase" style={{ color: scoreColor }}>{a.categoria}</p>
            <p className="text-xs mt-1" style={{ color: dictColor }}>{dictamenLabel[a.dictamen] ?? a.dictamen}</p>
          </div>
        </div>
      </NCard>

      <KpiGrid cols={4}>
        <KpiCard label="Cuota teórica" value={`$${fmt(o.cuotaTeorica as number, 0)}`} icon={<Calculator size={14} />} tone="blue" />
        <KpiCard label="Cuota total c/seguros" value={`$${fmt(o.cuotaTotalConSeguros as number, 0)}`} icon={<Coins size={14} />} tone="blue" />
        <KpiCard label="Beneficio FRECH/mes" value={`$${fmt(o.beneficioMensualFrech as number, 0)}`} icon={<Gauge size={14} />} tone="green" />
        <KpiCard label="Veces pagado" value={(o.vecesPagado as number ?? 0).toFixed(2)} icon={<Gauge size={14} />} tone="warning" />
      </KpiGrid>
      <KpiGrid cols={2}>
        <KpiCard label="Costo total proyectado" value={`$${fmt(o.costoTotal as number, 0)}`} icon={<Coins size={14} />} tone="blue" />
        <KpiCard label="Total intereses" value={`$${fmt(o.totalIntereses as number, 0)}`} icon={<Coins size={14} />} tone="warning" />
      </KpiGrid>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader title={`Inconsistencias (${data.inconsistencias.length})`} description="Hallazgos detectados por el motor matemático." />
        </div>
        {data.inconsistencias.length === 0 ? (
          <div className="px-5 pb-5 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
            <CheckCircle2 size={16} /> Sin inconsistencias matemáticas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Tipo", "Sev.", "Campo", "Extracto", "Calculado", "Δ", "Mensaje"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.inconsistencias.map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <td className="px-4 py-2 capitalize" style={{ color: "var(--nuvia-text-primary)" }}>{i.tipo}</td>
                    <td className="px-4 py-2 font-semibold uppercase" style={{ color: sevTone(i.severidad) }}>
                      <span className="inline-flex items-center gap-1">{i.severidad === "critica" && <AlertTriangle size={12} />} {i.severidad}</span>
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--nuvia-text-secondary)" }}>{i.campo ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{fmt(i.valor_extracto, 2)}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{fmt(i.valor_calculado, 2)}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: sevTone(i.severidad) }}>{fmt(i.diferencia, 2)}</td>
                    <td className="px-4 py-2" style={{ color: "var(--nuvia-text-primary)" }}>
                      {i.mensaje}
                      {i.sugerencia && <div className="text-[11px] mt-0.5" style={{ color: "var(--nuvia-text-secondary)" }}>{i.sugerencia}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader title="Reconstrucción matemática" description="Primeras 12 + últimas 12 cuotas del plan amortizado." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["#", "Cuota", "Interés", "Capital", "Saldo"].map((h) => (
                  <th key={h} className="text-right px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...primeras, ...(ultimas.length > 12 ? ultimas : [])].map((f, idx) => (
                <tr key={`${f.k}-${idx}`} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{f.k}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>${fmt(f.cuota, 0)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.interes, 0)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.capital, 0)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.saldo, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NCard>
    </PageLayout>
  );
}
