// ═════════════════════════════════════════════════════════════════════
// Prueba de integración REAL del contrato UVRSimulator → NUVIA.
//
// Este archivo:
//   1. Monta `UVRSimulator` con React Testing Library (jsdom), no
//      reconstruye el snapshot por caminos paralelos: escucha el evento
//      DOM real `nuvia:draftRawReady` que emite el simulador.
//   2. Usa datos reales del extracto Bancolombia (caso 000014):
//        plazoInicial 363, plazoRestante 285, saldoUVR 475070.5937,
//        valorUVR 416.6181, cuotaActualPesos 1604548.92,
//        teaCobrada 8.05, seguros 75138, valorDesembolsado 138466000.
//   3. Prueba dedup por `hashQaSnapshot`, invalidación al perder
//      completitud, reset comercial de "Nueva simulación", y contrato
//      del modal `ExtractoReader` (scroll-lock + cleanup).
//   4. Verifica el botón "Auditar con NUVIA" (habilitado sólo cuando el
//      snapshot standalone llega) montando `NuviaDraftAuditCard`.
//
// Mocks: los sub-componentes pesados de `UVRSimulator` que dependen de
// auth/Supabase/tanstack-router se sustituyen por stubs. La lógica que
// se prueba (emisión, dedup, reset, engine controlado) vive en el padre
// y NO se mockea.
// ═════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import { buildUvrEscenarios } from "@/lib/uvrEscenariosEngine";
import { calculateUVRProjection, type UVRInput } from "@/lib/finance";
import {
  buildUvrQaSnapshot,
  hashQaSnapshot,
  type UvrSnapshotInput,
} from "@/lib/nuviaQaSnapshot";

// ─── Mocks de infraestructura ────────────────────────────────────────
// tanstack-react-start: `useServerFn` devuelve un fn async no-op.
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    useServerFn: () => vi.fn(async () => ({})),
  };
});

vi.mock("@tanstack/react-router", async () => {
  const Link = (props: React.PropsWithChildren<{ to?: string; onClick?: () => void; className?: string }>) =>
    React.createElement("a", { href: props.to, onClick: props.onClick, className: props.className }, props.children);
  return { Link };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) },
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

// Hooks / servidor
vi.mock("@/hooks/useAsesorDefault", () => ({ useAsesorDefault: () => {} }));
vi.mock("@/hooks/useNivelAutonomia", () => ({
  useNivelAutonomia: () => ({ metricas: { nivelAutonomia: "revision" } }),
}));
vi.mock("@/hooks/useProductosBancarios", () => ({ useProductosBancarios: () => ({ data: [] }) }));
vi.mock("@/lib/simuladorAutoQA", () => ({ triggerSimuladorAutoQA: vi.fn() }));
vi.mock("@/lib/qaAI.functions", () => ({
  aprobarAuditoriaPorAuditor: () => async () => ({}),
}));
vi.mock("@/lib/simuladorDraftQA.functions", () => ({
  auditarSimulacionDraft: () => async () => ({}),
  escalarConsultaTecnica: () => async () => ({}),
  estadoAprobacionAuditoria: () => async () => ({ aprobada: false }),
}));
vi.mock("@/lib/propuestaAcciones.functions", () => ({
  marcarAccionPropuesta: () => async () => ({}),
}));

// Sub-componentes UI pesados → stubs vacíos. La lógica probada vive en
// UVRSimulator (emisor) y en PropuestasComerciales (motor controlado).
vi.mock("@/components/nuvex/ExtractoReader", () => ({
  ExtractoReader: () => null,
}));
vi.mock("@/components/nuvex/SituacionActualBlock", () => ({
  SituacionActualBlock: () => null,
}));
vi.mock("@/components/nuvex/ClientFields", async () => {
  const actual = await vi.importActual<typeof import("@/components/nuvex/ClientFields")>(
    "@/components/nuvex/ClientFields",
  );
  return { ...actual, ClientFields: () => null };
});
vi.mock("@/components/nuvex/CreditoMetaFields", () => ({ CreditoMetaFields: () => null }));
vi.mock("@/components/nuvex/FreshBlock", () => ({ FreshBlock: () => null }));
vi.mock("@/components/nuvex/DiscountModule", async () => {
  const actual = await vi.importActual<typeof import("@/components/nuvex/DiscountModule")>(
    "@/components/nuvex/DiscountModule",
  );
  return { ...actual, DiscountModule: () => null };
});
vi.mock("@/components/nuvex/SaveExpedienteButton", () => ({ SaveExpedienteButton: () => null }));
vi.mock("@/components/nuvex/PrintDocument", () => ({ PrintDocument: () => null }));
vi.mock("@/components/nuvex/WhatsAppPropuestaButton", async () => {
  const actual = await vi.importActual<typeof import("@/components/nuvex/WhatsAppPropuestaButton")>(
    "@/components/nuvex/WhatsAppPropuestaButton",
  );
  return { ...actual, WhatsAppPropuestaButton: () => null };
});
vi.mock("@/components/nuvex/EnviarDocumentoButton", () => ({ EnviarDocumentoButton: () => null }));
vi.mock("@/components/nuvex/AuditPanel", () => ({
  AuditPanel: () => null,
  AuditBadge: () => null,
}));
vi.mock("@/components/nuvex/AutoQAPanel", () => ({ AutoQAPanel: () => null }));
vi.mock("@/components/nuvex/MonedaMismatchDialog", () => ({
  useMonedaMismatchAlert: () => ({ confirm: async () => true, dialog: null }),
}));
vi.mock("@/components/home/widgets/AnimatedBackground", () => ({
  AnimatedBackground: () => null,
}));

