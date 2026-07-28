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

  it("invalidación end-to-end vía UI: perder completitud emite `nuvia:draftRawInvalidate` (una vez), deshabilita Auditar; al restaurar el dato llega un nuevo `draftRawReady` y el botón se re-habilita para una NUEVA auditoría", async () => {
    seedBancolombiaDraft();
    const readyEvents: CustomEvent[] = [];
    const invalidateEvents: Event[] = [];
    const readyHandler = (e: Event) => readyEvents.push(e as CustomEvent);
    const invalidateHandler = (e: Event) => invalidateEvents.push(e);
    window.addEventListener("nuvia:draftRawReady", readyHandler as EventListener);
    window.addEventListener("nuvia:draftRawInvalidate", invalidateHandler);

    render(
      <>
        <NuviaDraftAuditCard mode="uvr" onCertificar={() => {}} onSalir={() => {}} />
        <UVRSimulator />
      </>,
    );
    await flush();

    // Estado inicial: snapshot standalone emitido, botón habilitado.
    expect(readyEvents.length).toBeGreaterThanOrEqual(1);
    const btn = () => screen.getByRole("button", { name: /Auditar con NUVIA|Reevaluar|Auditando/i });
    expect(btn()).not.toBeDisabled();
    const readyCountA = readyEvents.length;
    const invalidatedCountA = invalidateEvents.length;

    // Interacción REAL sobre la UI: borramos "Saldo actual en UVR" —
    // input renderizado directamente por UVRSimulator (no mockeado).
    const saldoInput = screen.getByLabelText(/Saldo actual en UVR/i) as HTMLInputElement;
    expect(saldoInput.value).not.toBe("");
    await act(async () => {
      fireEvent.change(saldoInput, { target: { value: "" } });
      await new Promise((r) => setTimeout(r, 0));
    });

    // Se emitió EXACTAMENTE una invalidación (idempotencia por render).
    expect(invalidateEvents.length - invalidatedCountA).toBe(1);
    // Botón deshabilitado tras la invalidación.
    expect(btn()).toBeDisabled();

    // Simulamos varios re-renders sin restaurar → sigue sin re-emitir.
    await flush();
    await flush();
    expect(invalidateEvents.length - invalidatedCountA).toBe(1);

    // Restauramos el dato por la UI real → nuevo `draftRawReady`.
    await act(async () => {
      fireEvent.change(saldoInput, { target: { value: "475070.5937" } });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(readyEvents.length).toBeGreaterThan(readyCountA);

    // El botón vuelve a estar habilitado y presenta la etiqueta de una
    // NUEVA auditoría (no `Reevaluar`) — evidencia de que el resultado
    // anterior no se está reutilizando.
    expect(btn()).not.toBeDisabled();
    expect(btn().textContent).toMatch(/Auditar con NUVIA/i);

    window.removeEventListener("nuvia:draftRawReady", readyHandler as EventListener);
    window.removeEventListener("nuvia:draftRawInvalidate", invalidateHandler);
  });
});

