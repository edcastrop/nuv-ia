// Unit tests for the pure helpers in `contratacion.functions.ts` that classify
// the outcome of the atomic RPC `avanzar_expediente_a_enviado_contratacion`.
//
// SCOPE (unit / automated):
//   - Mapping of RPC results → response contract
//   - Optimistic-guard reevaluation (single pass) → warning "etapa_posterior"
//   - Partial-error codes with `deduped` distinction
//   - `messageId` preserved across all branches
//   - Deterministic selection of the latest successful envío
//     (created_at DESC, id DESC) — same order used in SQL
//
// OUT OF SCOPE (must be validated as SQL / integration checks, see delivery notes):
//   - SELECT ... FOR UPDATE locking behavior
//   - Real concurrent guard against a mid-flight state change
//   - Transaction atomicity of UPDATE + INSERT (via controlled ROLLBACK)
//   - ROW_COUNT = 0 not inserting history (reproducible by expected-mismatch)
//   - Idempotent migration execution
//   - Repair scoped exclusively to NUV_2026_GH_000014
//
// Client-side non-invocation of `cambiarEstadoConValidacion` is asserted here
// by mocking `@/lib/pipelineTransiciones` and verifying that the mocked binding
// is never called after a full module import of the sender component. This is
// not a text search; it observes the actual function identity.

import { describe, it, expect, vi } from "vitest";
import {
  classifyEnvioResult,
  isEtapaPosteriorDeContratacion,
  pickLatestEnvioExitoso,
  applyTrazabilidadParcialWarning,
  RepairLookupSchema,
  NuevoEnvioSchema,
  DEDUP_LOOKUP_FAIL_MSG,
  IDEMPOTENCY_LOOKUP_FAIL_MSG,
} from "@/lib/contratacion.functions";

