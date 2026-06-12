import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { NSelect } from "@/components/nuvia/NSelect";
import {
  listBancos,
  listExtractos,
  listMovimientos,
  ingestExtracto,
  runMatchEngine,
  confirmarMatch,
  asignarMatchManual,
  descartarMovimiento,
  buscarTargets,
} from "@/lib/treasury.functions";
import { UploadCloud, FileText, Brain, CheckCircle2, AlertTriangle, X, Search, Play, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/conciliacion")({
  component: ConciliacionPage,
  head: () => ({ meta: [{ title: "Conciliación IA · NUVIA Treasury AI" }] }),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function ConciliacionPage() {
  const bancosFn = useServerFn(listBancos);
  const extractosFn = useServerFn(listExtractos);
  const ingestFn = useServerFn(ingestExtracto);
  const matchFn = useServerFn(runMatchEngine);

  const { data: bancos, refetch: refetchBancos } = useQuery({ queryKey: ["tBancos"], queryFn: () => bancosFn() });
  const { data: extractos, refetch: refetchExt } = useQuery({ queryKey: ["tExt"], queryFn: () => extractosFn() });

  const [bancoId, setBancoId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openExt, setOpenExt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const onFile = (f: File) => setFile(f);

  async function handleSubmit() {
    if (!file) return setFeedback("Selecciona un archivo.");
    setUploading(true);
    setFeedback(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const formato = (["csv", "txt", "pdf", "xlsx"] as const).includes(ext as any) ? (ext as any) : null;
      if (!formato) throw new Error("Formato no soportado. Usa CSV, TXT o PDF.");
      let contenido_texto: string | undefined;
      let contenido_base64: string | undefined;
      if (formato === "csv" || formato === "txt") {
        contenido_texto = await file.text();
      } else if (formato === "pdf") {
        const buf = await file.arrayBuffer();
        contenido_base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      } else {
        throw new Error("XLSX no soportado en MVP. Conviértelo a CSV.");
      }
      const r = await ingestFn({
        data: {
          banco_id: bancoId || null,
          archivo_nombre: file.name,
          formato,
          contenido_texto,
          contenido_base64,
        },
      });
      setFeedback(`✓ Extracto cargado: ${r.total_movs} movimientos. Ejecutando motor...`);
      const m = await matchFn({ data: { extracto_id: r.extracto_id } });
      setFeedback(`✓ ${r.total_movs} movs · ${m.conciliados_auto} auto-conciliados · ${m.sugeridos} sugerencias.`);
      setFile(null);
      setOpenExt(r.extracto_id);
      refetchExt();
    } catch (e) {
      setFeedback("✗ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  const bancoOptions = useMemo(
    () => [{ value: "", label: "— Sin banco —" }, ...(bancos ?? []).map((b) => ({ value: b.id, label: b.nombre }))],
    [bancos],
  );

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Brain size={12} />, label: "Treasury AI · Conciliación", tone: "blue" }}
        title="Carga, parsea y concilia"
        description="Sube un extracto bancario (CSV / TXT / PDF). NUVIA lo cruza contra cartera y cuentas de cobro."
      />

      <NCard variant="elevated">
        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)_auto] items-end">
          <div>
            <label className="block mb-1 font-semibold uppercase" style={{ color: "var(--nuvia-text-secondary)", fontSize: 10, letterSpacing: "0.12em" }}>
              Banco origen
            </label>
            <NSelect value={bancoId} onValueChange={setBancoId} options={bancoOptions} placeholder="Selecciona banco" />
            {(!bancos || bancos.length === 0) && (
              <BancoQuickAdd onCreated={() => refetchBancos()} />
            )}
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            className="rounded-xl cursor-pointer transition flex items-center gap-3 px-4 py-4"
            style={{
              border: `1.5px dashed ${dragOver ? "#445DA3" : "var(--nuvia-border)"}`,
              background: dragOver ? "rgba(68,93,163,0.08)" : "rgba(255,255,255,0.02)",
            }}
          >
            <input
              type="file"
              accept=".csv,.txt,.pdf"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            {file ? (
              <>
                <FileText size={20} style={{ color: "#A5B5E0" }} />
                <div className="flex-1 min-w-0">
                  <div style={{ color: "var(--nuvia-text-primary)", fontSize: 13, fontWeight: 500 }} className="truncate">{file.name}</div>
                  <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button onClick={(e) => { e.preventDefault(); setFile(null); }} className="p-1 rounded hover:bg-white/5">
                  <X size={16} style={{ color: "var(--nuvia-text-secondary)" }} />
                </button>
              </>
            ) : (
              <>
                <UploadCloud size={22} style={{ color: "var(--nuvia-text-secondary)" }} />
                <div>
                  <div style={{ color: "var(--nuvia-text-primary)", fontSize: 13 }}>Arrastra o haz clic para subir extracto</div>
                  <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>CSV · TXT · PDF (máx 8 MB)</div>
                </div>
              </>
            )}
          </label>
          <button
            disabled={!file || uploading}
            onClick={handleSubmit}
            className="rounded-lg px-4 py-2 font-semibold text-white transition disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)", fontSize: 13 }}
          >
            <Play size={13} className="inline mr-1" />
            {uploading ? "Procesando..." : "Cargar y conciliar"}
          </button>
        </div>
        {feedback && (
          <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "rgba(68,93,163,0.10)", color: "var(--nuvia-text-primary)", fontSize: 12 }}>
            {feedback}
          </div>
        )}
      </NCard>

      {/* Lista de extractos + paneles */}
      <NCard variant="elevated">
        <h3 className="font-semibold mb-3" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
          Extractos cargados
        </h3>
        <div className="space-y-2">
          {(extractos ?? []).map((e) => (
            <div key={e.id}>
              <button
                onClick={() => setOpenExt(openExt === e.id ? null : e.id)}
                className="w-full rounded-lg px-3 py-2 flex items-center gap-3 transition"
                style={{
                  background: openExt === e.id ? "rgba(68,93,163,0.14)" : "rgba(255,255,255,0.02)",
                  border: "1px solid var(--nuvia-border)",
                }}
              >
                <ChevronDown size={14} style={{ color: "var(--nuvia-text-secondary)", transform: openExt === e.id ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                <FileText size={14} style={{ color: "#A5B5E0" }} />
                <div className="flex-1 text-left min-w-0">
                  <div style={{ color: "var(--nuvia-text-primary)", fontSize: 13 }} className="truncate">{e.archivo_nombre}</div>
                  <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>
                    {e.total_movs} movs · {e.formato.toUpperCase()} · {new Date(e.created_at).toLocaleString("es-CO")}
                  </div>
                </div>
                <span style={{ color: "#9BCB9F", fontSize: 12 }} className="tabular-nums">+{money(e.total_ingresos)}</span>
              </button>
              {openExt === e.id && <ExtractoDetail extractoId={e.id} onChange={() => refetchExt()} />}
            </div>
          ))}
          {(!extractos || extractos.length === 0) && (
            <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              Sin extractos. Sube el primero arriba.
            </div>
          )}
        </div>
      </NCard>
    </PageLayout>
  );
}

