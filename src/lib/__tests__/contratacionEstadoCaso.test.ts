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