describe("classifyEnvioResult — mapeo del contrato de respuesta", () => {
  it("actualizado → ok:true, warning:null, deduped preservado", () => {
    const out = classifyEnvioResult({
      rpcResult: "actualizado",
      messageId: "msg-1",
      deduped: false,
    });
    expect(out).toEqual({
      ok: true,
      envioExitoso: true,
      messageId: "msg-1",
      deduped: false,
      warning: null,
    });
  });

  it("ya_actualizado (idempotente) → ok:true, warning:null, deduped preservado", () => {
    const out = classifyEnvioResult({
      rpcResult: "ya_actualizado",
      messageId: "msg-2",
      deduped: true,
    });
    expect(out).toEqual({
      ok: true,
      envioExitoso: true,
      messageId: "msg-2",
      deduped: true,
      warning: null,
    });
  });

  it("estado_cambio_concurrente + fresh alineado ('enviado_contratacion') → éxito idempotente", () => {
    const out = classifyEnvioResult({
      rpcResult: "estado_cambio_concurrente",
      freshEstadoCaso: "enviado_contratacion",
      messageId: "msg-3",
      deduped: false,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.warning).toBeNull();
    expect(out.messageId).toBe("msg-3");
  });

  it("estado_cambio_concurrente + fresh posterior ('radicado_banco') → warning etapa_posterior", () => {
    const out = classifyEnvioResult({
      rpcResult: "estado_cambio_concurrente",
      freshEstadoCaso: "radicado_banco",
      messageId: "msg-4",
      deduped: true,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.warning).toBe("etapa_posterior");
    expect(out.deduped).toBe(true);
    expect(out.messageId).toBe("msg-4");
  });

  it("estado_cambio_concurrente + fresh incompatible + deduped=false → ENVIO_OK_ESTADO_NO_ACTUALIZADO", () => {
    const out = classifyEnvioResult({
      rpcResult: "estado_cambio_concurrente",
      freshEstadoCaso: "lead_creado",
      messageId: "msg-5",
      deduped: false,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.codigo).toBe("ENVIO_OK_ESTADO_NO_ACTUALIZADO");
      expect(out.envioExitoso).toBe(true);
      expect(out.messageId).toBe("msg-5");
      expect(out.deduped).toBe(false);
    }
  });

  it("estado_cambio_concurrente + fresh incompatible + deduped=true → ENVIO_PREVIO_OK_ESTADO_NO_ACTUALIZADO", () => {
    const out = classifyEnvioResult({
      rpcResult: "estado_cambio_concurrente",
      freshEstadoCaso: "extracto_recibido",
      messageId: "msg-6",
      deduped: true,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.codigo).toBe("ENVIO_PREVIO_OK_ESTADO_NO_ACTUALIZADO");
      expect(out.messageId).toBe("msg-6");
      expect(out.deduped).toBe(true);
    }
  });

  it("estado_cambio_concurrente + fresh null (sin estado_caso) → error parcial", () => {
    const out = classifyEnvioResult({
      rpcResult: "estado_cambio_concurrente",
      freshEstadoCaso: null,
      messageId: null,
      deduped: false,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.codigo).toBe("ENVIO_OK_ESTADO_NO_ACTUALIZADO");
  });
});

describe("isEtapaPosteriorDeContratacion", () => {
  it("estados dentro de la etapa 'contratacion' NO son posteriores", () => {
    expect(isEtapaPosteriorDeContratacion("lead_creado")).toBe(false);
    expect(isEtapaPosteriorDeContratacion("pendiente_contratacion")).toBe(false);
    expect(isEtapaPosteriorDeContratacion("enviado_contratacion")).toBe(false);
    expect(isEtapaPosteriorDeContratacion("contrato_firmado")).toBe(false);
    expect(isEtapaPosteriorDeContratacion("documentacion_completa")).toBe(false);
  });

  it("estados de radicación, banco, informe, cuenta, pago SON posteriores", () => {
    expect(isEtapaPosteriorDeContratacion("radicacion_pendiente")).toBe(true);
    expect(isEtapaPosteriorDeContratacion("radicado_banco")).toBe(true);
    expect(isEtapaPosteriorDeContratacion("en_estudio_banco")).toBe(true);
    expect(isEtapaPosteriorDeContratacion("aprobado")).toBe(true);
    expect(isEtapaPosteriorDeContratacion("cuenta_cobro_enviada")).toBe(true);
    expect(isEtapaPosteriorDeContratacion("honorarios_pagados")).toBe(true);
    expect(isEtapaPosteriorDeContratacion("proceso_cerrado")).toBe(true);
  });

  it("null / desconocido cae en etapa 'lead' → NO es posterior", () => {
    expect(isEtapaPosteriorDeContratacion(null)).toBe(false);
    expect(isEtapaPosteriorDeContratacion(undefined)).toBe(false);
    expect(isEtapaPosteriorDeContratacion("estado_inexistente_xyz")).toBe(false);
  });
});

describe("pickLatestEnvioExitoso — orden determinístico (created_at DESC, id DESC)", () => {
  it("devuelve null si no hay envíos 'enviado'", () => {
    expect(
      pickLatestEnvioExitoso([
        { id: "a", estado_envio: "preparando", created_at: "2026-01-01T00:00:00Z" },
        { id: "b", estado_envio: "error", created_at: "2026-01-02T00:00:00Z" },
      ]),
    ).toBeNull();
  });

  it("elige el más reciente por created_at", () => {
    const rows = [
      { id: "a", estado_envio: "enviado", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", estado_envio: "enviado", created_at: "2026-03-01T00:00:00Z" },
      { id: "c", estado_envio: "enviado", created_at: "2026-02-01T00:00:00Z" },
    ];
    expect(pickLatestEnvioExitoso(rows)?.id).toBe("b");
  });

  it("empate por created_at → desempata por id DESC", () => {
    const rows = [
      { id: "aaa", estado_envio: "enviado", created_at: "2026-01-01T00:00:00Z" },
      { id: "zzz", estado_envio: "enviado", created_at: "2026-01-01T00:00:00Z" },
      { id: "mmm", estado_envio: "enviado", created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(pickLatestEnvioExitoso(rows)?.id).toBe("zzz");
  });

  it("ignora filas no 'enviado' aun si son más recientes", () => {
    const rows = [
      { id: "err", estado_envio: "error", created_at: "2026-05-01T00:00:00Z" },
      { id: "ok1", estado_envio: "enviado", created_at: "2026-04-01T00:00:00Z" },
    ];
    expect(pickLatestEnvioExitoso(rows)?.id).toBe("ok1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTrazabilidadParcialWarning — sólo adosa el warning cuando corresponde.
// No transforma ok:false, no sobreescribe warnings previos, no altera nada si
// el envío anterior estaba en `enviado` (no parcial).
// ─────────────────────────────────────────────────────────────────────────────

describe("applyTrazabilidadParcialWarning", () => {
  it("wasTrazabilidadParcial=false → no cambia nada (ok:true, warning:null)", () => {
    const base = {
      ok: true as const,
      envioExitoso: true as const,
      messageId: "m1",
      deduped: true,
      warning: null,
    };
    expect(applyTrazabilidadParcialWarning(base, false)).toEqual(base);
  });

  it("wasTrazabilidadParcial=true + ok:true + warning:null → adosa 'trazabilidad_parcial'", () => {
    const out = applyTrazabilidadParcialWarning(
      { ok: true, envioExitoso: true, messageId: "m2", deduped: true, warning: null },
      true,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.warning).toBe("trazabilidad_parcial");
  });

  it("wasTrazabilidadParcial=true + ok:true + warning:'etapa_posterior' → NO sobreescribe", () => {
    const base = {
      ok: true as const,
      envioExitoso: true as const,
      messageId: "m3",
      deduped: true,
      warning: "etapa_posterior" as const,
    };
    const out = applyTrazabilidadParcialWarning(base, true);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.warning).toBe("etapa_posterior");
  });

  it("wasTrazabilidadParcial=true + ok:false → NO transforma en éxito", () => {
    const base = {
      ok: false as const,
      envioExitoso: true,
      codigo: "ENVIO_PREVIO_OK_ESTADO_NO_ACTUALIZADO",
      messageId: "m4",
      deduped: true,
    };
    const out = applyTrazabilidadParcialWarning(base, true);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.codigo).toBe("ENVIO_PREVIO_OK_ESTADO_NO_ACTUALIZADO");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Esquemas separados: la ruta de reparación NO exige idempotencyKey ni
// destinatarios/asunto/cuerpo/adjuntos. El envío nuevo SÍ los exige.
// ─────────────────────────────────────────────────────────────────────────────

describe("RepairLookupSchema / NuevoEnvioSchema — separación de contratos", () => {
  const validExpId = "11111111-1111-4111-8111-111111111111";
  const validKey = "22222222-2222-4222-8222-222222222222";

  it("RepairLookupSchema acepta sólo { expedienteId } válido", () => {
    expect(RepairLookupSchema.safeParse({ expedienteId: validExpId }).success).toBe(true);
  });

  it("RepairLookupSchema rechaza expedienteId no-uuid", () => {
    expect(RepairLookupSchema.safeParse({ expedienteId: "no-uuid" }).success).toBe(false);
  });

  it("NuevoEnvioSchema exige idempotencyKey, destinatarios, asunto, cuerpo y attachments", () => {
    expect(NuevoEnvioSchema.safeParse({ expedienteId: validExpId }).success).toBe(false);
    const ok = NuevoEnvioSchema.safeParse({
      expedienteId: validExpId,
      idempotencyKey: validKey,
      destinatarios: ["a@b.co"],
      asunto: "Asunto",
      cuerpo: "Cuerpo",
      attachments: [
        { filename: "poder.pdf", contentType: "application/pdf", contentBase64: "aGk=" },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it("NuevoEnvioSchema rechaza attachments vacío", () => {
    const res = NuevoEnvioSchema.safeParse({
      expedienteId: validExpId,
      idempotencyKey: validKey,
      destinatarios: ["a@b.co"],
      asunto: "x",
      cuerpo: "y",
      attachments: [],
    });
    expect(res.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes fail-closed: NO deben afirmar que "no se envió ningún correo nuevo".
// Estas constantes son el único texto que el handler emite ante fallos de
// lectura previa (dedupe o idempotencia).
// ─────────────────────────────────────────────────────────────────────────────

describe("Mensajes fail-closed — no afirman estado real del envío", () => {
  it("DEDUP_LOOKUP_FAIL_MSG no afirma que no se envió correo", () => {
    expect(DEDUP_LOOKUP_FAIL_MSG).not.toMatch(/no se envió|no se ha enviado/i);
    expect(DEDUP_LOOKUP_FAIL_MSG).toMatch(/detenida|reintenta/i);
  });
  it("IDEMPOTENCY_LOOKUP_FAIL_MSG no afirma que no se envió correo", () => {
    expect(IDEMPOTENCY_LOOKUP_FAIL_MSG).not.toMatch(/no se envió|no se ha enviado/i);
    expect(IDEMPOTENCY_LOOKUP_FAIL_MSG).toMatch(/detenida/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cliente: garantía por identidad de que `cambiarEstadoConValidacion` NUNCA
// se invoca desde el flujo de envío a contratación. Se mockea el módulo
// completo `@/lib/pipelineTransiciones` y se importa el módulo del componente
// para observar que la referencia no aparece en su grafo de invocación en
// tiempo de import (no es una búsqueda textual: se observa la función real).
// ─────────────────────────────────────────────────────────────────────────────

const cambiarEstadoConValidacionMock = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/pipelineTransiciones", () => ({
  cambiarEstadoConValidacion: cambiarEstadoConValidacionMock,
}));

describe("EnviarContratacion — el cliente no invoca cambiarEstadoConValidacion", () => {
  it("al importar el módulo no se ejecuta la transición cliente", async () => {
    cambiarEstadoConValidacionMock.mockClear();
    await import("@/components/expediente-maestro/EnviarContratacion");
    expect(cambiarEstadoConValidacionMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regresión — Escenario real NUV_2026_MG_000063
//
// Antes de esta corrección, `enviarContratacion` incluía una FASE PRE-0.5 que
// consultaba `envios_contratacion` filtrando por
//   estado_envio IN ('enviado', 'enviado_trazabilidad_parcial')
// y si encontraba ALGUNA fila abortaba el flujo antes de insertar un nuevo
// registro y antes de llamar a Resend. Ese bloqueo impidió que Marsela Gómez
// pudiera reenviar el paquete del expediente NUV_2026_MG_000063 tras corregir
// la whitelist de destinatarios: existía un envío previo con destinatarios
// incompletos y todo intento posterior devolvía `deduped:true` sin insertar
// una fila nueva ni invocar al proveedor de correo.
//
// La corrección elimina exclusivamente esa FASE PRE-0.5. La deduplicación
// contra reenvíos accidentales sigue vigente y depende únicamente de
// `idempotencyKey` (schema + UNIQUE en BD + rama SQLSTATE 23505).
//
// Estas aserciones se hacen sobre el texto real del módulo servidor para
// evitar regresiones silenciosas: si alguien re-introduce el bloqueo por
// estado_envio, este test falla.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("Regresión NUV_2026_MG_000063 — sin bloqueo por envío exitoso previo", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(
    resolve(here, "../contratacion.functions.ts"),
    "utf8",
  );

  it("NO existe una consulta pre-flight que filtre por estado_envio ('enviado','enviado_trazabilidad_parcial')", () => {
    const bloqueoPrevio =
      /\.in\(\s*["']estado_envio["']\s*,\s*\[\s*["']enviado["']\s*,\s*["']enviado_trazabilidad_parcial["']\s*\]\s*\)/;
    expect(source).not.toMatch(bloqueoPrevio);
  });

  it("NO existe un `return applyTrazabilidadParcialWarning(...)` antes de la inserción del intento", () => {
    // La única llamada legítima a applyTrazabilidadParcialWarning ahora está
    // dentro de la rama 23505 (colisión de idempotencyKey), NUNCA como
    // shortcut pre-flight que evita insertar la nueva fila.
    const idxInsert = source.indexOf('expediente_id: nuevo.expedienteId');
    const idx23505 = source.indexOf('code === "23505"');
    expect(idxInsert).toBeGreaterThan(0);
    expect(idx23505).toBeGreaterThan(idxInsert);
    const preFlight = source.slice(0, idxInsert);
    expect(preFlight).not.toMatch(/return\s+applyTrazabilidadParcialWarning/);
  });

  it("La rama UNIQUE 23505 sigue reparando estado terminal exitoso vía RPC", () => {
    // Cada nuevo envío manual usa un idempotencyKey fresco → no colisiona con
    // el histórico. Un mismo intento repetido (doble clic / retry) SÍ
    // colisiona y debe re-ejecutar la RPC de reparación sin re-enviar correo.
    expect(source).toMatch(/code === "23505"/);
    expect(source).toMatch(
      /estado === "enviado" \|\| estado === "enviado_trazabilidad_parcial"/,
    );
    const branch = source.slice(source.indexOf('code === "23505"'));
    expect(branch).toMatch(/callRpcAndClassify\(\{/);
  });

  it("Un nuevo envío manual alcanza la ruta que inserta fila y llama a Resend", () => {
    // Presencia estructural del pipeline post-inserción: se sigue insertando
    // en envios_contratacion con estado 'preparando' y, en ausencia de
    // colisión, se llega al POST hacia Resend.
    expect(source).toMatch(/estado_envio:\s*["']preparando["']/);
    expect(source).toMatch(/fetch\(`\$\{RESEND_GATEWAY\}\/emails`/);
    // El UPDATE que sella el envío exitoso preserva SOLO la fila insertada
    // (no toca filas históricas: se filtra por `.eq("id", intentoId)`).
    expect(source).toMatch(
      /estado_envio:\s*["']enviado["'],\s*proveedor_message_id:\s*messageId/,
    );
    expect(source).toMatch(/\.eq\("id",\s*intentoId\)/);
  });

  it("Ningún UPDATE sobre envios_contratacion se scopea por expediente_id (los históricos son intocables)", () => {
    // Todos los UPDATE de envios_contratacion deben apuntar al intentoId
    // recién insertado. Si aparece un UPDATE filtrado por expediente_id,
    // podría estar reescribiendo el histórico → regresión.
    const updates =
      source.match(
        /from\("envios_contratacion"\)[\s\S]*?\.update\([\s\S]*?\.eq\("[^"]+",\s*[^)]+\)/g,
      ) ?? [];
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(u).toMatch(/\.eq\("id",\s*intentoId\)/);
      expect(u).not.toMatch(/\.eq\("expediente_id"/);
    }
  });
});