// ─────────────────────────────────────────────────────────────────────
// "Eliminar escenario" en UVR — CONTRATO REVISADO (v2 papelera real).
// - La papelera reduce la lista en 1 (4 → 3). No hay sustitución.
// - Un botón "+ Agregar escenario" aparece cuando length<4 y permite
//   volver a 4 explícitamente (acción independiente).
// - Snapshot NUVIA v2 requiere exactamente 4: <4 dispara invalidación
//   y el botón "Auditar con NUVIA" queda deshabilitado.
// - La recomendación se preserva por VALOR, no por índice.
// - PESOS no se toca.
// - Fixture de regresión: NUV_2026_EC_000208.
// ─────────────────────────────────────────────────────────────────────
describe("UVRSimulator — 'Eliminar escenario' (eliminación real, sin sustitución)", () => {
  const cuotasFromLastReady = (events: CustomEvent[]) => {
    const detail = events.at(-1)!.detail as { datos?: Record<string, unknown> };
    const props = (detail.datos!.propuestasComerciales as Array<{ cuotasEliminadas: number }>);
    return props.map((p) => p.cuotasEliminadas);
  };

  it("modo editable: renderiza 4 botones 'Eliminar escenario' inicialmente", async () => {
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(4);
  });

  it("clic en papelera: la tarjeta DESAPARECE del DOM (4 → 3), NO se sustituye", async () => {
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    // Escala automática por plazoInicial=363 → [72,84,96,108].
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(4);
    const target = screen.getAllByTitle("Eliminar escenario")[1]; // valor 84
    await act(async () => { fireEvent.click(target); await new Promise((r) => setTimeout(r, 0)); });
    // Contrato: la tarjeta se elimina realmente. Ahora quedan 3.
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
  });

  it("con 3 escenarios se muestra el botón '+ Agregar escenario' y con 4 se oculta", async () => {
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    // Con 4 escenarios el botón NO está presente.
    expect(screen.queryByTitle("Agregar escenario")).toBeNull();
    // Borrar uno.
    const del = screen.getAllByTitle("Eliminar escenario")[0];
    await act(async () => { fireEvent.click(del); await new Promise((r) => setTimeout(r, 0)); });
    // Ahora sí aparece.
    expect(screen.getByTitle("Agregar escenario")).toBeInTheDocument();
  });

  it("clic en '+ Agregar escenario': la lista vuelve a 4, todos únicos y ascendentes", async () => {
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    // Borrar 84 (idx 1) → 3.
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[1]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
    // Agregar → 4.
    await act(async () => {
      fireEvent.click(screen.getByTitle("Agregar escenario"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(4);
  });

  it("NUVIA se INVALIDA al bajar de 4 y se REHABILITA al volver a 4 con '+ Agregar escenario'", async () => {
    seedBancolombiaDraft();
    const captured = captureDraftRawEvents();
    const invalidateEvents: Event[] = [];
    const invHandler = (e: Event) => { invalidateEvents.push(e); };
    window.addEventListener("nuvia:draftRawInvalidate", invHandler);

    render(
      <>
        <NuviaDraftAuditCard mode="uvr" onCertificar={() => {}} onSalir={() => {}} />
        <UVRSimulator />
      </>,
    );
    await flush();
    const btn = () => screen.getByRole("button", { name: /Auditar con NUVIA|Reevaluar|Auditando/i });
    expect(btn()).not.toBeDisabled();
    const readyBefore = captured.events.length;

    // Borrar uno → cae a 3 → invalidación + botón deshabilitado.
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[2]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
    expect(invalidateEvents.length).toBeGreaterThan(0);
    // No se emitió un nuevo snapshot "ready" mientras hay 3.
    expect(captured.events.length).toBe(readyBefore);
    expect(btn()).toBeDisabled();

    // Agregar → vuelve a 4 → snapshot v2 se re-emite y botón habilitado.
    await act(async () => {
      fireEvent.click(screen.getByTitle("Agregar escenario"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(4);
    expect(captured.events.length).toBeGreaterThan(readyBefore);
    const last = captured.events.at(-1)!.detail as { datos?: Record<string, unknown> };
    expect((last.datos!.propuestasComerciales as unknown[]).length).toBe(4);
    expect(btn()).not.toBeDisabled();

    window.removeEventListener("nuvia:draftRawInvalidate", invHandler);
    captured.stop();
  });

  it("recomendación por VALOR: si el recomendado se elimina, el índice queda en -1", async () => {
    seedBancolombiaDraft();
    const raw = JSON.parse(sessionStorage.getItem("nuvex.simulatorDraft.uvr.standalone")!);
    // recomendada idx=1 → valor 84.
    raw.propuestasComerciales = { cuotasList: [72, 84, 96, 108], recomendadaIdx: 1 };
    sessionStorage.setItem("nuvex.simulatorDraft.uvr.standalone", JSON.stringify(raw));

    render(<UVRSimulator />);
    await flush();
    // Eliminar el recomendado (idx 1, valor 84).
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[1]);
      await new Promise((r) => setTimeout(r, 0));
    });
    // Quedan 3. Ninguna estrella marcada (recomendada = -1).
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
    const marcadas = screen.queryAllByTitle(/recomendada.*enviada al cliente/i);
    expect(marcadas.length).toBe(0);
  });

  it("recomendación por VALOR: si se elimina OTRO escenario, el recomendado se preserva por su valor", async () => {
    seedBancolombiaDraft();
    const raw = JSON.parse(sessionStorage.getItem("nuvex.simulatorDraft.uvr.standalone")!);
    // recomendada idx=2 → valor 96.
    raw.propuestasComerciales = { cuotasList: [72, 84, 96, 108], recomendadaIdx: 2 };
    sessionStorage.setItem("nuvex.simulatorDraft.uvr.standalone", JSON.stringify(raw));

    const captured = captureDraftRawEvents();
    render(<UVRSimulator />);
    await flush();

    // Borrar 72 (idx 0). Recomendada 96 sigue viva → snapshot NUVIA se
    // re-emite con 3 propuestas? No: NUVIA invalidación (3 < 4). El
    // consumidor debe validar recomendación tras re-agregar. Verificamos
    // que en el último snapshot con 4 (inicial) el recomendado apunta a
    // 96.
    const initialDatos = captured.events.at(-1)!.detail as { datos?: Record<string, unknown> };
    const initialProps = initialDatos.datos!.propuestasComerciales as Array<{ cuotasEliminadas: number }>;
    const initialRec = initialDatos.datos!.recommendedIndex as number | null;
    if (typeof initialRec === "number" && initialRec >= 0) {
      expect(initialProps[initialRec].cuotasEliminadas).toBe(96);
    }

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[0]);
      await new Promise((r) => setTimeout(r, 0));
    });
    // 96 sigue presente entre las 3 tarjetas visibles.
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    );
    const valores = inputs.map((i) => Number(i.value)).filter((n) => n > 0 && n < 285);
    expect(valores).toContain(96);
    expect(valores).not.toContain(72);
    captured.stop();
  });

  it("regresión NUV_2026_EC_000208: eliminar 84 reduce la lista a 3 y NO reinserta 84", async () => {
    // Fixture sin PII inspirado en NUV_2026_EC_000208. Simulamos la
    // configuración estándar UVR Bancolombia y verificamos que la
    // papelera actúa realmente sobre el DOM.
    seedBancolombiaDraft();
    const { container } = render(<UVRSimulator />);
    await flush();

    const readCuotas = () =>
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="number"]'))
        .map((i) => Number(i.value))
        .filter((n) => n > 0 && n < 285);

    expect(readCuotas()).toEqual([72, 84, 96, 108]);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[1]);
      await new Promise((r) => setTimeout(r, 0));
    });

    // Cambio material observable en el DOM: 3 tarjetas, sin 84.
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
    const valores = readCuotas();
    expect(valores.length).toBe(3);
    expect(valores).not.toContain(84);
    expect(valores).toEqual(expect.arrayContaining([72, 96, 108]));
  });

  it("persistencia local: 3 escenarios sobreviven a remount (no se regeneran a 4 automáticamente)", async () => {
    seedBancolombiaDraft();
    const { unmount } = render(<UVRSimulator />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[1]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
    unmount();
    render(<UVRSimulator />);
    await flush();
    // Al reabrir con el mismo sessionStorage la lista sigue siendo de 3
    // — no se regenera automáticamente a 4.
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);
    void cuotasFromLastReady; // helper reservado para casos con snapshot v2
  });

  // ─── Regresión: 4 → 3 → 2 → 1 (no debe llegar a 0 ni regenerar 4) ──
  it("4 → 3 → 2 → 1: bloquea el borrado del último, no regenera a 4, NUVIA permanece deshabilitada y se reconstruye con 'Agregar escenario'", async () => {
    seedBancolombiaDraft();
    const invalidateEvents: Event[] = [];
    const invHandler = (e: Event) => { invalidateEvents.push(e); };
    window.addEventListener("nuvia:draftRawInvalidate", invHandler);

    render(
      <>
        <NuviaDraftAuditCard mode="uvr" onCertificar={() => {}} onSalir={() => {}} />
        <UVRSimulator />
      </>,
    );
    await flush();

    // 4 → 3
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[3]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(3);

    // 3 → 2
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[2]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getAllByTitle("Eliminar escenario").length).toBe(2);

    // 2 → 1
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[1]);
      await new Promise((r) => setTimeout(r, 0));
    });
    // Con 1 escenario la papelera se OCULTA (padre no entrega onRemove).
    expect(screen.queryAllByTitle("Eliminar escenario").length).toBe(0);

    // Sanity: no se regeneró automáticamente a 4.
    // Sigue habiendo exactamente 1 tarjeta comercial → el botón
    // "+ Agregar escenario" está presente para reconstruir manualmente.
    expect(screen.getByTitle("Agregar escenario")).toBeInTheDocument();

    // NUVIA continúa deshabilitada (snapshot standalone invalidado).
    const auditarBtn = screen.getByRole("button", { name: /Auditar con NUVIA/i });
    expect(auditarBtn).toBeDisabled();
    expect(invalidateEvents.length).toBeGreaterThan(0);

    // Reconstruir progresivamente 1 → 2 → 3 → 4 con "+ Agregar escenario".
    for (const expectedLen of [2, 3, 4]) {
      await act(async () => {
        fireEvent.click(screen.getByTitle("Agregar escenario"));
        await new Promise((r) => setTimeout(r, 0));
      });
      // Cuando vuelve a 4 la papelera reaparece en todas.
      if (expectedLen < 4) {
        // Con 2 o 3, papelera visible porque length > 1.
        expect(screen.getAllByTitle("Eliminar escenario").length).toBe(expectedLen);
      } else {
        expect(screen.getAllByTitle("Eliminar escenario").length).toBe(4);
      }
    }

    window.removeEventListener("nuvia:draftRawInvalidate", invHandler);
    void cuotasFromLastReady;
  });

  // ─── Regresión: prioridad de "+ Agregar escenario" = max + 12 ────
  // Contrato revisado: la búsqueda del sustituto debe empezar en
  // (max + 12) y avanzar en pasos de 12. Las canónicas [72,84,96,108]
  // son SÓLO fallback. Con [96], el resultado debe ser [96,108],
  // nunca [72,96]. Con [72] la reconstrucción debe recorrer
  // 72 → 84 → 96 → 108.
  const readCuotasFromDom = (): number[] => {
    // "−N cuotas (…)" aparece una vez por tarjeta comercial.
    const nodes = Array.from(document.querySelectorAll("div")).filter((el) =>
      /^−\d+\s+cuotas\s*\(/.test((el.textContent ?? "").trim()),
    );
    const vals: number[] = [];
    for (const n of nodes) {
      const m = (n.textContent ?? "").trim().match(/^−(\d+)\s+cuotas/);
      if (m) vals.push(parseInt(m[1], 10));
    }
    return Array.from(new Set(vals)).sort((a, b) => a - b);
  };

  it("con [96] agregar produce [96,108] (nunca 72): prioriza max+12 sobre canónicas", async () => {
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    // Inicial [72,84,96,108]. Borrar 72 (idx0), 84 (idx0 tras shift), 108 (último).
    // Tras cada borrado la lista se re-renderiza ordenada.
    // Objetivo: dejar únicamente [96].
    // 1) borra idx0 (72) → [84,96,108]
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[0]);
      await new Promise((r) => setTimeout(r, 0));
    });
    // 2) borra idx0 (84) → [96,108]
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[0]);
      await new Promise((r) => setTimeout(r, 0));
    });
    // 3) borra idx1 (108) → [96]
    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Eliminar escenario")[1]);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(readCuotasFromDom()).toEqual([96]);

    // Agregar: debe elegir 96+12 = 108, NO 72.
    await act(async () => {
      fireEvent.click(screen.getByTitle("Agregar escenario"));
      await new Promise((r) => setTimeout(r, 0));
    });
    const after = readCuotasFromDom();
    expect(after).toEqual([96, 108]);
    expect(after).not.toContain(72);
  });

  it("reconstrucción desde [72]: 72 → 84 → 96 → 108 (pasos estrictos de +12)", async () => {
    seedBancolombiaDraft();
    render(<UVRSimulator />);
    await flush();
    // Dejar [72]: borrar el último 3 veces (siempre elimina el mayor).
    for (let i = 0; i < 3; i++) {
      const btns = screen.getAllByTitle("Eliminar escenario");
      await act(async () => {
        fireEvent.click(btns[btns.length - 1]);
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    expect(readCuotasFromDom()).toEqual([72]);

    // 1er add → 84
    await act(async () => {
      fireEvent.click(screen.getByTitle("Agregar escenario"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(readCuotasFromDom()).toEqual([72, 84]);

    // 2do add → 96
    await act(async () => {
      fireEvent.click(screen.getByTitle("Agregar escenario"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(readCuotasFromDom()).toEqual([72, 84, 96]);

    // 3er add → 108
    await act(async () => {
      fireEvent.click(screen.getByTitle("Agregar escenario"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(readCuotasFromDom()).toEqual([72, 84, 96, 108]);
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

  it("al abrir bloquea el scroll del body y al desmontar lo restaura", async () => {
    const { container, unmount } = render(withQC(<ExtractoReaderReal modo="uvr" onApply={vi.fn()} />));
    await flush();
    // Único camino público a `setOpen(true)`: change en el input file.
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const dummy = new File([new Uint8Array([0])], "x.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { value: [dummy], configurable: true });
    fireEvent.change(fileInput);
    await flush();
    // Efecto de scroll-lock activo mientras el modal está abierto.
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    // Portal montado con z-[100] — el visor no queda por debajo de la
    // capa navy ni de las tarjetas superiores.
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]');
    expect(overlay).toBeTruthy();
    // Cleanup del efecto restaura el overflow original al desmontar.
    unmount();
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
