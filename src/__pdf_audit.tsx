import React from "react";
import { createRoot } from "react-dom/client";
import { PrintDocument } from "./components/nuvex/PrintDocument";
import "./styles.css";

const props = {
  mode: "pesos" as const,
  client: { nombre: "Jorge", cedula: "", banco: "Banco de Bogotá", tipoProducto: "Crédito Hipotecario en Pesos", asesor: "Eduard Castro", numeroCredito: "123456", plazoInicial: "240", cuotasPagadas: "24", porcentajeHonorarios: "5" },
  cuotasPendientes: 216,
  metrics: [],
  bestIndex: 3,
  honorariosPct: 5,
  recommended: { añosEliminados: 6, ahorroIntereses: 90000000, ahorroSeguros: 23788292, ahorroTotal: 113788292, honorarios: 5689415, nuevaCuota: 2452276 },
  scenario: { cuotaActual: 2116216, nuevaCuota: 2452276, plazoActual: 216, nuevoPlazo: 144, totalActual: 457102745, totalOptimizado: 343314453, vecesActual: 2.82, vecesOptimizado: 2.35 },
  commercial: { honorariosBase: 5689415, descuento: 0, finales: 5689415, hasDiscount: true, vigencia: "48 horas" },
  dineroPagadoFecha: 50789194,
  valorDesembolsado: 180000000,
  creditState: { plazoInicialMeses: 240, cuotasPagadas: 24, cuotasPendientes: 216, cuotaActual: 2116216, seguros: 136297, interesMensual: 1761405, capitalMensual: 218515, dineroPagado: 50789194, interesesPagados: 44087264, capitalPagado: 3430810, saldoCapital: 180000000 },
  propuestasComerciales: [
    { nuevaCuota: 2205365, nuevoPlazo: 192, incrementoMensual: 89149, añosEliminados: 2, cuotasEliminadas: 24, ahorroTotal: 36943873, honorarios: 2216632 },
    { nuevaCuota: 2252115, nuevoPlazo: 180, incrementoMensual: 135899, añosEliminados: 3, cuotasEliminadas: 36, ahorroTotal: 56628734, honorarios: 3397724 },
    { nuevaCuota: 2373189, nuevoPlazo: 156, incrementoMensual: 256973, añosEliminados: 5, cuotasEliminadas: 60, ahorroTotal: 95063005, honorarios: 5703780 },
    { nuevaCuota: 2452276, nuevoPlazo: 144, incrementoMensual: 336060, añosEliminados: 6, cuotasEliminadas: 72, ahorroTotal: 113788292, honorarios: 5689415 },
  ],
};

createRoot(document.getElementById("root")!).render(<PrintDocument {...props} />);
setTimeout(() => {
  const el = document.getElementById("pdf-content-pesos");
  if (!el) return;
  el.style.position = "static";
  el.style.left = "0";
  el.style.top = "0";
  el.style.zIndex = "1";
  document.body.style.margin = "0";
  document.body.style.background = "#d8d8d8";
}, 100);