function BancoQuickAdd({ onCreated }: { onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del banco"
        className="nuvia-input nuvia-input-sm flex-1"
      />
      <button
        disabled={!nombre.trim() || busy}
        onClick={async () => {
          setBusy(true);
          const { upsertBanco } = await import("@/lib/treasury.functions");
          // dynamic import because useServerFn must be at top-level; this avoids hook order issues for inline action
          await (upsertBanco as any)({ data: { nombre: nombre.trim() } });
          setNombre("");
          setBusy(false);
          onCreated();
        }}
        className="rounded-md px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
        style={{ background: "#445DA3" }}
      >
        +
      </button>
    </div>
  );
}

function ExtractoDetail({ extractoId, onChange }: { extractoId: string; onChange: () => void }) {
  const movFn = useServerFn(listMovimientos);
  const confFn = useServerFn(confirmarMatch);
  const manFn = useServerFn(asignarMatchManual);
  const descFn = useServerFn(descartarMovimiento);
  const { data, refetch } = useQuery({
    queryKey: ["tMov", extractoId],
    queryFn: () => movFn({ data: { extracto_id: extractoId } }),
  });

  const movs = data?.movimientos ?? [];
  const cands = data?.candidatos ?? [];
  const candsByMov = useMemo(() => {
    const m = new Map<string, typeof cands>();
    for (const c of cands) {
      const arr = m.get(c.movimiento_id) ?? [];
      arr.push(c);
      m.set(c.movimiento_id, arr);
    }
    return m;
  }, [cands]);

  const conciliados = movs.filter((m) => m.estado_match === "conciliado");
  const sugeridos = movs.filter((m) => m.estado_match === "sugerido");
  const noIdent = movs.filter((m) => m.estado_match === "no_identificado");
  const sumConc = conciliados.reduce((a, b) => a + Number(b.valor), 0);
  const sumNo = noIdent.reduce((a, b) => a + Number(b.valor), 0);

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-3">
      {/* CONCILIADOS */}
      <PanelCol
        title="Conciliados"
        count={conciliados.length}
        sum={sumConc}
        icon={<CheckCircle2 size={14} />}
        tone="green"
      >
        {conciliados.map((m) => (
          <MovRow key={m.id} m={m} />
        ))}
      </PanelCol>

      {/* SUGERIDOS */}
      <PanelCol
        title="Sugeridos"
        count={sugeridos.length}
        sum={sugeridos.reduce((a, b) => a + Number(b.valor), 0)}
        icon={<Brain size={14} />}
        tone="warning"
      >
        {sugeridos.map((m) => (
          <MovRow
            key={m.id}
            m={m}
            candidatos={candsByMov.get(m.id) ?? []}
            onAccept={async (c) => {
              await confFn({ data: { movimiento_id: m.id, match_tipo: c.match_tipo as any, match_id: c.match_id } });
              refetch();
              onChange();
            }}
            onDiscard={async () => {
              await descFn({ data: { movimiento_id: m.id } });
              refetch();
            }}
          />
        ))}
      </PanelCol>

      {/* NO IDENTIFICADOS */}
      <PanelCol
        title="No identificados"
        count={noIdent.length}
        sum={sumNo}
        icon={<AlertTriangle size={14} />}
        tone="danger"
      >
        {noIdent.map((m) => (
          <MovRow
            key={m.id}
            m={m}
            allowManual
            onAssignManual={async (tipo, id) => {
              await manFn({ data: { movimiento_id: m.id, match_tipo: tipo as any, match_id: id, aprender: true } });
              refetch();
              onChange();
            }}
            onDiscard={async () => {
              await descFn({ data: { movimiento_id: m.id } });
              refetch();
            }}
          />
        ))}
      </PanelCol>
    </div>
  );
}

