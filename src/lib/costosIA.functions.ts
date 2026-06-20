import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Catálogo de módulos que consumen IA en NUVIA.
 * Tokens promedio estimados por llamada (input/output) y tarifa por 1M tokens
 * según Lovable AI Gateway · google/gemini-3-flash-preview (USD).
 *
 * NOTA: el Motor de Extractos (Davivienda / Bancolombia) NO consume IA: usa
 * parsers regex locales. Se reporta como "Sin IA" para claridad.
 */
export type CostoModulo = {
  key: string;
  label: string;
  descripcion: string;
  tokensInProm: number;
  tokensOutProm: number;
  usaIA: boolean;
};

const PRECIO_IN_USD_POR_M = 0.075;   // gemini-3-flash-preview input
const PRECIO_OUT_USD_POR_M = 0.30;   // gemini-3-flash-preview output
const TASA_COP_POR_USD = 4100;

export const CATALOGO_COSTOS: CostoModulo[] = [
  { key: "nuvia_chat",        label: "NUVIA IA · Chat",          descripcion: "Consultas al copiloto operativo", tokensInProm: 1500, tokensOutProm: 500,  usaIA: true },
  { key: "qa_copilot",        label: "QA Copilot",                descripcion: "Auditoría inteligente de casos",   tokensInProm: 2500, tokensOutProm: 700,  usaIA: true },
  { key: "treasury_copilot",  label: "Treasury Copilot",          descripcion: "Análisis de tesorería / cartera",  tokensInProm: 1800, tokensOutProm: 500,  usaIA: true },
  { key: "pipeline_nuvia",    label: "Pipeline NUVIA",            descripcion: "Recomendaciones de pipeline 14",   tokensInProm: 2000, tokensOutProm: 600,  usaIA: true },
  { key: "executive_copilot", label: "Executive Copilot",         descripcion: "Insights ejecutivos · gerencia",   tokensInProm: 3000, tokensOutProm: 800,  usaIA: true },
  { key: "extractos",         label: "Lectura de Extractos",      descripcion: "Motor regex local (Davivienda / Bancolombia)", tokensInProm: 0, tokensOutProm: 0, usaIA: false },
];

function costoUnitarioUSD(m: CostoModulo): number {
  if (!m.usaIA) return 0;
  return (m.tokensInProm * PRECIO_IN_USD_POR_M + m.tokensOutProm * PRECIO_OUT_USD_POR_M) / 1_000_000;
}

export type FilaCostoIA = {
  key: string;
  label: string;
  descripcion: string;
  usaIA: boolean;
  usos_mes: number;
  usos_total: number;
  tokensInProm: number;
  tokensOutProm: number;
  costo_unitario_usd: number;
  costo_unitario_cop: number;
  costo_mes_usd: number;
  costo_mes_cop: number;
  costo_total_usd: number;
  costo_total_cop: number;
};

export type ReporteCostosIA = {
  fechaCorte: string;
  mesActual: string;
  tasaCopUsd: number;
  precioInUsdM: number;
  precioOutUsdM: number;
  modelo: string;
  filas: FilaCostoIA[];
  totales: {
    usos_mes: number;
    usos_total: number;
    costo_mes_usd: number;
    costo_mes_cop: number;
    costo_total_usd: number;
    costo_total_cop: number;
  };
  porMes: Array<{ mes: string; costo_usd: number; costo_cop: number; usos: number }>;
};

