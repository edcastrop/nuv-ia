// Fase 7 — Productividad y tiempos
// Métricas operativas por usuario a partir de auditoria_global, expedientes,
// caso_alertas y notificaciones. No mueve datos, solo agrega para visualización.

import { supabase } from "@/integrations/supabase/client";
import { ESTADOS_CERRADOS } from "@/lib/torreControl";

export interface ProductividadUsuario {
  user_id: string;
  nombre: string;
  email: string | null;
  cambios_estado: number;       // # transiciones realizadas en el periodo
  casos_cerrados: number;       // expedientes finalizados/proceso_cerrado en periodo
  casos_activos: number;        // expedientes activos asignados hoy
  alertas_recibidas: number;    // notificaciones tipo caso_estancado o incidente
  horas_promedio_ciclo: number; // promedio de horas entre creación y cierre
}

const ESTADOS_CERRADOS_SET = new Set<string>(ESTADOS_CERRADOS);

export async function cargarProductividad(desdeISO: string): Promise<ProductividadUsuario[]> {
  const [{ data: profs }, { data: aud }, { data: exps }, { data: notis }] = await Promise.all([
    supabase.from("profiles").select("id, nombre, email, estado_acceso").eq("estado_acceso", "aprobado"),
    supabase.from("auditoria_global")
      .select("user_id, accion, created_at")
      .gte("created_at", desdeISO)
      .in("accion", ["cambiar_estado", "cambio_estado", "transicion_estado", "reasignar_asesor"]),
    supabase.from("expedientes")
      .select("id, asesor_id, estado_caso, created_at, updated_at"),
    supabase.from("notificaciones_usuario")
      .select("user_id, tipo, created_at")
      .gte("created_at", desdeISO),
  ]);

  type Prof = { id: string; nombre: string | null; email: string | null };
  type Aud = { user_id: string | null; accion: string; created_at: string };
  type Exp = { id: string; asesor_id: string | null; estado_caso: string | null; created_at: string; updated_at: string };
  type Noti = { user_id: string; tipo: string; created_at: string };

  const cambiosByUser = new Map<string, number>();
  ((aud ?? []) as Aud[]).forEach((a) => {
    if (!a.user_id) return;
    cambiosByUser.set(a.user_id, (cambiosByUser.get(a.user_id) ?? 0) + 1);
  });

  const cerradosByUser = new Map<string, number>();
  const activosByUser = new Map<string, number>();
  const ciclosByUser = new Map<string, number[]>();
  ((exps ?? []) as Exp[]).forEach((e) => {
    if (!e.asesor_id) return;
    const cerrado = e.estado_caso && ESTADOS_CERRADOS_SET.has(e.estado_caso);
    if (cerrado && new Date(e.updated_at).toISOString() >= desdeISO) {
      cerradosByUser.set(e.asesor_id, (cerradosByUser.get(e.asesor_id) ?? 0) + 1);
      const horas = (new Date(e.updated_at).getTime() - new Date(e.created_at).getTime()) / 3_600_000;
      const arr = ciclosByUser.get(e.asesor_id) ?? [];
      arr.push(Math.max(0, horas));
      ciclosByUser.set(e.asesor_id, arr);
    }
    if (!cerrado) {
      activosByUser.set(e.asesor_id, (activosByUser.get(e.asesor_id) ?? 0) + 1);
    }
  });

  const alertasByUser = new Map<string, number>();
  ((notis ?? []) as Noti[]).forEach((n) => {
    if (n.tipo === "caso_estancado" || n.tipo === "incidente") {
      alertasByUser.set(n.user_id, (alertasByUser.get(n.user_id) ?? 0) + 1);
    }
  });

  const out: ProductividadUsuario[] = ((profs ?? []) as Prof[]).map((p) => {
    const ciclos = ciclosByUser.get(p.id) ?? [];
    const prom = ciclos.length ? ciclos.reduce((s, x) => s + x, 0) / ciclos.length : 0;
    return {
      user_id: p.id,
      nombre: p.nombre || p.email || "—",
      email: p.email,
      cambios_estado: cambiosByUser.get(p.id) ?? 0,
      casos_cerrados: cerradosByUser.get(p.id) ?? 0,
      casos_activos: activosByUser.get(p.id) ?? 0,
      alertas_recibidas: alertasByUser.get(p.id) ?? 0,
      horas_promedio_ciclo: Math.round(prom * 10) / 10,
    };
  });

  out.sort((a, b) =>
    (b.cambios_estado + b.casos_cerrados) - (a.cambios_estado + a.casos_cerrados),
  );
  return out;
}

export const RANGOS_PRODUCTIVIDAD = [
  { key: "7d",  label: "Últimos 7 días",  dias: 7 },
  { key: "30d", label: "Últimos 30 días", dias: 30 },
  { key: "90d", label: "Últimos 90 días", dias: 90 },
] as const;

export type RangoKey = typeof RANGOS_PRODUCTIVIDAD[number]["key"];

export function isoDesdeDias(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}
