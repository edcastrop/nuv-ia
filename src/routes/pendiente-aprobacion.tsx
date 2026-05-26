import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Logo } from "@/components/nuvex/Logo";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/pendiente-aprobacion")({
  component: PendienteAprobacionPage,
  head: () => ({ meta: [{ title: "Solicitud en revisión · NUVEX" }] }),
});

function PendienteAprobacionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const check = async () => {
    if (!user) return;
    setRefreshing(true);
    const [{ data }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("estado_acceso, rechazado_motivo, onboarding_estado")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id),
    ]);
    setRefreshing(false);
    const isSuperAdmin = ((roleRows ?? []) as Array<{ role?: string }>).some((r) => r.role === "super_admin");
    if (isSuperAdmin) {
      navigate({ to: "/" });
      return;
    }
    if (!data) return;
    setEstado(data.estado_acceso as string);
    setMotivo((data.rechazado_motivo as string) ?? null);
    if (data.estado_acceso === "aprobado") {
      navigate({ to: "/onboarding" });
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const rechazado = estado === "rechazado";

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "linear-gradient(135deg, #050814, #0A1226 60%, #07162D)" }}>
      <section className="w-full max-w-lg rounded-2xl p-8 text-white" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
        <div className="flex justify-center mb-6"><Logo variant="white" height={36} /></div>

        {rechazado ? (
          <>
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(225,29,72,0.15)", border: "1px solid rgba(225,29,72,0.4)" }}>
              <ShieldAlert className="text-rose-400" />
            </div>
            <h1 className="text-2xl font-semibold text-center mb-3">Solicitud rechazada</h1>
            <p className="text-white/70 text-center text-sm mb-2">Tu solicitud de acceso a NUVEX no fue aprobada.</p>
            {motivo && (
              <div className="mt-4 rounded-lg p-3 text-sm text-white/80" style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.25)" }}>
                <b>Motivo:</b> {motivo}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(68,93,163,0.18)", border: "1px solid rgba(68,93,163,0.4)" }}>
              <Clock className="text-[#84B98F]" />
            </div>
            <h1 className="text-2xl font-semibold text-center mb-3">Tu solicitud está en revisión</h1>
            <p className="text-white/70 text-center text-sm">
              Un administrador de NUVEX revisará y aprobará tu acceso pronto. Recibirás una notificación cuando puedas comenzar.
            </p>
            <div className="mt-6 flex justify-center">
              <button onClick={check} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Actualizar estado
              </button>
            </div>
          </>
        )}

        <button onClick={() => signOut().then(() => navigate({ to: "/login" }))} className="mt-8 mx-auto flex items-center gap-2 text-xs text-white/50 hover:text-white">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </section>
    </main>
  );
}