export const getReporteCostosIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReporteCostosIA> => {
    const { supabase, userId } = context;

    // Solo super admin / admin / gerencia
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles: string[] = ((rolesData ?? []) as Array<{ role: string }>).map((r) => r.role);
    if (!roles.some((r) => ["super_admin", "admin", "gerencia"].includes(r))) {
      throw new Error("Acceso restringido");
    }

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Helpers para contar
    const contar = async (table: string, filtro?: { col: string; op: "eq"; val: string }) => {
      let q = supabase.from(table as never).select("*", { count: "exact", head: true });
      if (filtro) q = (q as { eq: (a: string, b: string) => typeof q }).eq(filtro.col, filtro.val);
      const { count } = await q;
      return count ?? 0;
    };
    const contarMes = async (table: string, col = "created_at") => {
      const { count } = await supabase
        .from(table as never)
        .select("*", { count: "exact", head: true })
        .gte(col, inicioMes);
      return count ?? 0;
    };

    // Conteos por módulo
    const [
      nuviaTotal, nuviaMes,
      qaTotal, qaMes,
      execTotal, execMes,
      extTotal, extMes,
    ] = await Promise.all([
      contar("nuvex_ia_log"),
      contarMes("nuvex_ia_log"),
      contar("qa_auditorias"),
      contarMes("qa_auditorias"),
      contar("executive_copilot_log"),
      contarMes("executive_copilot_log"),
      contar("extractos_lecturas"),
      contarMes("extractos_lecturas"),
    ]);

    // Treasury y pipeline no tienen tabla de log dedicada — los reportamos en 0
    // hasta implementar trackeo. Quedan visibles en la tabla con tarifa unitaria.
    const usosPorKey: Record<string, { mes: number; total: number }> = {
      nuvia_chat: { mes: nuviaMes, total: nuviaTotal },
      qa_copilot: { mes: qaMes, total: qaTotal },
      executive_copilot: { mes: execMes, total: execTotal },
      treasury_copilot: { mes: 0, total: 0 },
      pipeline_nuvia: { mes: 0, total: 0 },
      extractos: { mes: extMes, total: extTotal },
    };

    const filas: FilaCostoIA[] = CATALOGO_COSTOS.map((m) => {
      const usos = usosPorKey[m.key] ?? { mes: 0, total: 0 };
      const cuUsd = costoUnitarioUSD(m);
      const cuCop = cuUsd * TASA_COP_POR_USD;
      return {
        key: m.key,
        label: m.label,
        descripcion: m.descripcion,
        usaIA: m.usaIA,
        usos_mes: usos.mes,
        usos_total: usos.total,
        tokensInProm: m.tokensInProm,
        tokensOutProm: m.tokensOutProm,
        costo_unitario_usd: cuUsd,
        costo_unitario_cop: cuCop,
        costo_mes_usd: cuUsd * usos.mes,
        costo_mes_cop: cuCop * usos.mes,
        costo_total_usd: cuUsd * usos.total,
        costo_total_cop: cuCop * usos.total,
      };
    });

    const totales = filas.reduce(
      (acc, f) => ({
        usos_mes: acc.usos_mes + f.usos_mes,
        usos_total: acc.usos_total + f.usos_total,
        costo_mes_usd: acc.costo_mes_usd + f.costo_mes_usd,
        costo_mes_cop: acc.costo_mes_cop + f.costo_mes_cop,
        costo_total_usd: acc.costo_total_usd + f.costo_total_usd,
        costo_total_cop: acc.costo_total_cop + f.costo_total_cop,
      }),
      { usos_mes: 0, usos_total: 0, costo_mes_usd: 0, costo_mes_cop: 0, costo_total_usd: 0, costo_total_cop: 0 },
    );

    // Serie histórica por mes (últimos 6) — usa nuvex_ia_log + qa_auditorias + executive_copilot_log
    const seisMesesAtras = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    const [{ data: nuviaSerie }, { data: qaSerie }, { data: execSerie }] = await Promise.all([
      supabase.from("nuvex_ia_log").select("created_at").gte("created_at", seisMesesAtras),
      supabase.from("qa_auditorias").select("created_at").gte("created_at", seisMesesAtras),
      supabase.from("executive_copilot_log").select("created_at").gte("created_at", seisMesesAtras),
    ]);

    const cuNuvia = costoUnitarioUSD(CATALOGO_COSTOS.find((m) => m.key === "nuvia_chat")!);
    const cuQa = costoUnitarioUSD(CATALOGO_COSTOS.find((m) => m.key === "qa_copilot")!);
    const cuExec = costoUnitarioUSD(CATALOGO_COSTOS.find((m) => m.key === "executive_copilot")!);

    const porMesMap = new Map<string, { usos: number; costo_usd: number }>();
    const addSerie = (rows: Array<{ created_at: string }> | null, cu: number) => {
      (rows ?? []).forEach((r) => {
        const d = new Date(r.created_at);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const cur = porMesMap.get(mes) ?? { usos: 0, costo_usd: 0 };
        cur.usos += 1;
        cur.costo_usd += cu;
        porMesMap.set(mes, cur);
      });
    };
    addSerie(nuviaSerie, cuNuvia);
    addSerie(qaSerie, cuQa);
    addSerie(execSerie, cuExec);

    const porMes = Array.from(porMesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, usos: v.usos, costo_usd: v.costo_usd, costo_cop: v.costo_usd * TASA_COP_POR_USD }));

    return {
      fechaCorte: now.toISOString(),
      mesActual,
      tasaCopUsd: TASA_COP_POR_USD,
      precioInUsdM: PRECIO_IN_USD_POR_M,
      precioOutUsdM: PRECIO_OUT_USD_POR_M,
      modelo: "google/gemini-3-flash-preview",
      filas,
      totales,
      porMes,
    };
  });
