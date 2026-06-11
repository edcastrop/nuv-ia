import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, AlertTriangle, TrendingUp, Target, RefreshCw } from "lucide-react";
import { getNuviaInsight, type InsightScope } from "@/lib/nuviaInsight.functions";

/**
 * NUVIA · InsightCard (Fase 7.6.1B)
 *
 * Tarjeta premium con UNA recomendación generada por NUVIA IA real.
 * No mocks, no hardcode.
 *
 *   <InsightCard scope="dashboard" />
 */
interface InsightCardProps {
  scope: InsightScope;
}

export function InsightCard({ scope }: InsightCardProps) {
  const fn = useServerFn(getNuviaInsight);
  const query = useQuery({
    queryKey: ["nuvia-insight", scope],
    queryFn: () => fn({ data: { scope } }),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const data = query.data;
  const loading = query.isLoading;
  const error = query.isError;

  return (
    <section
      className="relative overflow-hidden rounded-[20px]"
      style={{
        background:
          "linear-gradient(135deg, rgba(68,93,163,0.18) 0%, rgba(132,185,143,0.10) 100%), var(--nuvia-bg-tertiary)",
        border: "1px solid var(--nuvia-border-strong)",
        boxShadow: "var(--nuvia-shadow-md)",
        padding: "var(--nuvia-space-5)",
      }}
    >
      {/* Borde superior gradient */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, #445DA3, #84B98F, transparent)" }}
      />

      <header
        className="flex items-center justify-between gap-3"
        style={{ marginBottom: "var(--nuvia-space-4)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid place-items-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #445DA3, #84B98F)",
              boxShadow: "0 8px 24px -8px rgba(68,93,163,0.6)",
              color: "#fff",
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div
              className="font-semibold"
              style={{ fontSize: "var(--nuvia-text-h3)", color: "var(--nuvia-text-primary)" }}
            >
              NUVIA IA · Recomendación ejecutiva
            </div>
            <div
              style={{
                fontSize: "var(--nuvia-text-caption)",
                color: "var(--nuvia-text-secondary)",
              }}
            >
              {data?.cached
                ? "Insight cacheado · 1h"
                : data?.generatedAt
                  ? `Generado ${new Date(data.generatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`
                  : "Analizando operación…"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="rounded-lg p-2 transition disabled:opacity-50"
          style={{
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-secondary)",
            background: "rgba(255,255,255,0.03)",
          }}
          title="Regenerar insight"
        >
          <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
        </button>
      </header>

      {loading ? (
        <div
          className="text-sm"
          style={{ color: "var(--nuvia-text-secondary)", padding: "var(--nuvia-space-4) 0" }}
        >
          Analizando datos operativos…
        </div>
      ) : error ? (
        <div
          style={{
            fontSize: "var(--nuvia-text-caption)",
            color: "var(--nuvia-danger)",
            padding: "var(--nuvia-space-3) 0",
          }}
        >
          No fue posible generar el insight en este momento.
        </div>
      ) : data?.state === "empty" ? (
        <div
          className="rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed var(--nuvia-border)",
            padding: "var(--nuvia-space-4)",
            fontSize: "var(--nuvia-text-body)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          {data.reason ?? "Sin suficientes datos históricos para generar recomendaciones."}
        </div>
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Block
            icon={<AlertTriangle size={14} />}
            tone="danger"
            label="Riesgo"
            text={data.riesgo ?? ""}
          />
          <Block
            icon={<TrendingUp size={14} />}
            tone="success"
            label="Oportunidad"
            text={data.oportunidad ?? ""}
          />
          <Block
            icon={<Target size={14} />}
            tone="info"
            label="Acción recomendada"
            text={data.accion ?? ""}
          />
        </div>
      ) : null}
    </section>
  );
}

function Block({
  icon,
  tone,
  label,
  text,
}: {
  icon: React.ReactNode;
  tone: "danger" | "success" | "info";
  label: string;
  text: string;
}) {
  const color =
    tone === "danger"
      ? "var(--nuvia-danger)"
      : tone === "success"
        ? "var(--nuvia-success)"
        : "var(--nuvia-accent-blue)";
  return (
    <div
      className="rounded-xl"
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid var(--nuvia-border)",
        padding: "var(--nuvia-space-4)",
      }}
    >
      <div
        className="flex items-center gap-2 uppercase font-bold"
        style={{
          color,
          fontSize: "var(--nuvia-text-badge)",
          letterSpacing: "0.14em",
          marginBottom: "var(--nuvia-space-2)",
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--nuvia-text-body)",
          lineHeight: "var(--nuvia-leading-body)",
          color: "var(--nuvia-text-primary)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
