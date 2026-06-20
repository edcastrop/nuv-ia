import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cpu, ArrowLeft, Download, FileText, AlertCircle } from "lucide-react";
import { PageLayout, ExecutiveHero, NCard } from "@/components/nuvia";
import { useUserRole } from "@/hooks/useUserRole";
import { getReporteCostosIA, type ReporteCostosIA } from "@/lib/costosIA.functions";

export const Route = createFileRoute("/_authenticated/super-admin/costos-ia")({
  component: CostosIAView,
  head: () => ({ meta: [{ title: "Costos internos de IA · NUVEX" }] }),
});

function CostosIAView() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [data, setData] = useState<ReporteCostosIA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rolesLoading) return;
    if (!isSuperAdmin) { setLoading(false); return; }
    (async () => {
      try {
        const r = await getReporteCostosIA();
        setData(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar reporte");
      } finally {
        setLoading(false);
      }
    })();
  }, [rolesLoading, isSuperAdmin]);

  if (rolesLoading) {
    return (
      <PageLayout>
        <div className="p-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

  const fmtCOP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  const fmtUSD = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
  const fmtUSDcoarse = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtNum = (n: number) => new Intl.NumberFormat("es-CO").format(n);

  const exportarCSV = () => {
    if (!data) return;
    const header = ["Módulo", "Usa IA", "Usos mes", "Usos total", "Tokens in", "Tokens out", "Costo unit USD", "Costo unit COP", "Costo mes USD", "Costo mes COP", "Costo total USD", "Costo total COP"];
    const rows = data.filas.map((f) => [
      f.label,
      f.usaIA ? "Sí" : "No",
      f.usos_mes, f.usos_total,
      f.tokensInProm, f.tokensOutProm,
      f.costo_unitario_usd.toFixed(6), Math.round(f.costo_unitario_cop),
      f.costo_mes_usd.toFixed(4), Math.round(f.costo_mes_cop),
      f.costo_total_usd.toFixed(4), Math.round(f.costo_total_cop),
    ]);
    rows.push(["TOTAL", "", data.totales.usos_mes, data.totales.usos_total, "", "", "", "",
      data.totales.costo_mes_usd.toFixed(4), Math.round(data.totales.costo_mes_cop),
      data.totales.costo_total_usd.toFixed(4), Math.round(data.totales.costo_total_cop)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `costos-ia-nuvia-${data.mesActual}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => window.print();

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Cpu size={12} />, label: "Costos internos IA", tone: "blue" }}
        title="Costos internos de IA"
        description={`Modelo · ${data?.modelo ?? "google/gemini-3-flash-preview"}  ·  Tarifa USD/1M tokens · in ${data?.precioInUsdM ?? "—"} / out ${data?.precioOutUsdM ?? "—"}  ·  TRM referencial ${data?.tasaCopUsd ?? "—"}`}
        actions={
          <div className="flex flex-wrap gap-2 text-xs print:hidden">
            <Link
              to="/super-admin"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}
            >
              <ArrowLeft size={12} /> Volver
            </Link>
            <button
              onClick={exportarCSV}
              disabled={!data}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium"
              style={{ background: "var(--nuvia-accent-green)", color: "#0b1a14", border: "1px solid var(--nuvia-border)" }}
            >
              <Download size={12} /> Exportar Excel/CSV
            </button>
            <button
              onClick={exportarPDF}
              disabled={!data}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}
            >
              <FileText size={12} /> Imprimir / PDF
            </button>
          </div>
        }
      />

      {loading && <NCard><div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Calculando consumo…</div></NCard>}
      {error && <NCard><div className="text-sm" style={{ color: "var(--nuvia-danger)" }}>{error}</div></NCard>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label={`Usos este mes (${data.mesActual})`} value={fmtNum(data.totales.usos_mes)} />
            <Kpi label="Costo este mes" value={fmtCOP(data.totales.costo_mes_cop)} sub={fmtUSDcoarse(data.totales.costo_mes_usd)} accent="green" />
            <Kpi label="Usos histórico total" value={fmtNum(data.totales.usos_total)} />
            <Kpi label="Costo histórico total" value={fmtCOP(data.totales.costo_total_cop)} sub={fmtUSDcoarse(data.totales.costo_total_usd)} accent="blue" />
          </div>

          <NCard>
            <h3 className="mb-3 text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              Desglose por módulo
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
                    <th className="text-left py-2" style={{ color: "var(--nuvia-text-secondary)" }}>Módulo</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Usos mes</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Usos total</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Tokens in/out</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Costo unit.</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Costo mes</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f) => (
                    <tr key={f.key} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                      <td className="py-2" style={{ color: "var(--nuvia-text-primary)" }}>
                        <div className="font-semibold">{f.label}</div>
                        <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>
                          {f.descripcion}
                          {!f.usaIA && (
                            <span
                              className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{ background: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-secondary)" }}
                            >
                              Sin IA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right" style={{ color: "var(--nuvia-text-primary)" }}>{fmtNum(f.usos_mes)}</td>
                      <td className="text-right" style={{ color: "var(--nuvia-text-primary)" }}>{fmtNum(f.usos_total)}</td>
                      <td className="text-right text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {f.usaIA ? `${fmtNum(f.tokensInProm)} / ${fmtNum(f.tokensOutProm)}` : "—"}
                      </td>
                      <td className="text-right text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {f.usaIA ? (
                          <>
                            {fmtUSD(f.costo_unitario_usd)}
                            <div style={{ color: "var(--nuvia-text-muted)" }}>{fmtCOP(f.costo_unitario_cop)}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="text-right font-semibold" style={{ color: "var(--nuvia-accent-green)" }}>
                        {f.usaIA ? fmtCOP(f.costo_mes_cop) : "—"}
                      </td>
                      <td className="text-right font-semibold" style={{ color: "var(--nuvia-accent-blue)" }}>
                        {f.usaIA ? fmtCOP(f.costo_total_cop) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid var(--nuvia-border)" }}>
                    <td className="py-2 font-bold" style={{ color: "var(--nuvia-text-primary)" }}>TOTAL</td>
                    <td className="text-right font-bold" style={{ color: "var(--nuvia-text-primary)" }}>{fmtNum(data.totales.usos_mes)}</td>
                    <td className="text-right font-bold" style={{ color: "var(--nuvia-text-primary)" }}>{fmtNum(data.totales.usos_total)}</td>
                    <td></td>
                    <td></td>
                    <td className="text-right font-bold" style={{ color: "var(--nuvia-accent-green)" }}>{fmtCOP(data.totales.costo_mes_cop)}</td>
                    <td className="text-right font-bold" style={{ color: "var(--nuvia-accent-blue)" }}>{fmtCOP(data.totales.costo_total_cop)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </NCard>

          {data.porMes.length > 0 && (
            <NCard>
              <h3 className="mb-3 text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                Tendencia mensual (últimos 6 meses · módulos con log)
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
                    <th className="text-left py-2" style={{ color: "var(--nuvia-text-secondary)" }}>Mes</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Usos</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Costo USD</th>
                    <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Costo COP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porMes.map((m) => (
                    <tr key={m.mes} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                      <td className="py-2" style={{ color: "var(--nuvia-text-primary)" }}>{m.mes}</td>
                      <td className="text-right" style={{ color: "var(--nuvia-text-primary)" }}>{fmtNum(m.usos)}</td>
                      <td className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>{fmtUSDcoarse(m.costo_usd)}</td>
                      <td className="text-right font-semibold" style={{ color: "var(--nuvia-accent-green)" }}>{fmtCOP(m.costo_cop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </NCard>
          )}

          <NCard>
            <div className="flex items-start gap-2 text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
              <AlertCircle size={14} style={{ color: "var(--nuvia-accent-blue)", marginTop: 2 }} />
              <div className="space-y-1">
                <div>
                  <strong style={{ color: "var(--nuvia-text-primary)" }}>Metodología:</strong> El costo se estima multiplicando el número de
                  llamadas registradas por el costo unitario de cada módulo. El costo unitario se calcula con tokens promedio
                  (input/output) por tipo de llamada y la tarifa pública de Lovable AI Gateway para <em>{data.modelo}</em>
                  (input {fmtUSD(data.precioInUsdM / 1_000_000 * 1_000_000)} / 1M, output {fmtUSD(data.precioOutUsdM / 1_000_000 * 1_000_000)} / 1M).
                  Conversión a COP usando TRM referencial de {fmtNum(data.tasaCopUsd)}.
                </div>
                <div>
                  <strong style={{ color: "var(--nuvia-text-primary)" }}>Lectura de Extractos:</strong> el motor de Davivienda y Bancolombia
                  opera con parsers regex 100% locales — <em>no consume IA</em>, por lo tanto su costo de IA es $0. Se muestra solo para
                  control de volumen ({fmtNum(data.filas.find((f) => f.key === "extractos")?.usos_total ?? 0)} lecturas históricas).
                </div>
                <div>
                  <strong style={{ color: "var(--nuvia-text-primary)" }}>Treasury / Pipeline NUVIA:</strong> aún no escriben en log dedicado.
                  Mostramos la tarifa unitaria estimada; el conteo se activará cuando se conecten al log central.
                </div>
              </div>
            </div>
          </NCard>
        </>
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </PageLayout>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "green" | "blue" }) {
  const valueColor =
    accent === "green" ? "var(--nuvia-accent-green)" :
    accent === "blue" ? "var(--nuvia-accent-blue)" :
    "var(--nuvia-text-primary)";
  return (
    <NCard>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: valueColor }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>{sub}</div>}
    </NCard>
  );
}
