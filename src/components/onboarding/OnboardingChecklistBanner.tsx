import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Circle, AlertCircle, ChevronRight } from "lucide-react";

type Etapa = "pendiente_aprobacion" | "pendiente_perfil" | "pendiente_mfa" | "completo" | "desvinculado" | "desconocido";

type Profile = {
  estado_acceso: string | null;
  perfil_completo: boolean | null;
  mfa_metodo: string | null;
  onboarding_estado: string | null;
  nombre: string | null;
  celular: string | null;
  ciudad: string | null;
  pais: string | null;
};

function isPerfilLleno(p: Profile): boolean {
  return Boolean(p.nombre?.trim() && p.celular?.trim() && p.ciudad?.trim() && p.pais?.trim());
}

function etapaDe(p: Profile | null): Etapa {
  if (!p) return "desconocido";
  if (p.estado_acceso === "desvinculado") return "desvinculado";
  if (p.estado_acceso !== "aprobado" && p.estado_acceso !== "activo") return "pendiente_aprobacion";
  const mfaOk = !!p.mfa_metodo && p.mfa_metodo !== "ninguno";
  const perfilOk = !!p.perfil_completo || p.onboarding_estado === "completado" || isPerfilLleno(p);
  if (!perfilOk) return "pendiente_perfil";
  if (!mfaOk) return "pendiente_mfa";
  return "completo";
}

export function OnboardingChecklistBanner() {
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("estado_acceso, perfil_completo, mfa_metodo, onboarding_estado, nombre, celular, ciudad, pais")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancel) setP(data as Profile | null);
    })();

    const ch = supabase
      .channel(`onb_banner_${user.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setP(payload.new as Profile))
      .subscribe();
    return () => { cancel = true; supabase.removeChannel(ch); };
  }, [user]);

  const etapa = etapaDe(p);
  if (etapa === "completo" || etapa === "desvinculado" || etapa === "desconocido") return null;
  if (dismissed && etapa !== "pendiente_mfa") return null;

  const pasos = [
    { id: "aprobacion", label: "Cuenta aprobada", done: etapa !== "pendiente_aprobacion" },
    { id: "perfil",     label: "Perfil completo",  done: etapa === "pendiente_mfa" },
    { id: "mfa",        label: "Doble factor (MFA) activo", done: false },
  ];

  const cta = etapa === "pendiente_aprobacion"
    ? { to: "/pendiente-aprobacion", label: "Ver estado" }
    : etapa === "pendiente_perfil"
      ? { to: "/mi-perfil", label: "Completar perfil" }
      : { to: "/mi-perfil", label: "Activar MFA" };

  const urgente = etapa === "pendiente_mfa";

  return (
    <div className={`mb-4 rounded-xl border p-4 shadow-sm ${urgente ? "border-amber-400 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className={`h-5 w-5 mt-0.5 ${urgente ? "text-amber-600" : "text-blue-600"}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                {urgente ? "Activa tu doble factor para terminar" : "Termina de configurar tu cuenta"}
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                {urgente
                  ? "Es el último paso. Tu cuenta no estará totalmente activa hasta configurar MFA."
                  : "Solo te toma unos minutos. Recibirás recordatorios diarios hasta completar."}
              </p>
            </div>
            <Link
              to={cta.to}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${urgente ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {cta.label} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {pasos.map((p) => (
              <li key={p.id} className={`flex items-center gap-1.5 ${p.done ? "text-emerald-700" : "text-slate-500"}`}>
                {p.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {p.label}
              </li>
            ))}
          </ul>
          {!urgente && (
            <button onClick={() => setDismissed(true)} className="mt-2 text-xs text-slate-500 hover:underline">
              Ocultar hasta el próximo recordatorio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
