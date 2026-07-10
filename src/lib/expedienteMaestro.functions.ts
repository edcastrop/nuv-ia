import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  maestroToExpediente,
  camposFaltantesParaOperativo,
  mergeMeaningful,
  type ClienteMaestro,
  type CotitularMaestro,
  type CreditoMaestro,
  type AsesorMaestro,
  type LicenciadoMaestro,
  type ApoderadoMaestro,
  type ExpedienteMaestro,
} from "@/lib/expedienteMaestro";
import type { CoberturaFresh } from "@/lib/proyeccion";
import type { Expediente } from "@/lib/expedientes";

/**
 * Server function que ejecuta EN UNA SOLA IDENTIDAD verificada por JWT
 * la creación (o recuperación) del `expediente_maestro` y del `expedientes`
 * operativo asociado.
 *
 * Corrige la clase de bug demostrada por la auditoría: cuando el flujo
 * de certificación se ejecutaba en el cliente, `supabase.auth.getUser()`
 * podía reflejar una sesión distinta a la del analista que realmente
 * certificó (sesión compartida cross-tab, refresh de token, etc.),
 * dejando `expediente_maestro.asesor_id` o `expedientes.asesor_id` con
 * la identidad equivocada.
 *
 * Aquí `context.userId` es el `sub` del JWT validado por
 * `requireSupabaseAuth` para esta request, es inmutable, y se aplica
 * como `asesor_id` a AMBAS operaciones.
 */

export interface CertificarExpedienteInput {
  maestro: {
    cliente: ClienteMaestro;
    cotitular: CotitularMaestro;
    credito: CreditoMaestro;
    fresh: CoberturaFresh;
    asesor: AsesorMaestro;
    licenciado: LicenciadoMaestro;
    apoderado: ApoderadoMaestro;
  };
  auditoriaId?: string | null;
}

export interface CertificarExpedienteResult {
  maestro: ExpedienteMaestro;
  expediente: Expediente;
}

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeDigits = (value: unknown) => normalizeText(value).replace(/\D/g, "");

