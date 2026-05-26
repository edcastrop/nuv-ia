import { supabase } from "@/integrations/supabase/client";

export type OnboardingEvento =
  | "registro"
  | "aprobacion"
  | "rechazo"
  | "inicio_onboarding"
  | "fin_onboarding"
  | "asignacion_academia"
  | "activacion_permisos"
  | "perfil_completado"
  | "tour_completado"
  | "bienvenida_vista";

export async function logOnboarding(
  userId: string,
  evento: OnboardingEvento,
  detalle: Record<string, unknown> = {},
) {
  try {
    const actor = (await supabase.auth.getUser()).data.user?.id ?? null;
    await supabase.from("onboarding_auditoria" as never).insert({
      user_id: userId,
      evento,
      actor_id: actor,
      detalle,
    } as never);
  } catch {
    // no-op
  }
}

export type OnboardingProfile = {
  estado_acceso: string;
  rol_solicitado: string | null;
  onboarding_estado: string;
  onboarding_paso: number;
  bienvenida_vista: boolean;
  perfil_completo: boolean;
  tour_completo: boolean;
  academia_asignada: boolean;
  checklist_completo: boolean;
  nombre: string | null;
  celular: string | null;
  ciudad: string | null;
  pais: string | null;
  avatar_url: string | null;
  rechazado_motivo: string | null;
};

export async function getOnboardingProfile(userId: string): Promise<OnboardingProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "estado_acceso, rol_solicitado, onboarding_estado, onboarding_paso, bienvenida_vista, perfil_completo, tour_completo, academia_asignada, checklist_completo, nombre, celular, ciudad, pais, avatar_url, rechazado_motivo",
    )
    .eq("id", userId)
    .maybeSingle();
  return (data as unknown as OnboardingProfile) ?? null;
}

export async function updateOnboarding(
  userId: string,
  patch: Partial<OnboardingProfile>,
) {
  await supabase.from("profiles").update(patch as never).eq("id", userId);
}

export function profileIsComplete(p: Partial<OnboardingProfile>): boolean {
  return Boolean(p.nombre && p.celular && p.ciudad && p.pais);
}
