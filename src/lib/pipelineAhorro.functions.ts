// Server fn: ahorro acumulado por banco / analista / oficina.
// Solo cuenta casos en fases de cierre/cobro.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AhorroRango = "hoy" | "semana" | "mes" | "trimestre" | "anio" | "todo";

export type AhorroBucket = {
  id: string;
  nombre: string;
  total: number;
  casos: number;
};

export type AhorroAcumulado = {
  total: number;
  casos: number;
  rango: AhorroRango;
  bancos: AhorroBucket[];
  analistas: AhorroBucket[];
  oficinas: AhorroBucket[];
};

// Estados que cuentan como "cerrado" (fase de cierre/cobro/finalización).
const ESTADOS_CIERRE = [
  "cuenta_cobro_generada",
  "cuenta_cobro_enviada",
  "honorarios_pendientes",
  "honorarios_pagados",
  "paz_y_salvo_generado",
  "caso_finalizado",
] as const;

function inicioRango(rango: AhorroRango): string | null {
  if (rango === "todo") return null;
  const now = new Date();
  const d = new Date(now);
  switch (rango) {
    case "hoy":
      d.setHours(0, 0, 0, 0);
      break;
    case "semana":
      d.setDate(d.getDate() - 7);
      break;
    case "mes":
      d.setMonth(d.getMonth() - 1);
      break;
    case "trimestre":
      d.setMonth(d.getMonth() - 3);
      break;
    case "anio":
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d.toISOString();
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function readAhorro(propuesta: unknown): number {
  if (!propuesta || typeof propuesta !== "object") return 0;
  const o = propuesta as Record<string, unknown>;
  return num(o.ahorro) || num(o.ahorroTotal) || num(o.ahorroIntereses);
}

export const getAhorroAcumulado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rango: z
          .enum(["hoy", "semana", "mes", "trimestre", "anio", "todo"])
          .default("mes"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AhorroAcumulado> => {
    const { supabase } = context;
    const desde = inicioRango(data.rango);

    let q = supabase
      .from("expedientes")
      .select("id, banco, asesor_id, propuesta_data, updated_at, estado_caso")
      .in("estado_caso", ESTADOS_CIERRE as unknown as string[]);
    if (desde) q = q.gte("updated_at", desde);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const bancosMap = new Map<string, AhorroBucket>();
    const analistasMap = new Map<string, AhorroBucket>();
    const oficinasMap = new Map<string, AhorroBucket>();

    const asesorIds = Array.from(
      new Set((rows ?? []).map((r) => r.asesor_id).filter(Boolean) as string[]),
    );
    let profiles: Array<{ id: string; nombre: string | null; email: string | null; oficina: string | null }> = [];
    if (asesorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, email, oficina")
        .in("id", asesorIds);
      profiles = (profs ?? []) as typeof profiles;
    }
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    let total = 0;
    let casos = 0;

    for (const r of rows ?? []) {
      const ahorro = readAhorro(r.propuesta_data);
      if (ahorro <= 0) continue;
      total += ahorro;
      casos += 1;

      const bancoNombre = r.banco?.trim() || "Sin banco";
      const bb = bancosMap.get(bancoNombre) ?? {
        id: bancoNombre,
        nombre: bancoNombre,
        total: 0,
        casos: 0,
      };
      bb.total += ahorro;
      bb.casos += 1;
      bancosMap.set(bancoNombre, bb);

      if (r.asesor_id) {
        const prof = profileById.get(r.asesor_id);
        const nombre = prof?.nombre || prof?.email || "Sin asignar";
        const ab = analistasMap.get(r.asesor_id) ?? {
          id: r.asesor_id,
          nombre,
          total: 0,
          casos: 0,
        };
        ab.total += ahorro;
        ab.casos += 1;
        analistasMap.set(r.asesor_id, ab);

        const oficina = prof?.oficina?.trim() || "Sin oficina";
        const ob = oficinasMap.get(oficina) ?? {
          id: oficina,
          nombre: oficina,
          total: 0,
          casos: 0,
        };
        ob.total += ahorro;
        ob.casos += 1;
        oficinasMap.set(oficina, ob);
      }
    }

    const sortDesc = (arr: AhorroBucket[]) => arr.sort((a, b) => b.total - a.total);

    return {
      total,
      casos,
      rango: data.rango,
      bancos: sortDesc(Array.from(bancosMap.values())),
      analistas: sortDesc(Array.from(analistasMap.values())),
      oficinas: sortDesc(Array.from(oficinasMap.values())),
    };
  });