export const certificarExpedienteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CertificarExpedienteInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = data.maestro;

    // ─────────────────────────────────────────────────────────────
    // 1) UPSERT expediente_maestro con dedup por huella completa.
    //    Mismo comportamiento que `upsertMaestro` cliente, pero
    //    `asesor_id = userId` (JWT server-side, inmutable).
    // ─────────────────────────────────────────────────────────────
    const findExistingByFingerprint = async (): Promise<ExpedienteMaestro | null> => {
      const credito = (p.credito ?? {}) as unknown as Record<string, unknown>;
      const cedula = normalizeText(p.cliente?.cedula);
      const cedulaNorm = normalizeDigits(cedula);
      const numeroCredito = normalizeText(credito.numeroCredito);
      const creditoNorm = normalizeDigits(numeroCredito);
      const banco = normalizeText(credito.banco).toLowerCase();
      const nombre = normalizeText(p.cliente?.nombre);
      if (!cedulaNorm && !creditoNorm && !nombre) return null;

      let q = supabase
        .from("expediente_maestro")
        .select("*")
        .eq("asesor_id", userId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (cedula) q = q.eq("cedula_cliente", cedula);

      const { data: rows } = await q;
      const match = (rows ?? []).find((r) => {
        const rr = r as unknown as {
          nombre_cliente?: string | null;
          credito?: Record<string, unknown> | null;
        };
        const rc = (rr.credito ?? {}) as Record<string, unknown>;
        const rCreditoNorm = normalizeDigits(rc.numeroCredito);
        const rBanco = normalizeText(rc.banco).toLowerCase();
        const rCedulaNorm = normalizeDigits(
          (r as { cedula_cliente?: string | null }).cedula_cliente,
        );
        const rNombre = normalizeText(rr.nombre_cliente).toLowerCase();
        if (cedulaNorm && rCedulaNorm && cedulaNorm !== rCedulaNorm) return false;
        if (creditoNorm && rCreditoNorm && banco && rBanco)
          return creditoNorm === rCreditoNorm && banco === rBanco;
        if (creditoNorm && rCreditoNorm) return creditoNorm === rCreditoNorm;
        if (cedulaNorm && banco && rBanco) return banco === rBanco;
        return !!nombre && rNombre === nombre.toLowerCase() && (!banco || rBanco === banco);
      });
      return (match ?? null) as ExpedienteMaestro | null;
    };

    const row = {
      asesor_id: userId,
      cedula_cliente: p.cliente.cedula || null,
      nombre_cliente: p.cliente.nombre || "Sin nombre",
      cliente: p.cliente as unknown as never,
      cotitular: p.cotitular as unknown as never,
      credito: p.credito as unknown as never,
      fresh: p.fresh as unknown as never,
      asesor: p.asesor as unknown as never,
      licenciado: p.licenciado as unknown as never,
      apoderado: p.apoderado as unknown as never,
    };

    let maestro: ExpedienteMaestro | null = null;
    try {
      const match = await findExistingByFingerprint();
      if (match) {
        console.warn("[certificarExpedienteServer] dedup: reutilizando maestro", match.id);
        maestro = match;
      }
    } catch (dedupErr) {
      console.warn("[certificarExpedienteServer] dedup falló, procedo a insertar:", dedupErr);
    }

    if (!maestro) {
      const { data: inserted, error } = await supabase
        .from("expediente_maestro")
        .insert(row)
        .select()
        .single();
      if (error) {
        const raced = await findExistingByFingerprint();
        if (raced) maestro = raced;
        else throw error;
      } else {
        maestro = inserted as unknown as ExpedienteMaestro;
      }
    }

    if (!maestro) throw new Error("No se pudo crear ni recuperar el expediente maestro");

    // ─────────────────────────────────────────────────────────────
    // 2) SELECT existente / INSERT `expedientes` operativo con el
    //    MISMO `userId` verificado. Ninguna llamada a auth.getUser().
    // ─────────────────────────────────────────────────────────────
    const { data: existing, error: existingError } = await supabase
      .from("expedientes")
      .select("*")
      .eq("id", maestro.id)
      .maybeSingle();
    if (existingError) throw existingError;

    const exp = maestroToExpediente(maestro, maestro.id) as unknown as Expediente;

    if (existing) {
      const patch = {
        cliente_nombre:
          exp.cliente_nombre && exp.cliente_nombre !== "Sin nombre"
            ? exp.cliente_nombre
            : existing.cliente_nombre,
        cedula: exp.cedula || existing.cedula,
        banco: exp.banco || existing.banco,
        numero_credito: exp.numero_credito || existing.numero_credito,
        producto: exp.producto || existing.producto,
        cliente_data: mergeMeaningful(
          (existing.cliente_data ?? {}) as Record<string, unknown>,
          exp.cliente_data as unknown as Record<string, unknown>,
        ) as never,
        credito_data: mergeMeaningful(
          (existing.credito_data ?? {}) as Record<string, unknown>,
          exp.credito_data as unknown as Record<string, unknown>,
        ) as never,
      };
      const { data: updated, error: updateError } = await supabase
        .from("expedientes")
        .update(patch as never)
        .eq("id", maestro.id)
        .select("*")
        .maybeSingle();
      const expediente = (updateError ? existing : updated ?? existing) as unknown as Expediente;
      return { maestro, expediente };
    }

    const nombreCliente = String(maestro.cliente?.nombre || maestro.nombre_cliente || "").trim();
    if (!nombreCliente || nombreCliente.toLowerCase() === "sin nombre") {
      throw new Error(
        "El expediente operativo se creará cuando completes el nombre del cliente.",
      );
    }
    const faltantes = camposFaltantesParaOperativo(maestro);
    if (faltantes.length > 0) {
      throw new Error(
        `El expediente operativo se creará cuando completes: ${faltantes.join(", ")}.`,
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("expedientes")
      .insert({
        id: maestro.id,
        asesor_id: userId,
        modo: exp.modo,
        cliente_nombre: exp.cliente_nombre,
        cedula: exp.cedula,
        banco: exp.banco,
        numero_credito: exp.numero_credito,
        producto: exp.producto,
        cliente_data: exp.cliente_data as unknown as never,
        credito_data: exp.credito_data as unknown as never,
        propuesta_data: exp.propuesta_data as unknown as never,
        discount_data: exp.discount_data as unknown as never,
        honorarios_base: exp.honorarios_base,
        honorarios_final: exp.honorarios_final,
        descuento: exp.descuento,
        qa_auditoria_id: data.auditoriaId ?? null,
      } as never)
      .select("*")
      .single();

    if (insertError) {
      const { data: raced } = await supabase
        .from("expedientes")
        .select("*")
        .eq("id", maestro.id)
        .maybeSingle();
      if (raced) return { maestro, expediente: raced as unknown as Expediente };
      throw insertError;
    }

    return { maestro, expediente: created as unknown as Expediente };
  });
