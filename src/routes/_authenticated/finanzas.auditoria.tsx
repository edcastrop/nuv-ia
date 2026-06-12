import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  PageLayout,
  ExecutiveHero,
  NCard,
  SectionHeader,
} from "@/components/nuvia";
import { NSelect } from "@/components/nuvia/NSelect";
import { supabase } from "@/integrations/supabase/client";
import { obtenerUrlComprobante } from "@/lib/auditoria.functions";
import { ShieldCheck, Download, Paperclip } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/auditoria")({
  component: AuditoriaPage,
  head: () => ({ meta: [{ title: "Auditoría · Finanzas NUVIA" }] }),
});

type Row = {
  id: string;
  entidad: string;
  entidad_id: string | null;
  accion: string;
  user_id: string | null;
  documento_url: string | null;
  motivo: string | null;
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  created_at: string;
};

function extractFilenameFromPath(path: string): string {
  const idx = path.lastIndexOf("-");
  if (idx > 0) return path.slice(idx + 1);
  return path.split("/").pop() ?? path;
}

function AuditoriaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filtroEnt, setFiltroEnt] = useState("");
  const [filtroAcc, setFiltroAcc] = useState("");
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const fetchUrl = useServerFn(obtenerUrlComprobante);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finanzas_auditoria" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const rs = (data ?? []) as unknown as Row[];
      setRows(rs);
      const uids = Array.from(new Set(rs.map((r) => r.user_id).filter(Boolean) as string[]));
      if (uids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", uids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          map[p.id] = p.nombre ?? p.id.slice(0, 8);
        });
        setProfMap(map);
      }
    })();
  }, []);

  const entidades = useMemo(() => Array.from(new Set(rows.map((r) => r.entidad))).sort(), [rows]);
  const acciones = useMemo(() => Array.from(new Set(rows.map((r) => r.accion))).sort(), [rows]);
  const filtradas = rows.filter(
    (r) => (!filtroEnt || r.entidad === filtroEnt) && (!filtroAcc || r.accion === filtroAcc),
  );

  async function handleDownload(path: string) {
    setLoadingDoc(path);
    try {
      const { url } = await fetchUrl({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("No se pudo abrir el comprobante.");
    } finally {
      setLoadingDoc(null);
    }
  }

  function exportarCSV() {
    const headers = [
      "Fecha", "Entidad", "Entidad ID", "Acción", "Usuario", "Motivo",
      "Valor anterior", "Valor nuevo", "Documento",
    ];
    const data = filtradas.map((r) => [
      new Date(r.created_at).toLocaleString("es-CO"),
      r.entidad,
      r.entidad_id ?? "",
      r.accion,
      r.user_id ? profMap[r.user_id] ?? r.user_id : "",
      (r.motivo ?? "").replace(/"/g, '""'),
      r.valor_anterior ? JSON.stringify(r.valor_anterior) : "",
      r.valor_nuevo ? JSON.stringify(r.valor_nuevo) : "",
      r.documento_url ?? "",
    ]);
    const csv = [headers, ...data]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-nuvia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldCheck size={12} />, label: "Finanzas", tone: "blue" }}
        title="Auditoría financiera"
        description="Trazabilidad completa de cada acción en el módulo de finanzas."
        actions={
          <button
            onClick={exportarCSV}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
          >
            <Download size={14} />
            Exportar CSV
          </button>
        }
      />

      <NCard padding="md">
        <SectionHeader title="Filtros" description={`${filtradas.length} de ${rows.length} registros`} />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Entidad">
            <NSelect
              value={filtroEnt || "__all__"}
              onValueChange={(v) => setFiltroEnt(v === "__all__" ? "" : v)}
              options={[{ value: "__all__", label: "Todas las entidades" }, ...entidades.map((e) => ({ value: e, label: e }))]}
              minWidth={200}
            />
          </Field>
          <Field label="Acción">
            <NSelect
              value={filtroAcc || "__all__"}
              onValueChange={(v) => setFiltroAcc(v === "__all__" ? "" : v)}
              options={[{ value: "__all__", label: "Todas las acciones" }, ...acciones.map((a) => ({ value: a, label: a }))]}
              minWidth={200}
            />
          </Field>
          {(filtroEnt || filtroAcc) && (
            <button
              onClick={() => { setFiltroEnt(""); setFiltroAcc(""); }}
              className="text-[11px] font-semibold pb-2"
              style={{ color: "var(--nuvia-accent-blue)" }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </NCard>

      <NCard padding="md">
        <SectionHeader title="Trazabilidad" description="Últimos 500 eventos" />
        {filtradas.length === 0 ? (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            Sin registros de auditoría.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Fecha", "Entidad", "Acción", "Usuario", "Detalle"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 font-semibold uppercase"
                      style={{
                        fontSize: "10.5px",
                        letterSpacing: "0.12em",
                        color: "var(--nuvia-text-secondary)",
                        borderBottom: "1px solid var(--nuvia-border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-white/[0.03] align-top"
                    style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {new Date(r.created_at).toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>
                      {r.entidad}
                    </td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: "var(--nuvia-accent-blue)" }}>
                      {r.accion}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {r.user_id ? profMap[r.user_id] ?? r.user_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {r.motivo && (
                        <div className="italic" style={{ color: "var(--nuvia-text-primary)" }}>
                          {r.motivo}
                        </div>
                      )}
                      {r.valor_anterior && (
                        <div className="text-[10.5px] mt-0.5" style={{ color: "var(--nuvia-danger)" }}>
                          <b>Antes:</b>{" "}
                          <code style={{ color: "var(--nuvia-text-secondary)" }}>
                            {JSON.stringify(r.valor_anterior)}
                          </code>
                        </div>
                      )}
                      {r.valor_nuevo && (
                        <div className="text-[10.5px] mt-0.5" style={{ color: "var(--nuvia-accent-blue)" }}>
                          <b>Nuevo:</b>{" "}
                          <code style={{ color: "var(--nuvia-text-secondary)" }}>
                            {JSON.stringify(r.valor_nuevo)}
                          </code>
                        </div>
                      )}
                      {r.documento_url && (
                        <button
                          onClick={() => handleDownload(r.documento_url!)}
                          disabled={loadingDoc === r.documento_url}
                          className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] hover:underline disabled:opacity-50"
                          style={{ color: "var(--nuvia-success)" }}
                          type="button"
                        >
                          <Paperclip size={11} />
                          {loadingDoc === r.documento_url
                            ? "Abriendo…"
                            : extractFilenameFromPath(r.documento_url)}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10.5px] uppercase tracking-wider"
        style={{ color: "var(--nuvia-text-muted)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
