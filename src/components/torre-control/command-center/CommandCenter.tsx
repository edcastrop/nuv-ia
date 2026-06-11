/**
 * NUVIA Command Center — UI con tabs.
 * Tokens NUVIA, glass-card, sin superficies blancas.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Target, Trophy,
  Lightbulb, AlertTriangle, LineChart as LineIcon, Bot, Plus, Loader2,
  ArrowRight, Wallet, Users, Clock, FileX,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listGoals, upsertGoal, deleteGoal, getHealthScore, getScoreboard,
  getTopOpportunities, getRiskGroups, getForecast, askCopilot, getCopilotSuggestions,
  type MonthlyGoal, type GoalTipo, type GoalNivel,
  type HealthScorePayload, type ScoreboardPayload,
  type CopilotRecommendation,
} from "@/lib/commandCenter.functions";

const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(v || 0);

const fmtNum = (v: number) => new Intl.NumberFormat("es-CO").format(Math.round(v || 0));

const HEALTH_COLORS: Record<HealthScorePayload["estado"], string> = {
  excelente: "var(--nuvia-success)",
  saludable: "var(--nuvia-success)",
  atencion: "var(--nuvia-warning)",
  riesgo: "var(--nuvia-warning)",
  critico: "var(--nuvia-danger)",
};

const HEALTH_LABEL: Record<HealthScorePayload["estado"], string> = {
  excelente: "Excelente",
  saludable: "Saludable",
  atencion: "Atención",
  riesgo: "Riesgo",
  critico: "Crítico",
};

// ============================================================
// HEALTH SCORE GAUGE
// ============================================================
export function HealthScoreGauge() {
  const fetch = useServerFn(getHealthScore);
  const q = useQuery({
    queryKey: ["cc", "health"],
    queryFn: () => fetch({} as any),
    staleTime: 5 * 60_000,
  });
  const hs = q.data;
  const score = hs?.score ?? 0;
  const color = hs ? HEALTH_COLORS[hs.estado] : "var(--nuvia-text-muted)";
  const dash = (score / 100) * 251.2;
  return (
    <div
      className="glass-card rounded-2xl p-5 flex items-center gap-5"
      style={{ border: "1px solid var(--nuvia-border)" }}
    >
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
            stroke="var(--nuvia-bg-secondary)" />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8"
            stroke={color} strokeDasharray={`${dash} 251.2`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            {q.isLoading ? "…" : Math.round(score)}
          </span>
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>
            /100
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
          Health Score NUVEX
        </div>
        <div className="text-base font-semibold mt-0.5" style={{ color }}>
          {hs ? HEALTH_LABEL[hs.estado] : "—"}
        </div>
        {hs?.fresh && (
          <div className="text-[11px] mt-1" style={{ color: "var(--nuvia-text-muted)" }}>
            Actualizado: {hs.fecha}
          </div>
        )}
        {!hs?.fresh && q.isFetched && (
          <div className="text-[11px] mt-1" style={{ color: "var(--nuvia-text-muted)" }}>
            Sin snapshot diario aún. El cron corre 03:00 COL.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// METAS TAB
// ============================================================
const TIPO_LABEL: Record<GoalTipo, string> = {
  honorarios: "Honorarios",
  ahorro: "Ahorro generado",
  casos_cerrados: "Casos cerrados",
  conversion: "Conversión",
  cartera_recuperada: "Cartera recuperada",
};

const TIPOS: GoalTipo[] = ["honorarios", "ahorro", "casos_cerrados", "conversion", "cartera_recuperada"];
const NIVELES: GoalNivel[] = ["empresa", "area", "persona"];
const AREAS_DISPONIBLES = ["comercial", "analisis", "juridica", "operaciones", "cartera"];

export function GoalsTab({ canEdit }: { canEdit: boolean }) {
  const fetchGoals = useServerFn(listGoals);
  const upsert = useServerFn(upsertGoal);
  const del = useServerFn(deleteGoal);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cc", "goals"],
    queryFn: () => fetchGoals({ data: {} } as any),
    staleTime: 5 * 60_000,
  });
  const [editing, setEditing] = useState<Partial<MonthlyGoal> | null>(null);

  const upsertM = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cc", "goals"] });
      setEditing(null);
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc", "goals"] }),
  });

  const goals = q.data?.goals ?? [];
  const byNivel = useMemo(() => {
    const out: Record<GoalNivel, MonthlyGoal[]> = { empresa: [], area: [], persona: [] };
    for (const g of goals) out[g.nivel].push(g);
    return out;
  }, [goals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            Metas del mes
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--nuvia-text-muted)" }}>
            Jerarquía: Empresa → Área → Persona. Periodo: {q.data?.periodo ?? "—"}
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                periodo: q.data?.periodo ?? new Date().toISOString().slice(0, 8) + "01",
                nivel: "empresa",
                tipo: "honorarios",
                valor_meta: 0,
                unidad: "COP",
              })
            }
            style={{
              background: "var(--nuvia-gradient-primary)",
              color: "var(--nuvia-text-on-accent)",
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nueva meta
          </Button>
        )}
      </div>

      {q.isLoading && (
        <div className="text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Cargando metas…</div>
      )}

      {!q.isLoading && goals.length === 0 && (
        <EmptyState
          icon={<Target className="w-10 h-10" />}
          title="Aún no hay metas configuradas"
          subtitle={
            canEdit
              ? "Crea tu primera meta del mes para empezar a medir cumplimiento."
              : "La gerencia aún no ha definido metas para este periodo."
          }
        />
      )}

      {(["empresa", "area", "persona"] as GoalNivel[]).map(
        (nivel) =>
          byNivel[nivel].length > 0 && (
            <section key={nivel}>
              <h4
                className="text-xs uppercase tracking-wider mb-3"
                style={{ color: "var(--nuvia-text-muted)" }}
              >
                {nivel === "empresa" ? "Empresa" : nivel === "area" ? "Por área" : "Por persona"}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {byNivel[nivel].map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    canEdit={canEdit}
                    onEdit={() => setEditing(g)}
                    onDelete={() => deleteM.mutate(g.id)}
                  />
                ))}
              </div>
            </section>
          ),
      )}

      <GoalDialog
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) => upsertM.mutate(payload)}
        saving={upsertM.isPending}
      />
    </div>
  );
}

function GoalCard({
  goal, canEdit, onEdit, onDelete,
}: {
  goal: MonthlyGoal; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const cumplimiento = goal.cumplimiento_pct ?? 0;
  const deltaColor =
    cumplimiento >= 95
      ? "var(--nuvia-success)"
      : cumplimiento >= 70
        ? "var(--nuvia-warning)"
        : "var(--nuvia-danger)";
  const fmt = goal.unidad === "COP" ? fmtCOP : (n: number) => `${fmtNum(n)} ${goal.unidad}`;

  return (
    <div
      className="glass-card rounded-2xl p-4 flex flex-col gap-3"
      style={{ border: "1px solid var(--nuvia-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
            {TIPO_LABEL[goal.tipo]}
          </div>
          <div className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--nuvia-text-primary)" }}>
            {goal.nivel === "empresa"
              ? "Empresa"
              : goal.nivel === "area"
                ? `Área · ${goal.area}`
                : `Persona · ${goal.responsable_nombre ?? "—"}`}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button" onClick={onEdit}
              className="text-[11px] px-2 py-1 rounded hover:[background:var(--nuvia-bg-secondary)]"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >Editar</button>
            <button
              type="button" onClick={onDelete}
              className="text-[11px] px-2 py-1 rounded hover:[background:var(--nuvia-bg-secondary)]"
              style={{ color: "var(--nuvia-danger)" }}
            >Borrar</button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            {fmt(goal.valor_real ?? 0)}
          </span>
          <span className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>
            / {fmt(goal.valor_meta)}
          </span>
        </div>
        <Progress value={Math.min(100, cumplimiento)} className="h-1.5" />
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: deltaColor }}>{cumplimiento}% cumplimiento</span>
          {goal.proyectado && goal.proyectado > 0 && (
            <span style={{ color: "var(--nuvia-text-muted)" }}>
              Proy: {fmt(goal.proyectado)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalDialog({
  open, initial, onClose, onSave, saving,
}: {
  open: boolean;
  initial: Partial<MonthlyGoal> | null;
  onClose: () => void;
  onSave: (payload: any) => void;
  saving: boolean;
}) {
  const [tipo, setTipo] = useState<GoalTipo>("honorarios");
  const [nivel, setNivel] = useState<GoalNivel>("empresa");
  const [area, setArea] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [unidad, setUnidad] = useState<string>("COP");
  const [notas, setNotas] = useState<string>("");

  // Reset when opening
  useMemo(() => {
    if (initial) {
      setTipo((initial.tipo as GoalTipo) ?? "honorarios");
      setNivel((initial.nivel as GoalNivel) ?? "empresa");
      setArea(initial.area ?? "");
      setValor(String(initial.valor_meta ?? ""));
      setUnidad(initial.unidad ?? "COP");
      setNotas(initial.notas ?? "");
    }
  }, [initial]);

  if (!initial) return null;
  const valid = Number(valor) >= 0 && (nivel === "empresa" || area.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Editar meta" : "Nueva meta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nivel</Label>
            <Select value={nivel} onValueChange={(v) => setNivel(v as GoalNivel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVELES.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {nivel !== "empresa" && (
            <div>
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger><SelectValue placeholder="Selecciona área" /></SelectTrigger>
                <SelectContent>
                  {AREAS_DISPONIBLES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {nivel === "persona" && (
                <p className="text-[11px] mt-1" style={{ color: "var(--nuvia-text-muted)" }}>
                  Vinculación a un responsable específico se completa desde Administración.
                </p>
              )}
            </div>
          )}
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as GoalTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Valor meta</Label>
              <Input
                type="number" min={0} value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div>
              <Label>Unidad</Label>
              <Input value={unidad} onChange={(e) => setUnidad(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                id: initial.id,
                periodo: initial.periodo ?? new Date().toISOString().slice(0, 8) + "01",
                nivel,
                area: nivel === "empresa" ? null : area,
                tipo,
                valor_meta: Number(valor),
                unidad,
                notas: notas || null,
              })
            }
            style={{
              background: "var(--nuvia-gradient-primary)",
              color: "var(--nuvia-text-on-accent)",
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SCOREBOARD TAB
// ============================================================
export function ScoreboardTab() {
  const fetch = useServerFn(getScoreboard);
  const [area, setArea] = useState("comercial");
  const q = useQuery({
    queryKey: ["cc", "scoreboard", area],
    queryFn: () => fetch({ data: { area } } as any),
    staleTime: 5 * 60_000,
  });
  const s = q.data as ScoreboardPayload | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            Scoreboard
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--nuvia-text-muted)" }}>
            {s?.viewMode === "nominal"
              ? "Vista directiva (ranking nominal)"
              : "Vista anonimizada — solo tu posición y comparativos"}
          </p>
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AREAS_DISPONIBLES.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading && (
        <div className="text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Cargando ranking…</div>
      )}

      {!q.isLoading && (!s || s.entries.length === 0) && (
        <EmptyState
          icon={<Trophy className="w-10 h-10" />}
          title="Sin snapshot disponible"
          subtitle="El snapshot diario se materializa a las 03:00 hora Colombia."
        />
      )}

      {s?.viewMode === "anonimo" && s.yourPosition && (
        <div
          className="glass-card rounded-2xl p-5"
          style={{ border: "1px solid var(--nuvia-border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
                Tu posición · {s.area}
              </div>
              <div className="text-2xl font-semibold mt-1" style={{ color: "var(--nuvia-text-primary)" }}>
                #{s.yourPosition.rank} <span className="text-sm font-normal" style={{ color: "var(--nuvia-text-muted)" }}>de {s.yourPosition.total}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                Top {100 - s.yourPosition.percentil}% · Score {s.yourPosition.score}
                {s.yourPosition.promedio_area != null && ` · Promedio área: ${s.yourPosition.promedio_area}`}
              </div>
            </div>
            <TendenciaPill v={s.yourPosition.tendencia} />
          </div>
        </div>
      )}

      {s?.viewMode === "nominal" && (
        <div
          className="glass-card rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--nuvia-border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                {["#", "Colaborador", "Score", "Percentil", "Tendencia"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-[11px] uppercase tracking-wider"
                    style={{ color: "var(--nuvia-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.entries.map((e) => (
                <tr key={e.usuario_id} className="hover:[background:var(--nuvia-bg-secondary)]">
                  <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{e.rank}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>{e.display_name}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>{e.score}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{e.percentil}</td>
                  <td className="px-4 py-2.5"><TendenciaPill v={e.tendencia} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s?.viewMode === "anonimo" && s.entries.length > 0 && (
        <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>
          {s.entries.length} colaboradores en el área. La política de NUVIA Command Center
          oculta los nombres de terceros a roles no directivos.
        </div>
      )}
    </div>
  );
}

function TendenciaPill({ v }: { v: "mejora" | "estable" | "deterioro" | null }) {
  if (!v) return <span className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>—</span>;
  const map = {
    mejora: { Icon: TrendingUp, color: "var(--nuvia-success)", text: "Mejora" },
    estable: { Icon: Minus, color: "var(--nuvia-text-muted)", text: "Estable" },
    deterioro: { Icon: TrendingDown, color: "var(--nuvia-danger)", text: "Deterioro" },
  } as const;
  const { Icon, color, text } = map[v];
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color }}>
      <Icon className="w-3.5 h-3.5" /> {text}
    </span>
  );
}

// ============================================================
// OPORTUNIDADES
// ============================================================
export function OpportunitiesTab() {
  const fetch = useServerFn(getTopOpportunities);
  const q = useQuery({
    queryKey: ["cc", "opps"],
    queryFn: () => fetch({} as any),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <OppSection title="Mayor ahorro" rows={d.mayor_ahorro} valueKey="ahorro_potencial" />
      <OppSection title="Mayor honorario" rows={d.mayor_honorario} valueKey="honorario_potencial" />
      <OppSection
        title="Estancados de alto valor" rows={d.estancados_valor}
        valueKey="honorario_potencial" showDias
      />
    </div>
  );
}

function OppSection({
  title, rows, valueKey, showDias,
}: {
  title: string;
  rows: any[];
  valueKey: string;
  showDias?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-4" style={{ border: "1px solid var(--nuvia-border)" }}>
      <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--nuvia-text-primary)" }}>
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>Sin oportunidades en el periodo.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate" style={{ color: "var(--nuvia-text-primary)" }}>{r.cliente}</div>
                <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-muted)" }}>
                  {r.banco ?? "—"}{showDias && r.dias_estancado ? ` · ${r.dias_estancado}d sin movimiento` : ""}
                </div>
              </div>
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--nuvia-text-primary)" }}>
                {fmtCOP(r[valueKey])}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// RIESGOS
// ============================================================
export function RisksTab() {
  const fetch = useServerFn(getRiskGroups);
  const q = useQuery({
    queryKey: ["cc", "risks"],
    queryFn: () => fetch({} as any),
    staleTime: 60_000,
  });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RiskGroup
        icon={<Clock className="w-4 h-4" />}
        title={`Sin movimiento >15d (${d.sin_movimiento.length})`}
        rows={d.sin_movimiento.map((r) => ({
          primary: r.cliente, secondary: `${r.banco ?? "—"} · ${r.dias ?? "?"}d`,
        }))}
        sev="warning"
      />
      <RiskGroup
        icon={<Wallet className="w-4 h-4" />}
        title={`Cartera crítica >90d (${d.cartera_critica.length})`}
        rows={d.cartera_critica.map((r) => ({
          primary: `Caso ${r.expediente_id?.slice(0, 8) ?? "—"}`,
          secondary: fmtCOP(r.pendiente),
        }))}
        sev="danger"
      />
      <RiskGroup
        icon={<AlertTriangle className="w-4 h-4" />}
        title={`SLA vencidos (${d.sla_vencidos.length})`}
        rows={d.sla_vencidos.map((r) => ({
          primary: r.cliente, secondary: r.etapa ?? "—",
        }))}
        sev="danger"
      />
      <div className="glass-card rounded-2xl p-4 flex items-center gap-3"
        style={{ border: "1px solid var(--nuvia-border)" }}>
        <FileX className="w-5 h-5" style={{ color: "var(--nuvia-warning)" }} />
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
            Documentos pendientes
          </div>
          <div className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>
            {d.docs_incompletos_count} líneas de checklist sin completar
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskGroup({
  icon, title, rows, sev,
}: {
  icon: React.ReactNode;
  title: string;
  rows: { primary: string; secondary: string }[];
  sev: "warning" | "danger";
}) {
  const color = sev === "danger" ? "var(--nuvia-danger)" : "var(--nuvia-warning)";
  return (
    <div className="glass-card rounded-2xl p-4" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center gap-2 mb-3" style={{ color }}>
        {icon}
        <h4 className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
          {title}
        </h4>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>Sin alertas activas.</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 6).map((r, i) => (
            <li key={i} className="flex items-center justify-between text-sm gap-2">
              <span className="truncate" style={{ color: "var(--nuvia-text-primary)" }}>{r.primary}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--nuvia-text-muted)" }}>{r.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// FORECAST
// ============================================================
export function ForecastTab() {
  const fetch = useServerFn(getForecast);
  const q = useQuery({
    queryKey: ["cc", "forecast"],
    queryFn: () => fetch({} as any),
    staleTime: 5 * 60_000,
  });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  if (!d) return null;
  const fmt = (m: any) => (m.unidad === "COP" ? fmtCOP(m.real) : `${fmtNum(m.real)} ${m.unidad}`);
  const fmtP = (m: any) => (m.unidad === "COP" ? fmtCOP(m.proyectado) : `${fmtNum(m.proyectado)} ${m.unidad}`);
  return (
    <div className="space-y-4">
      {!d.fresh && (
        <div className="glass-card rounded-2xl p-4 text-xs"
          style={{ border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-muted)" }}>
          El forecast usa snapshots ejecutivos. Aún no se ha materializado el del día —
          se ejecuta automáticamente a las 03:00 hora Colombia.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {d.metricas.map((m) => (
          <div key={m.key} className="glass-card rounded-2xl p-4"
            style={{ border: "1px solid var(--nuvia-border)" }}>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
              {m.label}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <div className="text-lg font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                  {fmt(m)}
                </div>
                <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>Actual (MTD)</div>
              </div>
              <div className="text-right">
                <div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>{fmtP(m)}</div>
                <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>Proyectado fin de mes</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// COPILOT
// ============================================================
export function CopilotTab() {
  const ask = useServerFn(askCopilot);
  const sugg = useServerFn(getCopilotSuggestions);
  const sQ = useQuery({ queryKey: ["cc", "copilot-sug"], queryFn: () => sugg({} as any) });
  const [prompt, setPrompt] = useState("");
  const m = useMutation({ mutationFn: (p: string) => ask({ data: { prompt: p } }) });

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-3"
        style={{ border: "1px solid var(--nuvia-border)" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--nuvia-gradient-primary)" }}>
            <Bot className="w-5 h-5" style={{ color: "var(--nuvia-text-on-accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              NUVIA Copilot Ejecutivo
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--nuvia-text-muted)" }}>
              Director de operaciones virtual. Solo recomienda — la ejecución la hace un humano.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(sQ.data?.suggestions ?? []).map((s) => (
            <button key={s} type="button"
              onClick={() => { setPrompt(s); m.mutate(s); }}
              className="text-[11px] px-2.5 py-1.5 rounded-full hover:[background:var(--nuvia-bg-secondary)]"
              style={{ color: "var(--nuvia-text-secondary)", border: "1px solid var(--nuvia-border)" }}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="¿Qué debería hacer esta semana?"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && prompt.trim().length >= 3) m.mutate(prompt.trim());
            }}
          />
          <Button
            disabled={m.isPending || prompt.trim().length < 3}
            onClick={() => m.mutate(prompt.trim())}
            style={{
              background: "var(--nuvia-gradient-primary)",
              color: "var(--nuvia-text-on-accent)",
            }}
          >
            {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preguntar"}
          </Button>
        </div>
      </div>

      {m.isError && (
        <div className="glass-card rounded-2xl p-4 text-sm"
          style={{ border: "1px solid var(--nuvia-danger)", color: "var(--nuvia-text-primary)" }}>
          {(m.error as any)?.message ?? "El Copilot tuvo un problema. Reintenta."}
        </div>
      )}

      {m.data && (
        <div className="space-y-2">
          {m.data.recomendaciones.map((r) => <RecCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function RecCard({ r }: { r: CopilotRecommendation }) {
  const color =
    r.severidad === "danger" ? "var(--nuvia-danger)"
      : r.severidad === "warning" ? "var(--nuvia-warning)"
      : "var(--nuvia-text-secondary)";
  const tipoLabel = {
    reasignar: "Reasignar", contactar: "Contactar", acelerar: "Acelerar",
    cobrar: "Cobrar", revisar: "Revisar",
  }[r.tipo];
  return (
    <div className="glass-card rounded-2xl p-4 flex items-start gap-3"
      style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--nuvia-bg-secondary)", color }}>
        <Lightbulb className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color, border: `1px solid ${color}` }}>{tipoLabel}</span>
          <h5 className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            {r.titulo}
          </h5>
        </div>
        <p className="text-xs mt-1.5" style={{ color: "var(--nuvia-text-secondary)" }}>
          {r.narrativa}
        </p>
        <div className="flex items-center gap-3 mt-2">
          {r.impacto_estimado && (
            <span className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>
              Impacto: {r.impacto_estimado}
            </span>
          )}
          {r.cta_label && (
            <span className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: "var(--nuvia-text-secondary)" }}>
              {r.cta_label} <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Compartidos
// ============================================================
function EmptyState({
  icon, title, subtitle,
}: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="glass-card rounded-2xl p-10 text-center"
      style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="mx-auto w-fit mb-3" style={{ color: "var(--nuvia-text-muted)" }}>
        {icon}
      </div>
      <h4 className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{title}</h4>
      <p className="text-xs mt-1" style={{ color: "var(--nuvia-text-muted)" }}>{subtitle}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card rounded-2xl h-32 animate-pulse"
          style={{ border: "1px solid var(--nuvia-border)" }} />
      ))}
    </div>
  );
}

// ============================================================
// CONTENEDOR PRINCIPAL DE TABS
// ============================================================
export function CommandCenterTabs({
  resumenSlot, isExecutive,
}: { resumenSlot: React.ReactNode; isExecutive: boolean }) {
  return (
    <Tabs defaultValue="resumen" className="w-full">
      <TabsList
        className="flex flex-wrap gap-1 h-auto p-1"
        style={{ background: "var(--nuvia-bg-secondary)" }}
      >
        <TabsTrigger value="resumen"><LineIcon className="w-3.5 h-3.5 mr-1.5" />Resumen</TabsTrigger>
        <TabsTrigger value="metas"><Target className="w-3.5 h-3.5 mr-1.5" />Metas</TabsTrigger>
        <TabsTrigger value="scoreboard"><Trophy className="w-3.5 h-3.5 mr-1.5" />Scoreboard</TabsTrigger>
        <TabsTrigger value="oportunidades"><Sparkles className="w-3.5 h-3.5 mr-1.5" />Oportunidades</TabsTrigger>
        <TabsTrigger value="riesgos"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Riesgos</TabsTrigger>
        <TabsTrigger value="forecast"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Forecast</TabsTrigger>
        <TabsTrigger value="copilot"><Bot className="w-3.5 h-3.5 mr-1.5" />Copilot</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen" className="mt-4">{resumenSlot}</TabsContent>
      <TabsContent value="metas" className="mt-4"><GoalsTab canEdit={isExecutive} /></TabsContent>
      <TabsContent value="scoreboard" className="mt-4"><ScoreboardTab /></TabsContent>
      <TabsContent value="oportunidades" className="mt-4"><OpportunitiesTab /></TabsContent>
      <TabsContent value="riesgos" className="mt-4"><RisksTab /></TabsContent>
      <TabsContent value="forecast" className="mt-4"><ForecastTab /></TabsContent>
      <TabsContent value="copilot" className="mt-4"><CopilotTab /></TabsContent>
    </Tabs>
  );
}
