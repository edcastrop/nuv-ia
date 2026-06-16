import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Users, UserCheck, UserX, Clock, CheckCircle2, Activity, Save, Rocket } from "lucide-react";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";

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
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
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

  if (roleLoading) {
    return (
      <PageLayout>
        <div className="p-8 text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

  const cardStyle = { background: "var(--nuvia-bg-card)", border: "1px solid var(--nuvia-border)" } as const;

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Rocket size={12} />, label: "Adopción NUVIA", tone: "blue" }}
        title="Onboarding NUVEX"
        description="Seguimiento del ingreso y formación de colaboradores."
        meta={
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>
            <ArrowLeft size={12} /> Super Admin
          </Link>
        }
      />

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Pendientes" value={kpi.pendientes} Icon={Clock} color="#F6C453" />
          <Kpi label="Aprobados" value={kpi.aprobados} Icon={UserCheck} color="var(--nuvia-accent-green)" />
          <Kpi label="Rechazados" value={kpi.rechazados} Icon={UserX} color="#FF8585" />
          <Kpi label="Onb. en progreso" value={kpi.onb_en_progreso} Icon={Activity} color="var(--nuvia-accent-blue)" />
          <Kpi label="Onb. completado" value={kpi.onb_completado} Icon={CheckCircle2} color="var(--nuvia-accent-green)" />
          <Kpi label="Activos" value={kpi.activos} Icon={Users} color="var(--nuvia-text-secondary)" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-2xl p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>Últimos registros</h2>
            <Link to="/super-admin/accesos" className="text-xs hover:underline" style={{ color: "var(--nuvia-accent-green)" }}>Ir a bandeja de aprobación →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs">
                <tr>
                  <th className="text-left py-2 font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Usuario</th>
                  <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Rol</th>
                  <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Estado</th>
                  <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Onboarding</th>
                  <th className="text-right font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Registro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td className="py-2">
                      <div className="font-medium" style={{ color: "var(--nuvia-text-primary)" }}>{r.nombre ?? "—"}</div>
                      <div className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>{r.email}</div>
                    </td>
                    <td className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>{r.rol_solicitado ?? "—"}</td>
                    <td><Badge text={r.estado_acceso} /></td>
                    <td><Badge text={`${r.onboarding_estado} (${r.onboarding_paso}/5)`} /></td>
                    <td className="text-xs text-right" style={{ color: "var(--nuvia-text-secondary)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Sin registros aún.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl p-5" style={cardStyle}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--nuvia-text-primary)" }}>Configuración de bienvenida</h2>
          <label className="block mb-3">
            <span className="text-xs mb-1.5 block font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nuvia-text-secondary)" }}>Video de bienvenida (URL)</span>
            <input value={cfg.video_bienvenida_url} onChange={(e) => setCfg({ ...cfg, video_bienvenida_url: e.target.value })}
              placeholder="https://youtu.be/..." className="nuvia-input" />
          </label>
          <label className="block mb-3">
            <span className="text-xs mb-1.5 block font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nuvia-text-secondary)" }}>Mensaje de bienvenida</span>
            <textarea value={cfg.mensaje_bienvenida} onChange={(e) => setCfg({ ...cfg, mensaje_bienvenida: e.target.value })}
              rows={2} className="nuvia-input" style={{ resize: "vertical" }} />
          </label>
          <label className="block mb-3">
            <span className="text-xs mb-1.5 block font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nuvia-text-secondary)" }}>Descripción de la empresa</span>
            <textarea value={cfg.descripcion_empresa} onChange={(e) => setCfg({ ...cfg, descripcion_empresa: e.target.value })}
              rows={4} className="nuvia-input" style={{ resize: "vertical" }} />
          </label>
          <button
            onClick={saveConfig}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))" }}
          >
            <Save size={14} /> {saved ? "Guardado ✓" : "Guardar"}
          </button>
        </section>
      </div>
    </PageLayout>
  );
}

function Kpi({ label, value, Icon, color }: { label: string; value: number; Icon: typeof Users; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--nuvia-bg-card)", border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center justify-between mb-2"><Icon size={16} style={{ color }} /></div>
      <div className="text-2xl font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "var(--nuvia-text-secondary)" }}>{label}</div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  const colors: Record<string, string> = {
    pendiente: "#F6C453", aprobado: "#9BCB9F", rechazado: "#FF8585", bloqueado: "#A5B5E0",
    completado: "#9BCB9F", en_progreso: "#A5B5E0",
  };
  const c = colors[text.split(" ")[0]] ?? "#A5B5E0";
  return <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>{text}</span>;
}
