import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Search, FileText, Download } from "lucide-react";

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

  if (rolesLoading || loading) return <div className="p-8 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!allow) return <Navigate to="/" />;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-[#445DA3]" />
            <div>
              <h1 className="text-lg font-semibold text-[#0A1226]">Auditoría global</h1>
              <p className="text-[12px] text-[#242424]/60">Últimos 500 eventos del sistema.</p>
            </div>
          </div>
          <a
            href="/auditoria-simuladores-nuvex.pdf"
            download
            className="inline-flex items-center gap-2 rounded-lg bg-[#445DA3] px-3 py-2 text-[12.5px] font-medium text-white hover:bg-[#3a4f8d] transition-colors"
          >
            <Download size={14} />
            Descargar informe de auditoría (PDF)
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 flex-1 min-w-[240px]">
            <Search size={13} className="text-[#445DA3]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar usuario, acción, expediente…"
              className="w-full bg-transparent text-[12.5px] outline-none"
            />
          </div>
          <select
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[12.5px]"
          >
            <option value="">Todas las acciones</option>
            {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <table className="w-full text-[12px]">
          <thead className="bg-[#F7F9FB] text-[10.5px] uppercase tracking-wide text-[#242424]/60">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Usuario</th>
              <th className="px-3 py-2 text-left">Acción</th>
              <th className="px-3 py-2 text-left">Entidad</th>
              <th className="px-3 py-2 text-left">Expediente</th>
              <th className="px-3 py-2 text-left">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EE]">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-[#F7F9FB] align-top">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{nombres.get(r.user_id ?? "") ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.accion}</td>
                <td className="px-3 py-2">{r.entidad}</td>
                <td className="px-3 py-2">
                  {r.expediente_id ? (
                    <Link to="/casos/$id" params={{ id: r.expediente_id }} className="text-[#445DA3] hover:underline font-mono text-[11px]">
                      {r.expediente_id.slice(0, 8)}…
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 max-w-[360px]">
                  {r.valor_nuevo ? (
                    <code className="text-[10.5px] text-[#242424]/70 break-all line-clamp-2">
                      {JSON.stringify(r.valor_nuevo)}
                    </code>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-[#242424]/60">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
