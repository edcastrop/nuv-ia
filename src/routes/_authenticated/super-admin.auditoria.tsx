import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, FileText, Download } from "lucide-react";
import { PageLayout, ExecutiveHero, NSelect } from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/super-admin/auditoria")({
  component: AuditoriaGlobal,
  head: () => ({ meta: [{ title: "Auditoría · Super Admin · NUVEX" }] }),
});

interface Row {
  id: string;
  user_id: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  expediente_id: string | null;
  valor_anterior: unknown;
  valor_nuevo: unknown;
  created_at: string;
}

function AuditoriaGlobal() {
  const { isSuperAdmin, isManager, loading: rolesLoading } = useUserRole();
  const allow = isSuperAdmin || isManager;
  const [rows, setRows] = useState<Row[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [accion, setAccion] = useState<string>("");

  useEffect(() => {
    if (rolesLoading) return;
    if (!allow) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("auditoria_global" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data as unknown as Row[]) ?? [];
      setRows(list);
      const uids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean) as string[]));
      if (uids.length) {
        const { data: p } = await supabase.from("profiles").select("id,nombre,email").in("id", uids);
        const m = new Map<string, string>();
        (p ?? []).forEach((x) => m.set(x.id, x.nombre || x.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, [rolesLoading, allow]);

  const acciones = useMemo(() => Array.from(new Set(rows.map((r) => r.accion))).sort(), [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (accion && r.accion !== accion) return false;
      if (!qq) return true;
      return (
        r.accion.toLowerCase().includes(qq) ||
        r.entidad.toLowerCase().includes(qq) ||
        (r.expediente_id ?? "").toLowerCase().includes(qq) ||
        (nombres.get(r.user_id ?? "") ?? "").toLowerCase().includes(qq)
      );
    });
  }, [rows, q, accion, nombres]);

  if (rolesLoading || loading) {
    return (
      <PageLayout>
        <div className="p-8 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!allow) return <Navigate to="/inicio" />;

  const cardStyle = { background: "var(--nuvia-bg-card)", border: "1px solid var(--nuvia-border)" } as const;
  const headBg = "rgba(255,255,255,0.04)";

  return (
    <PageLayout maxWidth="full">
      <ExecutiveHero
        badge={{ icon: <FileText size={12} />, label: "Trazabilidad NUVIA", tone: "blue" }}
        title="Auditoría global"
        description="Últimos 500 eventos del sistema."
        meta={
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>
            <ArrowLeft size={12} /> Super Admin
          </Link>
        }
        actions={
          <a
            href="/auditoria-simuladores-nuvex.pdf"
            download
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition"
            style={{
              background: "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
              color: "#fff",
            }}
          >
            <Download size={14} />
            Descargar informe PDF
          </a>
        }
      />

      <section className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex flex-wrap gap-2">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1 min-w-[240px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)" }}
          >
            <Search size={13} style={{ color: "var(--nuvia-accent-blue)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar usuario, acción, expediente…"
              className="w-full bg-transparent text-[12.5px] outline-none"
              style={{ color: "var(--nuvia-text-primary)" }}
            />
          </div>
          <NSelect
            value={accion}
            onValueChange={setAccion}
            options={[{ value: "", label: "Todas las acciones" }, ...acciones.map((a) => ({ value: a, label: a }))]}
            minWidth={220}
          />
        </div>
      </section>

      <section className="rounded-2xl p-5" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-[10.5px] uppercase tracking-wide" style={{ background: headBg }}>
              <tr>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Fecha</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Usuario</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Acción</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Entidad</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Expediente</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="align-top transition" style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--nuvia-text-secondary)" }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ color: "var(--nuvia-text-primary)" }}>{nombres.get(r.user_id ?? "") ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>{r.accion}</td>
                  <td className="px-3 py-2" style={{ color: "var(--nuvia-text-secondary)" }}>{r.entidad}</td>
                  <td className="px-3 py-2">
                    {r.expediente_id ? (
                      <Link
                        to="/casos/$id"
                        params={{ id: r.expediente_id }}
                        className="hover:underline font-mono text-[11px]"
                        style={{ color: "var(--nuvia-accent-blue)" }}
                      >
                        {r.expediente_id.slice(0, 8)}…
                      </Link>
                    ) : <span style={{ color: "var(--nuvia-text-secondary)" }}>—</span>}
                  </td>
                  <td className="px-3 py-2 max-w-[360px]">
                    {r.valor_nuevo ? (
                      <code className="text-[10.5px] break-all line-clamp-2" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {JSON.stringify(r.valor_nuevo)}
                      </code>
                    ) : <span style={{ color: "var(--nuvia-text-secondary)" }}>—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center" style={{ color: "var(--nuvia-text-secondary)" }}>Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