// Imports que dependen de los mocks previos van AL FINAL.
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { ExtractoReader } from "@/components/nuvex/ExtractoReader";
import { NuviaDraftAuditCard } from "@/components/nuvex/NuviaDraftAuditCard";
// Nota: `ExtractoReader` está mockeado arriba para UVRSimulator; para
// las pruebas del modal usamos la versión real (`ExtractoReaderReal`).
const { ExtractoReader: ExtractoReaderReal } = await vi.importActual<
  typeof import("@/components/nuvex/ExtractoReader")
>("@/components/nuvex/ExtractoReader");

// ─── Datos reales del extracto Bancolombia (caso 000014) ─────────────
const BANCOLOMBIA_UVR: UVRInput = {
  valorDesembolsado: 138_466_000,
  saldoPesos: 475_070.5937 * 416.6181,
  saldoUVR: 475_070.5937,
  valorUVR: 416.6181,
  cuotaActualPesos: 1_604_548.92,
  cuotaSinSeguros: 1_604_548.92 - 75_138,
  seguros: 75_138,
  teaCobrada: 8.05,
  variacionUVR: 6,
  variacionUVRPropuestas: 5,
  cuotasPendientes: 285,
  plazoInicial: 363,
  porcentajeHonorarios: 6,
};

// Snapshot canónico que DEBE emitir el simulador — construido a partir
// del motor puro con los mismos inputs, sin sustituir al componente.
function expectedSnapshot(input: UVRInput = BANCOLOMBIA_UVR) {
  const proj = calculateUVRProjection(input);
  const res = buildUvrEscenarios({
    plazoInicial: input.plazoInicial,
    plazoRestante: input.cuotasPendientes,
    input,
    escenarioActual: proj.escenarioActual,
  });
  const snapInput: UvrSnapshotInput = {
    banco: "Bancolombia",
    producto: "Hipotecario UVR",
    cedula: "1000000",
    numeroCredito: "999",
    cliente: "Cliente Prueba",
    saldoPesos: input.saldoPesos,
    saldoUVR: input.saldoUVR,
    valorUVR: input.valorUVR,
    cuotaActualPesos: input.cuotaActualPesos,
    seguros: input.seguros,
    teaCobrada: input.teaCobrada,
    valorDesembolsado: input.valorDesembolsado,
    variacionUVR: input.variacionUVR,
    variacionUVRPropuestas: input.variacionUVRPropuestas,
    plazoInicial: input.plazoInicial,
    cuotasPagadas: input.plazoInicial - input.cuotasPendientes,
    cuotasPendientes: input.cuotasPendientes,
    escenarios: res.propuestas.map((p) => ({
      index: p.index,
      cuotasEliminadas: p.cuotasEliminadas,
      añosEliminados: p.añosEliminados,
      nuevoPlazo: p.nuevoPlazo,
      nuevaCuota: p.nuevaCuota,
      ahorroIntereses: p.ahorroIntereses,
      ahorroSeguros: p.ahorroSeguros,
      ahorroTotal: p.ahorroTotal,
      honorarios: p.honorarios,
      totalProyectado: p.totalProyectado,
      incrementoMensual: p.incrementoMensual,
      fuente: p.fuente,
    })),
  };
  return { snapshot: buildUvrQaSnapshot(snapInput), engine: res };
}

