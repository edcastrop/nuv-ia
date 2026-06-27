import React from "react";
import { renderToFile } from "@react-pdf/renderer";
// Stub @/lib/format
import Module from "module";
const _resolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(req: string, ...rest: any[]) {
  if (req === "@/lib/format") return require.resolve("./formatStub.cjs");
  return _resolve.call(this, req, ...rest);
};
import("/dev-server/src/lib/caseSnapshotPdf.tsx").then(async (m) => {
  const dto: any = {
    meta: { fecha: new Date().toISOString(), expedienteId: "1d8ba799-aaaa-bbbb-cccc-000000000000", banco: "BANCO DE BOGOTÁ", producto: "CRÉDITO DE VIVIENDA EN PESOS SIN BENEFICIO DE COBERTURA", modalidad: "PESOS", estadoCaso: "PROYECCION_APROBADA_QA", estado: "", qaScore: 90, qaDictamen: "APROBADO_OBS", cliente: "YULI PAOLA RIVERA TORRES", analista: { nombre: "Marsela Gomez Sierra" } },
    cliente: { nombre: "YULI PAOLA RIVERA TORRES", cedula: "", ciudad: "", telefono: "" },
    credito: { saldoCapital: 161497284, valorDesembolsado: 0, cuotaActual: 2014093, seguros: 107667, cuotasPendientes: 78, cuotasPagadas: 6, plazoAprobado: 84, costoReal: 358084263, totalProyectado: 358084263, tea: 13.62, vecesPagado: 2.22 },
    propuesta: { recomendada: true, escenario: "PROPUESTA 4", ahorroTotal: 120965523, nuevaCuota: 2210397, nuevoPlazo: 162, cuotasEliminadas: 72, ahorroIntereses: 113213499, ahorroSeguros: 7752024 },
    honorarios: { pactados: 12500000, porcentaje: 3, estadoCobro: "PENDIENTE", cuentaCobroEmitida: true, pazYSalvo: false },
    timeline: [
      { etiqueta: "Simulación", estado: "hecho" },
      { etiqueta: "QA", estado: "hecho" },
      { etiqueta: "Contrato", estado: "curso" },
      { etiqueta: "Poder", estado: "pendiente" },
      { etiqueta: "Checklist", estado: "pendiente" },
      { etiqueta: "Radicación", estado: "pendiente" },
      { etiqueta: "Respuesta banco", estado: "pendiente" },
      { etiqueta: "Informe final", estado: "pendiente" },
      { etiqueta: "Cuenta cobro", estado: "pendiente" },
      { etiqueta: "Paz y salvo", estado: "pendiente" },
    ],
    intervinientes: [
      { rol: "ANALISTA", nombre: "Marsela Gomez Sierra" },
      { rol: "DIRECTOR_FINANCIERO", nombre: "Eduard Castro" },
      { rol: "CONTABILIDAD", nombre: "AUDELINA MALDONADO MURILLO" },
      { rol: "GERENCIA", nombre: "Eduard Castro" },
    ],
    trazabilidad: [
      { fecha: "2026-06-25", accion: "manual", usuario: "Eduard Castro" },
      { fecha: "2026-06-25", accion: "simulacion_guardada", usuario: "Eduard Castro" },
    ],
  };
  // call SnapshotDoc indirectly via generarCaseSnapshotPdf? It returns Blob (browser). Instead use pdf().toBuffer via react-pdf node API.
  const { pdf } = await import("@react-pdf/renderer");
  const instance = pdf();
  // Re-create the document using exported helper: use generarCaseSnapshotPdf alternative
  // Easier: replicate by importing internal SnapshotDoc — not exported. Fallback: call generarCaseSnapshotPdf which uses toBlob (Node has no Blob? Node 18+ has Blob).
  const blob: any = await m.generarCaseSnapshotPdf(dto);
  const buf = Buffer.from(await blob.arrayBuffer());
  const fs = await import("fs");
  fs.writeFileSync("/tmp/pdfaudit/out.pdf", buf);
  console.log("OK", buf.length);
}).catch(e => { console.error(e); process.exit(1); });