const TONES: Record<string, { bg: string; bd: string; fg: string }> = {
  green: { bg: "rgba(132,185,143,0.08)", bd: "rgba(132,185,143,0.30)", fg: "#9BCB9F" },
  warning: { bg: "rgba(246,196,83,0.08)", bd: "rgba(246,196,83,0.30)", fg: "#F6C453" },
  danger: { bg: "rgba(255,107,107,0.08)", bd: "rgba(255,107,107,0.30)", fg: "#FF8585" },
};

function PanelCol({
  title, count, sum, icon, tone, children,
}: { title: string; count: number; sum: number; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className="rounded-xl p-3" style={{ background: t.bg, border: `1px solid ${t.bd}`, minHeight: 200 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5" style={{ color: t.fg }}>
          {icon}
          <span className="font-semibold uppercase" style={{ fontSize: 10, letterSpacing: "0.12em" }}>{title}</span>
        </div>
        <span className="font-bold tabular-nums" style={{ color: "var(--nuvia-text-primary)", fontSize: 12 }}>
          {count}
        </span>
      </div>
      <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 11, marginBottom: 8 }} className="tabular-nums">
        {money(sum)}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MovRow({
  m,
  candidatos,
  allowManual,
  onAccept,
  onAssignManual,
  onDiscard,
}: {
  m: { id: string; fecha: string; valor: number; descripcion_raw: string | null; confianza: number };
  candidatos?: Array<{ match_tipo: string; match_id: string; score: number; motivo: any }>;
  allowManual?: boolean;
  onAccept?: (c: { match_tipo: string; match_id: string }) => void | Promise<void>;
  onAssignManual?: (tipo: string, id: string) => void | Promise<void>;
  onDiscard?: () => void | Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ tipo: string; id: string; label: string }>>([]);
  const searchFn = useServerFn(buscarTargets);

  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div style={{ color: "var(--nuvia-text-primary)", fontSize: 12 }} className="truncate">
            {m.descripcion_raw || <em style={{ color: "var(--nuvia-text-secondary)" }}>sin descripción</em>}
          </div>
          <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 10 }}>
            {m.fecha} · conf {Number(m.confianza).toFixed(0)}%
          </div>
        </div>
        <div style={{ color: "var(--nuvia-text-primary)", fontSize: 12 }} className="tabular-nums font-semibold">
          {money(m.valor)}
        </div>
      </div>

      {candidatos && candidatos.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {candidatos.slice(0, 2).map((c, i) => (
            <button
              key={i}
              onClick={() => onAccept?.(c)}
              className="w-full text-left rounded px-2 py-1 flex items-center justify-between gap-2 transition"
              style={{ background: "rgba(68,93,163,0.12)", border: "1px solid rgba(68,93,163,0.25)" }}
            >
              <span style={{ color: "var(--nuvia-text-primary)", fontSize: 11 }} className="truncate">
                <strong style={{ color: "#A5B5E0" }}>{c.match_tipo}</strong> · {JSON.stringify(c.motivo).slice(0, 60)}
              </span>
              <span style={{ color: "#9BCB9F", fontSize: 10 }} className="tabular-nums">
                {Number(c.score).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {allowManual && (
        <div className="mt-1.5">
          <div className="flex gap-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente, cédula o CC..."
              className="nuvia-input nuvia-input-sm flex-1"
              style={{ fontSize: 11 }}
            />
            <button
              onClick={async () => {
                if (!q.trim()) return;
                const r = await searchFn({ data: { q: q.trim() } });
                setResults(r.results);
              }}
              className="rounded px-2 text-xs font-semibold text-white"
              style={{ background: "#445DA3" }}
            >
              <Search size={11} />
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {results.map((r) => (
                <button
                  key={r.tipo + r.id}
                  onClick={() => { onAssignManual?.(r.tipo, r.id); setResults([]); setQ(""); }}
                  className="w-full text-left rounded px-2 py-1 text-[11px]"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--nuvia-text-primary)" }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(allowManual || candidatos) && onDiscard && (
        <button
          onClick={onDiscard}
          className="mt-1 text-[10px] uppercase font-semibold"
          style={{ color: "#FF8585", letterSpacing: "0.1em" }}
        >
          Descartar
        </button>
      )}
    </div>
  );
}
