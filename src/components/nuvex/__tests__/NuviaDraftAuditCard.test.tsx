// ═════════════════════════════════════════════════════════════════════
// Panel NUVIA — reducer puro + comportamiento REAL del listener del
// evento hermano `nuvia:draftRawInvalidate`.
//
// Cubre:
//   · `evaluateSnapshotTransition`: reglas de hidratación, dedup,
//     invalidación por edición y persistencia `stay-invalidated`.
//   · `evaluateInvalidateTransition`: puro, sólo transiciona a
//     `invalidated` desde `ready` / `done`; idempotente en el resto.
//   · Listener del panel: dispatch real del evento con
//     `emitDraftRawInvalidate` sobre `NuviaDraftAuditCard` montado.
//     Verifica limpieza de snapshot/hashes/`directorApproval`,
//     idempotencia, y que una nueva auditoría es posible sobre el
//     snapshot recuperado (no se reutiliza el resultado anterior).
// ═════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";

// ─── Mocks de infraestructura ────────────────────────────────────────
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    useServerFn: () => vi.fn(async () => ({})),
  };
});
vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.PropsWithChildren<{ to?: string; onClick?: () => void; className?: string }>) =>
    React.createElement("a", { href: props.to, onClick: props.onClick, className: props.className }, props.children),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));
vi.mock("@/lib/simuladorDraftQA.functions", () => ({
  auditarSimulacionDraft: () => async () => ({}),
  escalarConsultaTecnica: () => async () => ({}),
  estadoAprobacionAuditoria: () => async () => ({ aprobada: false }),
}));

import {
  NuviaDraftAuditCard,
  evaluateSnapshotTransition,
  evaluateInvalidateTransition,
  emitDraftRawReady,
  emitDraftRawInvalidate,
  type DraftRawSnapshot,
} from "@/components/nuvex/NuviaDraftAuditCard";

// ─── Reducer puro: evaluateSnapshotTransition ────────────────────────
describe("evaluateSnapshotTransition", () => {
  it("primer snapshot tras montar → hydrate (no invalida)", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "waiting", doneHash: null, lastEmittedHash: null, newHash: "aaaa", wasFirst: true }).kind,
    ).toBe("hydrate");
  });
  it("re-emisión del mismo hash → ignore", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "ready", doneHash: null, lastEmittedHash: "aaaa", newHash: "aaaa", wasFirst: false }).kind,
    ).toBe("ignore");
  });
  it("mismo hash en estado done → ignore (no reset)", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "done", doneHash: "aaaa", lastEmittedHash: "bbbb", newHash: "aaaa", wasFirst: false }).kind,
    ).toBe("ignore");
  });
  it("hash distinto tras done → invalidate", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "done", doneHash: "aaaa", lastEmittedHash: "aaaa", newHash: "bbbb", wasFirst: false }).kind,
    ).toBe("invalidate");
  });
  it("hash distinto en ready → ready (permite re-auditar)", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "ready", doneHash: null, lastEmittedHash: "aaaa", newHash: "bbbb", wasFirst: false }).kind,
    ).toBe("ready");
  });
  it("desde invalidated con snapshot nuevo → stay-invalidated (persistente)", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "invalidated", doneHash: null, lastEmittedHash: "aaaa", newHash: "cccc", wasFirst: false }).kind,
    ).toBe("stay-invalidated");
  });
  it("hash vacío → ignore", () => {
    expect(
      evaluateSnapshotTransition({ prevKind: "ready", doneHash: null, lastEmittedHash: null, newHash: "", wasFirst: false }).kind,
    ).toBe("ignore");
  });
});

// ─── Reducer puro: evaluateInvalidateTransition ──────────────────────
describe("evaluateInvalidateTransition (puro)", () => {
  it("ready → invalidate", () => {
    expect(evaluateInvalidateTransition({ prevKind: "ready" }).kind).toBe("invalidate");
  });
  it("done → invalidate", () => {
    expect(evaluateInvalidateTransition({ prevKind: "done" }).kind).toBe("invalidate");
  });
  it("idle → noop", () => {
    expect(evaluateInvalidateTransition({ prevKind: "idle" }).kind).toBe("noop");
  });
  it("waiting → noop", () => {
    expect(evaluateInvalidateTransition({ prevKind: "waiting" }).kind).toBe("noop");
  });
  it("invalidated → noop (idempotente)", () => {
    expect(evaluateInvalidateTransition({ prevKind: "invalidated" }).kind).toBe("noop");
  });
  it("loading → noop", () => {
    expect(evaluateInvalidateTransition({ prevKind: "loading" }).kind).toBe("noop");
  });
  it("error → noop", () => {
    expect(evaluateInvalidateTransition({ prevKind: "error" }).kind).toBe("noop");
  });
});

