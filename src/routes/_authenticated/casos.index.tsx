import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { listExpedientes, ESTADOS, type EstadoExpediente, type Expediente } from "@/lib/expedientes";
import { formatCOP } from "@/lib/format";
import { computeEtapaActual, getEtapaById, ETAPAS_PIPELINE, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { useAuth } from "@/hooks/useAuth";
import { QABadge } from "@/components/qa-ai/QABadge";
import {
  Search,
  Plus,
  FolderOpen,
  Wallet,
  Building2,
  Hash,
  Calendar,
  ArrowRight,
  MapPin,
  Phone,
  Globe,
  Sparkles,
  Flag,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  InsightCard,
} from "@/components/nuvia";


const ETAPA_IDS = ETAPAS_PIPELINE.map((e) => e.id) as [EtapaPipelineId, ...EtapaPipelineId[]];

const casosSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  estado: fallback(z.enum(["", ...ESTADOS]), "").default(""),
  etapa: fallback(z.enum(["", ...ETAPA_IDS]), "").default(""),
  mios: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/casos/")({
  validateSearch: zodValidator(casosSearchSchema),
  component: CasosPage,
  head: () => ({ meta: [{ title: "Expedientes · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const BG = "#050816";
const CARD = "#0A1628";
const CARD2 = "#071120";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT2 = "#94A3B8";

const ESTADO_THEME: Record<EstadoExpediente, { color: string; label: string }> = {
  SIMULADO: { color: "#445DA3", label: "Simulado" },
  FIRMADO: { color: "#9333EA", label: "Firmado" },
  ENVIADO_CONTRATACION: { color: "#6366F1", label: "Enviado a Contratación" },
  RADICADO: { color: "#F97316", label: "Radicado" },
  APROBADO: { color: "#84B98F", label: "Aprobado" },
  CONDICIONES_APLICADAS: { color: "#16A34A", label: "Condiciones aplicadas" },
  FACTURADO: { color: "#D4A017", label: "Facturado" },
  PAGADO: { color: "#1F7A45", label: "Pagado" },
};

const AVATAR_COLORS = ["#445DA3", "#84B98F", "#9333EA", "#F97316", "#D4A017", "#0EA5E9", "#EC4899"];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// SLA por etapa (días) — alineado con AlertasEstancamientoPanel.
const UMBRAL_DIAS_ETAPA: Record<EtapaPipelineId, number> = {
  lead: 3,
  extracto: 3,
  proyeccion: 5,
  presentacion: 5,
  cierre: 7,
  contratacion: 7,
  radicacion: 5,
  banco: 21,
  resultado_banco: 5,
  aceptacion_cliente: 5,
  informe: 5,
  cuenta: 5,
  pago: 10,
  comision: 10,
  paz_salvo: 5,
  finalizado: 0,
};

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

type SlaNivel = "ok" | "atencion" | "critico" | "neutral";

function slaNivel(dias: number, umbral: number): SlaNivel {
  if (umbral <= 0) return "neutral";
  if (dias >= umbral * 1.5) return "critico";
  if (dias >= umbral) return "atencion";
  return "ok";
}

const SLA_COLORS: Record<SlaNivel, { bg: string; fg: string; border: string }> = {
  ok:       { bg: "rgba(132,185,143,0.10)", fg: "#84B98F", border: "rgba(132,185,143,0.35)" },
  atencion: { bg: "rgba(245,158,11,0.10)",  fg: "#F59E0B", border: "rgba(245,158,11,0.40)" },
  critico:  { bg: "rgba(244,63,94,0.12)",   fg: "#FB7185", border: "rgba(244,63,94,0.45)" },
  neutral:  { bg: "rgba(148,163,184,0.10)", fg: "#94A3B8", border: "rgba(148,163,184,0.30)" },
};

function CasosPage() {
  type CasosSearch = z.infer<typeof casosSearchSchema>;
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/casos" });
  const { user } = useAuth();
  const { q: search, estado, etapa, mios } = urlSearch;
  const [qLocal, setQLocal] = useState(search);
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Debounce text input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (qLocal !== search) {
        navigate({ search: (prev: CasosSearch) => ({ ...prev, q: qLocal }), replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qLocal, search, navigate]);

  const setEstado = (v: EstadoExpediente | "") =>
    navigate({ search: (prev: CasosSearch) => ({ ...prev, estado: v }), replace: true });
  const setEtapa = (v: EtapaPipelineId | "") =>
    navigate({ search: (prev: CasosSearch) => ({ ...prev, etapa: v }), replace: true });
  const setMios = (v: boolean) =>
    navigate({ search: (prev: CasosSearch) => ({ ...prev, mios: v }), replace: true });

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listExpedientes({ search, estado, etapa })
      .then((r) => { if (!cancel) setRows(r); })
      .catch((e) => { if (!cancel) setErr(e.message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [search, estado, etapa]);

  // P26 — Filtro client-side "Mis casos" (asesor_id === user.id).
  const filteredRows = useMemo(() => {
    if (!mios || !user?.id) return rows;
    return rows.filter((r) => r.asesor_id === user.id);
  }, [rows, mios, user?.id]);

  // P26 — Detección de duplicados por cédula entre los expedientes cargados.
  const dupCedulas = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const c = (r.cedula ?? "").trim();
      if (!c) return;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    const s = new Set<string>();
    counts.forEach((n, c) => { if (n > 1) s.add(c); });
    return s;
  }, [rows]);

  const totals = useMemo(() => ({
    total: filteredRows.length,
    honorarios: filteredRows.reduce((s, r) => s + Number(r.honorarios_final || 0), 0),
  }), [filteredRows]);

  // P21 — Exportar CSV de los casos visibles (respeta búsqueda, estado y etapa).
  const exportarCSV = () => {
    const headers = ["Cliente", "Cédula", "Banco", "Crédito", "Modo", "Estado", "Etapa", "Días", "Honorarios", "Actualizado"];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    filteredRows.forEach((r) => {
      const etId = computeEtapaActual({ estado_caso: r.estado_caso ?? null });
      const et = getEtapaById(etId);
      lines.push([
        esc(r.cliente_nombre),
        esc(r.cedula),
        esc(r.banco),
        esc(r.numero_credito),
        esc(r.modo),
        esc(ESTADO_THEME[r.estado]?.label ?? r.estado),
        esc(`E${et.numero} ${et.titulo}`),
        esc(diasDesde(r.updated_at)),
        esc(r.honorarios_final ?? 0),
        esc(r.updated_at?.slice(0, 10)),
      ].join(","));
    });
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Sparkles size={12} />, label: "Gestión de Casos", tone: "blue" }}
        title="Expedientes NUVEX"
        description="Administra, consulta y realiza seguimiento a cada simulación generada."
        actions={
          <>
            <button
              type="button"
              onClick={exportarCSV}
              disabled={loading || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                color: "#fff",
              }}
            >
              <ArrowRight size={14} className="-rotate-90" />
              Exportar CSV
            </button>
            <Link
              to="/inicio"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition"
              style={{
                background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                boxShadow: `0 8px 24px -8px ${AZUL}`,
              }}
            >
              <Plus size={14} />
              Nueva simulación
            </Link>
          </>
        }
      />

      <KpiGrid cols={2}>
        <KpiCard
          icon={<FolderOpen size={16} />}
          tone="blue"
          label="Expedientes activos"
          value={String(totals.total)}
          hint="Casos registrados"
        />
        <KpiCard
          icon={<Wallet size={16} />}
          tone="green"
          label="Honorarios proyectados"
          value={formatCOP(totals.honorarios)}
          hint="Pipeline acumulado"
        />
      </KpiGrid>

      <InsightCard scope="casos" />



        {/* FILTROS */}
        <section className="grid gap-4 md:grid-cols-[1fr_200px_200px]">
          <div
            className="relative rounded-2xl backdrop-blur-xl transition-all focus-within:border-[#445DA3]/60"
            style={{
              background: `linear-gradient(180deg, ${CARD}, ${CARD2})`,
              border: `1px solid ${BORDER}`,
              height: 60,
            }}
          >
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2" style={{ color: TEXT2 }} />
            <input
              type="text"
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              placeholder="Buscar cliente, cédula, banco o crédito..."
              className="w-full h-full bg-transparent pl-14 pr-5 text-sm outline-none placeholder:text-slate-500"
              style={{ color: "#fff" }}
            />
          </div>

          <div
            className="relative rounded-2xl backdrop-blur-xl"
            style={{
              background: `linear-gradient(180deg, ${CARD}, ${CARD2})`,
              border: `1px solid ${BORDER}`,
              height: 60,
            }}
          >
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoExpediente | "")}
              className="w-full h-full bg-transparent px-5 text-sm outline-none appearance-none cursor-pointer font-medium"
              style={{ color: "#fff" }}
            >
              <option value="" style={{ background: CARD }}>Todos los estados</option>
              {ESTADOS.map((s) => (
                <option key={s} value={s} style={{ background: CARD }}>{ESTADO_THEME[s].label}</option>
              ))}
            </select>
            <ArrowRight size={14} className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style={{ color: TEXT2 }} />
          </div>

          <div
            className="relative rounded-2xl backdrop-blur-xl"
            style={{
              background: `linear-gradient(180deg, ${CARD}, ${CARD2})`,
              border: `1px solid ${BORDER}`,
              height: 60,
            }}
          >
            <Flag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT2 }} />
            <select
              value={etapa}
              onChange={(e) => setEtapa(e.target.value as EtapaPipelineId | "")}
              className="w-full h-full bg-transparent pl-10 pr-8 text-sm outline-none appearance-none cursor-pointer font-medium"
              style={{ color: "#fff" }}
            >
              <option value="" style={{ background: CARD }}>Todas las etapas</option>
              {ETAPAS_PIPELINE.map((e) => (
                <option key={e.id} value={e.id} style={{ background: CARD }}>E{e.numero} · {e.titulo}</option>
              ))}
            </select>
            <ArrowRight size={14} className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style={{ color: TEXT2 }} />
          </div>
        </section>

        {/* P26 — Chip "Mis casos" */}
        <section className="flex flex-wrap items-center gap-2 -mt-1">
          <button
            type="button"
            onClick={() => setMios(!mios)}
            disabled={!user?.id}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: mios ? `linear-gradient(135deg, ${AZUL}, ${VERDE})` : "rgba(255,255,255,0.04)",
              color: mios ? "#fff" : TEXT2,
              border: `1px solid ${mios ? "transparent" : BORDER}`,
            }}
            title="Mostrar solo los expedientes asignados a mí"
          >
            <Sparkles size={12} /> Mis casos
          </button>
          {(search || estado || etapa || mios) && (
            <span className="text-[11px]" style={{ color: TEXT2 }}>
              {filteredRows.length} de {rows.length} expedientes
            </span>
          )}
        </section>

        {/* LISTADO */}
        <section className="space-y-3">
          {err && (
            <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(180,35,24,0.1)", border: "1px solid rgba(180,35,24,0.3)", color: "#FCA5A5" }}>
              {err}
            </div>
          )}
          {loading ? (
            <div className="py-24 text-center text-sm" style={{ color: TEXT2 }}>Cargando expedientes…</div>
          ) : filteredRows.length === 0 ? (
            <div
              className="py-20 text-center text-sm rounded-2xl"
              style={{ background: `linear-gradient(180deg, ${CARD}, ${CARD2})`, border: `1px solid ${BORDER}`, color: TEXT2 }}
            >
              No hay expedientes que coincidan.
              {!search && !estado && !mios && (
                <>
                  {" "}Crea tu primer caso desde el{" "}
                  <Link to="/inicio" className="font-semibold hover:underline" style={{ color: VERDE }}>simulador</Link>.
                </>
              )}
            </div>
          ) : (
            filteredRows.map((r) => (
              <ExpedienteCard
                key={r.id}
                r={r}
                isDup={!!r.cedula && dupCedulas.has(r.cedula.trim())}
              />
            ))
          )}
        </section>

        {/* FOOTER */}
        <footer className="pt-16">
          <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${AZUL}, ${VERDE}, transparent)` }} />
          <div
            className="mt-8 grid gap-6 md:grid-cols-4 rounded-2xl p-6 backdrop-blur-xl"
            style={{ background: `linear-gradient(180deg, ${CARD}, ${CARD2})`, border: `1px solid ${BORDER}` }}
          >
            <FooterBlock icon={<MapPin size={14} />} title="Bucaramanga" lines={["Carrera 16 #37-48", "Piso 4 · Centro"]} />
            <FooterBlock icon={<MapPin size={14} />} title="Bogotá" lines={["Calle 93 #18-28", "Oficina 704"]} />
            <FooterBlock icon={<Phone size={14} />} title="Contacto" lines={["+57 316 402 3779"]} />
            <FooterBlock icon={<Globe size={14} />} title="Web" lines={["www.nuvex.com.co"]} />
          </div>
          <div className="text-center text-[11px] mt-6 pb-2" style={{ color: TEXT2 }}>
            © {new Date().getFullYear()} NUVEX Finanzas Inteligentes · El ahorro no es un lujo, es un derecho.
          </div>
        </footer>
    </PageLayout>
  );
}


/* ===== Helpers ===== */



function ExpedienteCard({ r, isDup = false }: { r: Expediente; isDup?: boolean }) {
  const theme = ESTADO_THEME[r.estado];
  const aColor = avatarColor(r.cliente_nombre);
  const initial = (r.cliente_nombre || "?").trim().charAt(0).toUpperCase();

  const etapaId = computeEtapaActual({ estado_caso: r.estado_caso ?? null });
  const etapa = getEtapaById(etapaId);
  const umbral = UMBRAL_DIAS_ETAPA[etapaId] ?? 0;
  const dias = diasDesde(r.updated_at);
  const nivel = slaNivel(dias, umbral);
  const slaTheme = SLA_COLORS[nivel];
  const slaLabel =
    nivel === "critico"
      ? `${dias}d · SLA ${umbral}d`
      : nivel === "atencion"
        ? `${dias}d / ${umbral}d`
        : nivel === "ok"
          ? `${dias}d`
          : `${dias}d`;
  const SlaIcon = nivel === "critico" ? AlertTriangle : Clock;

  return (
    <Link
      to="/casos/$id"
      params={{ id: r.id }}
      className="group relative block overflow-hidden rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(180deg, ${CARD}, ${CARD2})`,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 4px 20px -8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Línea lateral por estado */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[20px]"
        style={{ background: `linear-gradient(180deg, ${theme.color}, ${theme.color}40)` }}
      />
      {/* Glow hover */}
      <span
        className="absolute -right-20 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-30 blur-3xl"
        style={{ background: theme.color }}
      />

      <div className="relative grid items-center gap-4" style={{ gridTemplateColumns: "auto 1fr auto auto auto" }}>
        {/* Avatar + nombre */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${aColor}, ${aColor}99)`,
              boxShadow: `0 4px 14px -4px ${aColor}80`,
            }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-base truncate" style={{ color: "#F1F5F9" }}>{r.cliente_nombre || "Sin nombre"}</div>
              {isDup && (
                <span
                  title="Esta cédula tiene más de un expediente activo"
                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.4)" }}
                >
                  Dup
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: TEXT2 }}>
              CC {r.cedula || "—"}
            </div>
          </div>
        </div>

        {/* Tags centrales */}
        <div className="hidden lg:flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{
              background: "rgba(68,93,163,0.10)",
              color: AZUL,
              border: `1px solid ${AZUL}40`,
            }}
            title={etapa.descripcion}
          >
            <Flag size={11} />
            E{etapa.numero} · {etapa.titulo}
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{ background: slaTheme.bg, color: slaTheme.fg, border: `1px solid ${slaTheme.border}` }}
            title={`Tiempo desde último cambio. SLA etapa: ${umbral} día(s).`}
          >
            <SlaIcon size={11} />
            {slaLabel}
          </span>
          <Tag icon={<Building2 size={11} />} text={r.banco || "Sin banco"} />
          <Tag icon={<Hash size={11} />} text={r.numero_credito || "—"} />
          <Tag icon={<Sparkles size={11} />} text={r.modo.toUpperCase()} accent={AZUL} />
          <Tag icon={<Calendar size={11} />} text={r.fecha_simulacion} />
        </div>

        {/* Honorarios */}
        <div className="text-right hidden md:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: TEXT2 }}>
            Honorarios
          </div>
          <div className="text-xl font-bold mt-0.5" style={{ color: VERDE }}>
            {formatCOP(Number(r.honorarios_final))}
          </div>
        </div>

        {/* Estado */}
        <div className="hidden sm:block">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: `${theme.color}1A`,
              color: theme.color,
              border: `1px solid ${theme.color}40`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.color }} />
            {r.estado}
          </span>
        </div>

        {/* CTA */}
        <div
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all group-hover:translate-x-0.5"
          style={{
            background: "rgba(132,185,143,0.08)",
            color: VERDE,
            border: `1px solid ${VERDE}33`,
          }}
        >
          Ver expediente
          <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
}

function Tag({ icon, text, accent }: { icon: React.ReactNode; text: string; accent?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.04)",
        color: accent ?? TEXT2,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ color: accent ?? TEXT2 }}>{icon}</span>
      {text}
    </span>
  );
}


function FooterBlock({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: VERDE }}>
        {icon}
        {title}
      </div>
      <div className="space-y-1 text-sm" style={{ color: TEXT2 }}>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
