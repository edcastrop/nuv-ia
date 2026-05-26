import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Users, UserCheck, UserX, Clock, CheckCircle2, Activity, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/super-admin/onboarding")({
  component: SuperAdminOnboarding,
  head: () => ({ meta: [{ title: "Onboarding NUVEX · Super Admin" }] }),
});

type KPI = {
  pendientes: number; aprobados: number; rechazados: number;
  onb_completado: number; onb_en_progreso: number; activos: number;
};

type Row = {
  id: string; nombre: string | null; email: string | null;
  estado_acceso: string; rol_solicitado: string | null;
  onboarding_estado: string; onboarding_paso: number;
  created_at: string;
};

function SuperAdminOnboarding() {
  const { isSuperAdmin } = useUserRole();
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [cfg, setCfg] = useState({ video_bienvenida_url: "", mensaje_bienvenida: "", descripcion_empresa: "" });
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const counts = async (col: string, val: string) => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq(col, val);
      return count ?? 0;
    };
    const [pendientes, aprobados, rechazados, onb_completado, onb_en_progreso] = await Promise.all([
      counts("estado_acceso", "pendiente"),
      counts("estado_acceso", "aprobado"),
      counts("estado_acceso", "rechazado"),
      counts("onboarding_estado", "completado"),
      counts("onboarding_estado", "en_progreso"),
    ]);
    const { count: activos } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("activo", true);
    setKpi({ pendientes, aprobados, rechazados, onb_completado, onb_en_progreso, activos: activos ?? 0 });

    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, email, estado_acceso, rol_solicitado, onboarding_estado, onboarding_paso, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as unknown as Row[]);

    const { data: c } = await supabase.from("onboarding_config" as never).select("*").maybeSingle();
    if (c) setCfg({
      video_bienvenida_url: (c as { video_bienvenida_url: string | null }).video_bienvenida_url ?? "",
      mensaje_bienvenida: (c as { mensaje_bienvenida: string }).mensaje_bienvenida ?? "",
      descripcion_empresa: (c as { descripcion_empresa: string }).descripcion_empresa ?? "",
    });
  };

  useEffect(() => { load(); }, []);

  const saveConfig = async () => {
    await supabase.from("onboarding_config" as never).update({
      video_bienvenida_url: cfg.video_bienvenida_url || null,
      mensaje_bienvenida: cfg.mensaje_bienvenida,
      descripcion_empresa: cfg.descripcion_empresa,
      updated_at: new Date().toISOString(),
    } as never).eq("id", true as never);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  if (!isSuperAdmin) return <div className="p-8 text-white/60">Solo Super Admin.</div>;

  return (
    <div className="p-6 md:p-8 text-white">
      <h1 className="text-2xl font-semibold mb-1">Onboarding NUVEX</h1>
      <p className="text-white/60 text-sm mb-6">Seguimiento del ingreso y formación de colaboradores.</p>

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
          <Kpi label="Pendientes" value={kpi.pendientes} Icon={Clock} color="#F59E0B" />
          <Kpi label="Aprobados" value={kpi.aprobados} Icon={UserCheck} color="#84B98F" />
          <Kpi label="Rechazados" value={kpi.rechazados} Icon={UserX} color="#E11D48" />
          <Kpi label="Onb. en progreso" value={kpi.onb_en_progreso} Icon={Activity} color="#445DA3" />
          <Kpi label="Onb. completado" value={kpi.onb_completado} Icon={CheckCircle2} color="#84B98F" />
          <Kpi label="Activos" value={kpi.activos} Icon={Users} color="#94A3B8" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Últimos registros</h2>
            <Link to="/super-admin/accesos" className="text-xs text-[#84B98F] hover:underline">Ir a bandeja de aprobación →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/50 text-xs">
                <tr><th className="text-left py-2">Usuario</th><th className="text-left">Rol</th><th className="text-left">Estado</th><th className="text-left">Onboarding</th><th className="text-right">Registro</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2">
                      <div className="font-medium">{r.nombre ?? "—"}</div>
                      <div className="text-xs text-white/50">{r.email}</div>
                    </td>
                    <td className="text-xs text-white/70">{r.rol_solicitado ?? "—"}</td>
                    <td><Badge text={r.estado_acceso} /></td>
                    <td><Badge text={`${r.onboarding_estado} (${r.onboarding_paso}/5)`} /></td>
                    <td className="text-xs text-right text-white/50">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-white/40 text-sm">Sin registros aún.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="font-semibold mb-4">Configuración de bienvenida</h2>
          <label className="block mb-3">
            <span className="text-xs text-white/60 mb-1 block">Video de bienvenida (URL)</span>
            <input value={cfg.video_bienvenida_url} onChange={(e) => setCfg({ ...cfg, video_bienvenida_url: e.target.value })}
              placeholder="https://youtu.be/..." className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 outline-none" />
          </label>
          <label className="block mb-3">
            <span className="text-xs text-white/60 mb-1 block">Mensaje de bienvenida</span>
            <textarea value={cfg.mensaje_bienvenida} onChange={(e) => setCfg({ ...cfg, mensaje_bienvenida: e.target.value })}
              rows={2} className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 outline-none" />
          </label>
          <label className="block mb-3">
            <span className="text-xs text-white/60 mb-1 block">Descripción de la empresa</span>
            <textarea value={cfg.descripcion_empresa} onChange={(e) => setCfg({ ...cfg, descripcion_empresa: e.target.value })}
              rows={4} className="w-full rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 outline-none" />
          </label>
          <button onClick={saveConfig} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
            <Save size={14} /> {saved ? "Guardado ✓" : "Guardar"}
          </button>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, Icon, color }: { label: string; value: number; Icon: typeof Users; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-2"><Icon size={16} style={{ color }} /></div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-white/60 mt-1">{label}</div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  const colors: Record<string, string> = {
    pendiente: "#F59E0B", aprobado: "#84B98F", rechazado: "#E11D48", bloqueado: "#94A3B8",
    completado: "#84B98F", en_progreso: "#445DA3",
  };
  const c = colors[text.split(" ")[0]] ?? "#94A3B8";
  return <span className="inline-block rounded-md px-2 py-0.5 text-[11px]" style={{ background: `${c}25`, color: c, border: `1px solid ${c}55` }}>{text}</span>;
}