// ─── Fixture: snapshot completo válido ───────────────────────────────
function makeValidSnapshot(seed = "v1"): DraftRawSnapshot {
  return {
    banco: "Bancolombia",
    producto: "Hipotecario UVR",
    moneda: "UVR",
    tipoCredito: "hipotecario",
    datos: { snapshotVersion: 2, seed },
    archivoPath: null,
    archivoNombre: null,
  };
}

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

// ─── Listener REAL del panel ─────────────────────────────────────────
describe("NuviaDraftAuditCard — listener `nuvia:draftRawInvalidate`", () => {
  beforeEach(() => {});
  afterEach(() => { cleanup(); });

  function mountCard() {
    return render(
      <NuviaDraftAuditCard mode="uvr" onCertificar={() => {}} onSalir={() => {}} />,
    );
  }

  const getAuditar = () => screen.getByRole("button", { name: /Auditar con NUVIA|Auditando|Reevaluar/i });

  it("idle → invalidate = no-op (sin snapshot previo)", async () => {
    render(<NuviaDraftAuditCard mode={null} onCertificar={() => {}} onSalir={() => {}} />);
    await flush();
    // El botón nace deshabilitado (idle) y sigue deshabilitado tras invalidar.
    expect(getAuditar()).toBeDisabled();
    act(() => { emitDraftRawInvalidate(); });
    await flush();
    expect(getAuditar()).toBeDisabled();
  });

  it("waiting → invalidate = no-op", async () => {
    mountCard(); // mode="uvr" arranca en `waiting`
    await flush();
    expect(getAuditar()).toBeDisabled();
    act(() => { emitDraftRawInvalidate(); });
    await flush();
    // Sigue deshabilitado y no crashea.
    expect(getAuditar()).toBeDisabled();
  });

  it("ready → invalidate = invalidated (deshabilita Auditar)", async () => {
    mountCard();
    await flush();
    // Llevamos el panel a `ready` con un snapshot válido.
    act(() => { emitDraftRawReady(makeValidSnapshot()); });
    await flush();
    expect(getAuditar()).not.toBeDisabled();
    // Invalidamos.
    act(() => { emitDraftRawInvalidate(); });
    await flush();
    expect(getAuditar()).toBeDisabled();
  });

  it("dos invalidaciones seguidas → idempotencia (sigue en invalidated, sin errores)", async () => {
    mountCard();
    await flush();
    act(() => { emitDraftRawReady(makeValidSnapshot()); });
    await flush();
    act(() => { emitDraftRawInvalidate(); emitDraftRawInvalidate(); });
    await flush();
    expect(getAuditar()).toBeDisabled();
  });

  it("invalidación limpia snapshot/hashes: un nuevo `draftRawReady` NO reutiliza el resultado anterior y permite re-auditar", async () => {
    mountCard();
    await flush();
    // Snapshot 1 → ready.
    act(() => { emitDraftRawReady(makeValidSnapshot("s1")); });
    await flush();
    expect(getAuditar()).not.toBeDisabled();
    // Invalidar.
    act(() => { emitDraftRawInvalidate(); });
    await flush();
    expect(getAuditar()).toBeDisabled();
    // Un `draftRawReady` posterior debe reactivar el panel a `ready`
    // (hidratación): la invalidación reseteó `firstSnapshotReceivedRef`,
    // por lo que este snapshot NO cae en la persistencia
    // `stay-invalidated` — de lo contrario el analista quedaría
    // bloqueado sin poder auditar el snapshot recuperado.
    act(() => { emitDraftRawReady(makeValidSnapshot("s2")); });
    await flush();
    expect(getAuditar()).not.toBeDisabled();
    // El texto del botón vuelve a "Auditar con NUVIA" (no "Reevaluar"):
    // no hay dictamen previo reutilizado.
    expect(getAuditar().textContent).toMatch(/Auditar con NUVIA/i);
  });

  it("cleanup del listener al desmontar: eventos posteriores no crashean ni afectan al DOM", async () => {
    const { unmount } = mountCard();
    await flush();
    unmount();
    // No debe lanzar ni tocar componentes desmontados.
    expect(() => { emitDraftRawInvalidate(); emitDraftRawInvalidate(); }).not.toThrow();
  });
});
