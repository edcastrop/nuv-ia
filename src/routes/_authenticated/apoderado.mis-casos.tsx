import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/apoderado/mis-casos")({
  component: ApoderadoMisCasos,
  head: () => ({ meta: [{ title: "Mis casos · Apoderado · NUVEX" }] }),
});

interface Row {
  id: string;
  cliente_nombre: string;
  banco: string | null;
  estado_caso: CasoEstado | null;
  honorarios_final: number | null;
  updated_at: string;
}

function ApoderadoMisCasos() {
  const { user } = useAuth();
  const { isApoderado, isSuperAdmin, loading } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      // Buscar el id de apoderado vinculado a este usuario (si existe), o usar email
      const { data: ap } = await supabase
        .from("apoderados_nuvex" as never)
        .select("id,user_id,email")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`);
      const apIds = ((ap as unknown as { id: string }[]) ?? []).map((a) => a.id);

      let q = supabase
        .from("expedientes")
        .select("id,cliente_nombre,banco,estado_caso,honorarios_final,updated_at" as never)
        .order("updated_at", { ascending: false });
      if (apIds.length) {
        q = q.in("apoderado_id" as never, apIds as never);
      } else {
        // Sin vínculo, no mostrar nada salvo super_admin
        if (!isSuperAdmin) { setRows([]); setLoad(false); return; }
      }
      const { data } = await q;
      setRows((data as unknown as Row[]) ?? []);
      setLoad(false);
    })();
  }, [user, loading, isSuperAdmin]);

  const totalHonorarios = useMemo(
    () => rows.reduce((a, r) => a + (Number(r.honorarios_final) || 0), 0),
    [rows],
  );
  const aprobados = rows.filter((r) => ["aprobado", "aprobado_banco", "condiciones_aplicadas", "aplicado_banco"].includes(r.estado_caso ?? "")).length;
  const finalizados = rows.filter((r) => ["honorarios_pagados", "caso_finalizado", "paz_y_salvo_generado"].includes(r.estado_caso ?? "")).length;

  if (loading || load) return <div className="p-8 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isApoderado && !isSuperAdmin)
    return <div className="p-8 text-center text-sm text-[#B42318]">Vista exclusiva para apoderados.</div>;

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <Briefcase size={20} className="text-[#445DA3]" />
          <div>
            <h1 className="text-lg font-semibold text-[#0A1226]">Mis casos</h1>
            <p className="text-[12px] text-[#242424]/60">Vista simplificada — solo casos asignados a tu poder.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total casos" v={rows.length.toString()} c="#445DA3" />
        <Stat label="Aprobados" v={aprobados.toString()} c="#1F7A45" />
        <Stat label="Finalizados" v={finalizados.toString()} c="#0A1226" />
        <Stat label="Honorarios totales" v={fmt(totalHonorarios)} c="#84B98F" />
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#242424]/60">Aún no tienes casos asignados.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Banco</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Honorarios</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#F7F9FB]">
                  <td className="px-3 py-2 font-medium">{r.cliente_nombre}</td>
                  <td className="px-3 py-2">{r.banco ?? "—"}</td>
                  <td className="px-3 py-2">{labelEstado(r.estado_caso)}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(r.honorarios_final) || 0)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/casos/$id" params={{ id: r.id }} className="text-[#445DA3] hover:underline text-[12px]">
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, v, c }: { label: string; v: string; c: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="mt-1 text-xl font-bold" style={{ color: c }}>{v}</div>
    </div>
  );
}
