import { createFileRoute } from "@tanstack/react-router";
import { PrintDocument } from "@/components/nuvex/PrintDocument";

export const Route = createFileRoute("/pdf-audit")({
  component: PdfAudit,
});

function PdfAudit() {
  return (
    <div style={{ margin: 0, background: "#d8d8d8" }}>
      <PrintDocument
        mode="pesos"
        client={{ nombre: "Jorge", cedula: "", banco: "Banco de Bogotá", tipoProducto: "Crédito Hipotecario en Pesos", asesor: "Eduard Castro", numeroCredito: "123456", plazoInicial: "240", cuotasPagadas: "24", porcentajeHonorarios: "5" }}
        cuotasPendientes={216}
        metrics={[]}
        bestIndex={3}
        honorariosPct={5}
        recommended={{ añosEliminados: 6, ahorroIntereses: 90000000, ahorroSeguros: 23788292, ahorroTotal: 113788292, honorarios: 5689415, nuevaCuota: 2452276 }}
        scenario={{ cuotaActual: 2116216, nuevaCuota: 2452276, plazoActual: 216, nuevoPlazo: 144, totalActual: 457102745, totalOptimizado: 343314453, vecesActual: 2.82, vecesOptimizado: 2.35 }}
        commercial={{ honorariosBase: 5689415, descuento: 0, finales: 5689415, hasDiscount: true, vigencia: "48 horas" }}
        dineroPagadoFecha={50789194}
        valorDesembolsado={180000000}
        creditState={{ plazoInicialMeses: 240, cuotasPagadas: 24, cuotasPendientes: 216, cuotaActual: 2116216, seguros: 136297, interesMensual: 1761405, capitalMensual: 218515, dineroPagado: 50789194, interesesPagados: 44087264, capitalPagado: 3430810, saldoCapital: 180000000 }}
        propuestasComerciales={[
          { index: 0, fuente: "automatica", nuevaCuota: 2205365, nuevoPlazo: 192, incrementoMensual: 89149, añosEliminados: 2, cuotasEliminadas: 24, ahorroIntereses: 30000000, ahorroSeguros: 6943873, ahorroTotal: 36943873, honorarios: 2216632, totalProyectado: 420158872 },
          { index: 1, fuente: "automatica", nuevaCuota: 2252115, nuevoPlazo: 180, incrementoMensual: 135899, añosEliminados: 3, cuotasEliminadas: 36, ahorroIntereses: 48000000, ahorroSeguros: 8628734, ahorroTotal: 56628734, honorarios: 3397724, totalProyectado: 400474011 },
          { index: 2, fuente: "automatica", nuevaCuota: 2373189, nuevoPlazo: 156, incrementoMensual: 256973, añosEliminados: 5, cuotasEliminadas: 60, ahorroIntereses: 78000000, ahorroSeguros: 17063005, ahorroTotal: 95063005, honorarios: 5703780, totalProyectado: 362039740 },
          { index: 3, fuente: "automatica", nuevaCuota: 2452276, nuevoPlazo: 144, incrementoMensual: 336060, añosEliminados: 6, cuotasEliminadas: 72, ahorroIntereses: 90000000, ahorroSeguros: 23788292, ahorroTotal: 113788292, honorarios: 5689415, totalProyectado: 343314453 },
        ]}
      />
    </div>
  );
}