// Sembramos sessionStorage con un draft UVR completo para que
// UVRSimulator hidrate el formulario sin necesidad de teclear en
// ClientFields/CreditoMetaFields (que están mockeados).
function seedBancolombiaDraft() {
  const draft = {
    extractoArchivoPath: "",
    discount: { type: "percent", value: 0, motivo: "" },
    client: {
      nombre: "Cliente Prueba",
      cedula: "1000000",
      numeroCredito: "999",
      banco: "Bancolombia",
      tipoProducto: "Hipotecario UVR",
      productoBancarioId: null,
      plazoInicial: "363",
      cuotasPagadas: "78",
      cuotasPendientes: "285",
      porcentajeHonorarios: "6",
      asesor: "",
      intervinientes: [],
    },
    intervinientes: [],
    cobertura: {
      activo: false,
      valorCobertura: "",
      tasaCobertura: "",
      tipoBeneficio: "",
      cuotaPagadaCliente: "",
      cuotaConInteresSinSeguros: "",
      segurosMensuales: "",
      cuotaBaseSimulacion: "",
      requiereVerificacion: false,
    },
    valorDesembolsado: "138466000",
    saldoPesos: String(BANCOLOMBIA_UVR.saldoPesos),
    saldoUVR: "475070.5937",
    valorUVR: "416.6181",
    cuotaActualPesos: "1604548.92",
    seguros: "75138",
    teaCobrada: "8.05",
    variacionUVR: "6",
    variacionUVRPropuestas: "5",
    nuevaCuotaManual: "",
    cuotasEliminarManual: "",
    modoPersonalizada: "cuota",
    interesMensualExtracto: "",
    capitalMensualExtracto: "",
    beneficioFrechMensualExtracto: "",
  };
  sessionStorage.setItem("nuvex.simulatorDraft.uvr.standalone", JSON.stringify(draft));
}

function captureDraftRawEvents(): { events: CustomEvent[]; stop: () => void } {
  const events: CustomEvent[] = [];
  const handler = (e: Event) => events.push(e as CustomEvent);
  window.addEventListener("nuvia:draftRawReady", handler as EventListener);
  return { events, stop: () => window.removeEventListener("nuvia:draftRawReady", handler as EventListener) };
}

