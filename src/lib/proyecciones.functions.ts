// Server functions para el módulo de PROYECCIONES bancarias.
// El analista sube las proyecciones del banco (PDF, Excel, imágenes, o ZIP
// que las contenga). NUVIA extrae los campos clave y los puede fusionar
// contra el extracto para continuar el dictamen.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CrearRegistroSchema = z.object({
  expedienteId: z.string().uuid(),
  archivoNombre: z.string().min(1).max(300),
  archivoPath: z.string().min(1).max(500),
  mime: z.string().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  origenZip: z.string().max(300).nullable().optional(),
  passwordUsada: z.boolean().default(false),
});

export const crearRegistroProyeccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CrearRegistroSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("expediente_proyecciones")
      .insert({
        expediente_id: data.expedienteId,
        archivo_nombre: data.archivoNombre,
        archivo_path: data.archivoPath,
        mime: data.mime,
        size_bytes: data.sizeBytes ?? null,
        origen_zip: data.origenZip ?? null,
        password_usada: data.passwordUsada,
        status: "pendiente",
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const guardarDatosProyeccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      datos: z.record(z.unknown()),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("expediente_proyecciones")
      .update({
        datos: data.datos,
        status: "analizado",
        parsed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarErrorProyeccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), error: z.string().min(1).max(800) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("expediente_proyecciones")
      .update({ status: "error", error: data.error })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarProyecciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ expedienteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("expediente_proyecciones")
      .select("id,archivo_nombre,archivo_path,mime,size_bytes,origen_zip,password_usada,status,error,datos,parsed_at,created_at")
      .eq("expediente_id", data.expedienteId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const eliminarProyeccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("expediente_proyecciones")
      .select("archivo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.archivo_path) {
      await context.supabase.storage.from("proyecciones-banco").remove([row.archivo_path]).catch(() => null);
    }
    const { error } = await context.supabase
      .from("expediente_proyecciones")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const urlFirmadaProyeccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("proyecciones-banco")
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// Fusiona los datos analizados de las proyecciones contra el ÚLTIMO
// extracto del expediente y reejecuta la auditoría QA. Sólo sobre-escribe
// campos que vengan con valor en la proyección — los del extracto se
// preservan cuando la proyección no aporta valor nuevo.
const FUSIONABLES = [
  "saldoCapital",
  "valorDesembolsado",
  "cuotaMensual",
  "cuotaActual",
  "cuotaSinSeguros",
  "cuotaConInteresSinSeguros",
  "cuotaSinSubsidio",
  "cuotaPagadaCliente",
  "valorAPagar",
  "seguros",
  "tea",
  "teaCobrada",
  "teaPactada",
  "tasaMensual",
  "plazoInicial",
  "cuotasPagadas",
  "cuotasPendientes",
  "valorUVR",
  "saldoUVR",
  "valorCobertura",
  "tasaCobertura",
  "tieneCobertura",
  "tipoBeneficio",
  "moneda",
  "banco",
  "producto",
] as const;

function noVacio(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "" && v.trim() !== "0";
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  return true;
}

export const fusionarConExtractoYReauditar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      expedienteId: z.string().uuid(),
      proyeccionIds: z.array(z.string().uuid()).min(1).max(10),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: proys, error: errP } = await supabase
      .from("expediente_proyecciones")
      .select("id,datos,status")
      .in("id", data.proyeccionIds);
    if (errP) throw new Error(errP.message);
    const valid = (proys ?? []).filter((p) => p.status === "analizado" && p.datos);
    if (!valid.length) {
      throw new Error("Ninguna proyección está analizada todavía. Espera a que NUVIA termine la lectura.");
    }

    // Fusión: última proyección manda sobre las anteriores cuando hay conflicto.
    const fusion: Record<string, unknown> = {};
    for (const p of valid) {
      const d = (p.datos ?? {}) as Record<string, unknown>;
      for (const k of FUSIONABLES) {
        const v = d[k];
        if (noVacio(v)) fusion[k] = v;
      }
    }

    const { data: ext, error: errE } = await supabase
      .from("extractos_lecturas")
      .select("id,datos")
      .eq("expediente_id", data.expedienteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errE) throw new Error(errE.message);
    if (!ext) {
      throw new Error("Este expediente aún no tiene un extracto cargado contra el cual fusionar.");
    }

    const datosBase = (ext.datos ?? {}) as Record<string, unknown>;
    const datosNuevos: Record<string, unknown> = { ...datosBase };
    for (const [k, v] of Object.entries(fusion)) {
      if (noVacio(v)) datosNuevos[k] = v;
    }
    datosNuevos.proyeccionesAplicadas = data.proyeccionIds;
    datosNuevos.proyeccionesAplicadasAt = new Date().toISOString();

    const { error: errU } = await supabase
      .from("extractos_lecturas")
      .update({ datos: datosNuevos })
      .eq("id", ext.id);
    if (errU) throw new Error(errU.message);

    return { ok: true, extractoLecturaId: ext.id as string, camposFusionados: Object.keys(fusion) };
  });
