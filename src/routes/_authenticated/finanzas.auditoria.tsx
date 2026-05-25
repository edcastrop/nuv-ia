import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/finanzas/auditoria")({
  component: AuditoriaPage,
  head: () => ({ meta: [{ title: "Auditoría · Finanzas NUVEX" }] }),
});

type Row = {
  id: string;
  entidad: string;
  entidad_id: string | null;
  accion: string;
  user_id: string | null;
  documento_url: string | null;
  motivo: string | null;
  valor_nuevo: Record<string, unknown> | null;
  created_at: string;
};

function AuditoriaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filtroEnt, setFiltroEnt] = useState("");
  const [filtroAcc, setFiltroAcc] = useState("");
  const [profMap, setProfMap] = useState<Record<string, string>>({});

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
        (profs ?? []).forEach((p) => { map[p.id] = p.nombre ?? p.id.slice(0, 8); });
        setProfMap(map);
      }
    })();
  }, []);

  const entidades = useMemo(() => Array.from(new Set(rows.map((r) => r.entidad))).sort(), [rows]);
  const acciones = useMemo(() => Array.from(new Set(rows.map((r) => r.accion))).sort(), [rows]);
  const filtradas = rows.filter((r) => (!filtroEnt || r.entidad === filtroEnt) && (!filtroAcc || r.accion === filtroAcc));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-[#0A1226]">Auditoría financiera</h1>
            <p className="text-[12px] text-[#242424]/60">Trazabilidad completa de cada acción en el módulo de finanzas.</p>
          </div>
          <div className="flex gap-2">
            <select value={filtroEnt} onChange={(e) => setFiltroEnt(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
              <option value="">Todas las entidades</option>
              {entidades.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filtroAcc} onChange={(e) => setFiltroAcc(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
              <option value="">Todas las acciones</option>
              {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        {filtradas.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#242424]/60">Sin registros de auditoría.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 pr-3">Fecha</th>
                  <th className="text-left pr-3">Entidad</th>
                  <th className="text-left pr-3">Acción</th>
                  <th className="text-left pr-3">Usuario</th>
                  <th className="text-left pr-3">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r.id} className="border-b border-[#F3F4F6] align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("es-CO")}</td>
                    <td className="pr-3">{r.entidad}</td>
                    <td className="pr-3 font-medium">{r.accion}</td>
                    <td className="pr-3">{r.user_id ? (profMap[r.user_id] ?? r.user_id.slice(0, 8)) : "—"}</td>
                    <td className="pr-3 text-[#242424]/80">
                      {r.motivo && <div className="italic">{r.motivo}</div>}
                      {r.valor_nuevo && <code className="text-[10.5px] text-[#445DA3]">{JSON.stringify(r.valor_nuevo)}</code>}
                      {r.documento_url && <div className="text-[10.5px] text-[#1F7A45]">📎 {r.documento_url}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