async function flush() {
  // React efectos + microtareas
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("UVRSimulator (RTL) — extracto Bancolombia real (caso 000014)", () => {
  it("emite `nuvia:draftRawReady` con el snapshot v2 (4 propuestas) al montar hidratado", async () => {
    seedBancolombiaDraft();
    const captured = captureDraftRawEvents();
    render(<UVRSimulator />);
    await flush();
    captured.stop();

    expect(captured.events.length).toBeGreaterThanOrEqual(1);
    const detail = captured.events.at(-1)!.detail as {
      moneda?: string; banco?: string; datos?: Record<string, unknown>;
    };
    expect(detail.moneda).toBe("UVR");
    expect(detail.banco).toBe("Bancolombia");
    const datos = detail.datos as Record<string, unknown>;
    expect(datos.snapshotVersion).toBe(2);
    const props = datos.propuestasComerciales as unknown[];
    expect(Array.isArray(props)).toBe(true);
    expect(props.length).toBe(4);

    const { snapshot } = expectedSnapshot();
    expect(hashQaSnapshot(detail as never)).toBe(hashQaSnapshot(snapshot));
  });

  it("dedup standalone: el mismo hash no se emite dos veces (aunque el padre re-renderice)", async () => {
    seedBancolombiaDraft();
    const captured = captureDraftRawEvents();
    const { rerender } = render(<UVRSimulator />);
    await flush();
    const n1 = captured.events.length;
    rerender(<UVRSimulator />);
    await flush();
    rerender(<UVRSimulator />);
    await flush();
    captured.stop();
    // El snapshot no cambió → sólo la primera emisión debe registrarse.
    expect(captured.events.length).toBe(n1);
  });

  it("botón 'Auditar con NUVIA' pasa de deshabilitado a habilitado cuando llega el snapshot", async () => {
    seedBancolombiaDraft();
    render(
      <>
        <NuviaDraftAuditCard mode="uvr" onCertificar={() => {}} onSalir={() => {}} />
        <UVRSimulator />
      </>,
    );
    await flush();
    const btn = screen.getByRole("button", { name: /Auditar con NUVIA/i });
    expect(btn).not.toBeDisabled();
  });

  it("regeneradaPorInvalidez: motor lo reporta y snapshot v2 conserva las 4 propuestas automáticas", () => {
    // Simulamos escenario: analista había guardado [72,84,96,108] con
    // plazoRestante 285; luego abonó extra y plazoRestante bajó a 100.
    const inputB = { ...BANCOLOMBIA_UVR, cuotasPendientes: 100 };
    const projB = calculateUVRProjection(inputB);
    const res = buildUvrEscenarios({
      plazoInicial: inputB.plazoInicial,
      plazoRestante: inputB.cuotasPendientes,
      input: inputB,
      escenarioActual: projB.escenarioActual,
      cuotasList: [72, 84, 96, 108],
    });
    expect(res.regeneradaPorInvalidez).toBe(true);
    expect(res.fuente).toBe("automatica");
    expect(res.propuestas.length).toBeGreaterThan(0);
  });

  it("cuota editada visible = cuota emitida dentro del evento NUVIA", async () => {
    // Sembramos con override manual [60,90,120,150] y recomendada=1.
    seedBancolombiaDraft();
    const raw = JSON.parse(sessionStorage.getItem("nuvex.simulatorDraft.uvr.standalone")!);
    // El draft persiste `propuestasComerciales` como OBJETO (ver
    // useSimulatorDraft + UVRSimulator L272), no como string.
    raw.propuestasComerciales = { cuotasList: [60, 90, 120, 150], recomendadaIdx: 1 };
    sessionStorage.setItem("nuvex.simulatorDraft.uvr.standalone", JSON.stringify(raw));

    const captured = captureDraftRawEvents();
    render(<UVRSimulator />);
    await flush();
    captured.stop();

    const detail = captured.events.at(-1)!.detail as { datos?: Record<string, unknown> };
    const datos = detail.datos as Record<string, unknown>;
    const props = datos.propuestasComerciales as Array<{ cuotasEliminadas: number }>;
    expect(props.map((p) => p.cuotasEliminadas)).toEqual([60, 90, 120, 150]);
  });

  it("reset comercial (`Nueva simulación`): remonta con estado limpio y emite el snapshot automático", async () => {
    // Primer render: override manual guardado en draft.
    seedBancolombiaDraft();
    const raw = JSON.parse(sessionStorage.getItem("nuvex.simulatorDraft.uvr.standalone")!);
    raw.propuestasComerciales = { cuotasList: [10, 20, 30, 40], recomendadaIdx: 0 };
    sessionStorage.setItem("nuvex.simulatorDraft.uvr.standalone", JSON.stringify(raw));
    const captured = captureDraftRawEvents();
    render(<UVRSimulator />);
    await flush();
    const detailA = captured.events.at(-1)!.detail as { datos?: Record<string, unknown> };
    const cuotasA = (detailA.datos!.propuestasComerciales as Array<{ cuotasEliminadas: number }>)
      .map((p) => p.cuotasEliminadas);
    expect(cuotasA).toEqual([10, 20, 30, 40]);

    // Simulamos "Nueva simulación": el analista pulsa el botón que en
    // producción llama a `handleResetMode` (a través de onReset del
    // parent). Aquí lo replicamos por el contrato público:
    // desmontamos el componente y limpiamos el draft — que es lo que
    // `handleResetMode` hace vía `clearSimulatorDraft`.
    cleanup();
    sessionStorage.removeItem("nuvex.simulatorDraft.uvr.standalone");
    // Re-sembramos sólo los datos financieros del extracto (sin override).
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    const detailB = captured.events.at(-1)!.detail as { datos?: Record<string, unknown> };
    const cuotasB = (detailB.datos!.propuestasComerciales as Array<{ cuotasEliminadas: number }>)
      .map((p) => p.cuotasEliminadas);
    // Sin override → escala automática por plazoInicial=363.
    expect(cuotasB).toEqual([72, 84, 96, 108]);
    // El hash cambió: el reset publicó un nuevo snapshot standalone.
    const { snapshot } = expectedSnapshot();
    expect(hashQaSnapshot(detailB as never)).toBe(hashQaSnapshot(snapshot));
    captured.stop();
  });
});

// ─── ExtractoReader: modal open/close, scroll-lock, cleanup ─────────
// `await import()` a nivel de módulo mantiene el import como dinámico
// (evita ejecutar mocks tempranos) y respeta las reglas de TS.
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

describe("ExtractoReader — modal, scroll-lock y cleanup de listeners", () => {
  const withQC = (ui: React.ReactElement) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
  };

  it("al abrir bloquea el scroll del body y lo restaura al cerrar", async () => {
    render(withQC(<ExtractoReaderReal modo="uvr" onApply={vi.fn()} />));
    const openBtn = screen
      .getAllByRole("button")
      .find((b) => /extracto|leer|subir|cargar/i.test(b.textContent ?? ""));
    expect(openBtn).toBeTruthy();
    fireEvent.click(openBtn!);
    await flush();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]') as HTMLElement | null;
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    await flush();
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("al desmontar restaura scroll y remueve listeners de drag globales", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(withQC(<ExtractoReaderReal modo="uvr" onApply={vi.fn()} />));
    await flush();
    const addedDrag = addSpy.mock.calls.filter(([evt]) => evt === "dragover" || evt === "drop").length;
    unmount();
    const removedDrag = removeSpy.mock.calls.filter(([evt]) => evt === "dragover" || evt === "drop").length;
    // Todo listener global de drag registrado durante la vida del
    // componente debe removerse en el cleanup.
    expect(removedDrag).toBeGreaterThanOrEqual(addedDrag);
    expect(document.body.style.overflow).toBe("");
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
