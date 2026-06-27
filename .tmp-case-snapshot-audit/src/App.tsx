import React from 'react';
import { createRoot } from 'react-dom/client';
import { CaseSnapshotPDF, type CaseSnapshotData } from '../../src/components/case-snapshot/CaseSnapshotPDF.tsx';
const data: CaseSnapshotData = {
  id: '1d8ba799-4299-4d5e-a354-4c2aa71076d6', cliente: { nombre: 'YULI PAOLA RIVERA TORRES', cc: '—' }, banco: 'Banco de Bogotá', producto: 'Crédito de vivienda en pesos sin benef.', modalidad: 'PESOS', estado: 'PROYECCIÓN APROBADA QA', analista: 'Marsela Gomez Sierra', qaScore: 90, nivelAutonomia: 'N1', fecha: '24 de junio de 2026',
  credito: { saldoActual: 161497284, cuotaActual: 1686910, cuotasPendientes: 193, costoTotal: 404858400, multiplicador: 2.18 },
  propuesta: { nuevaCuota: 2288864, nuevoPlazo: 91, cuotasEliminadas: 60, ahorroTotal: 44744774, ahorroIntereses: 39000000, ahorroSeguros: 5744774, tiempoRecuperado: '5 años' },
  honorarios: { pactados: 2684686, recalculados: 2510000, variacion: -174686, estadoCobro: 'ENVIADA', estadoPago: 'PENDIENTE', pazYSalvo: false },
  pipeline: [{ nombre: 'Simulación', estado: 'completado' }, { nombre: 'QA', estado: 'completado' }, { nombre: 'Contrato', estado: 'completado' }, { nombre: 'Poder', estado: 'completado' }, { nombre: 'Checklist', estado: 'completado' }, { nombre: 'Radicación', estado: 'en_proceso' }, { nombre: 'Respuesta Banco', estado: 'no_iniciado' }, { nombre: 'Informe Final', estado: 'no_iniciado' }, { nombre: 'Cuenta Cobro', estado: 'no_iniciado' }, { nombre: 'Paz y Salvo', estado: 'no_iniciado' }],
  intervinientes: [{ rol: 'Analista', nombre: 'Marsela Gomez Sierra', correo: 'marsela_625@hotmail.com' }, { rol: 'Director Financiero', nombre: 'Eduard Castro', correo: 'ecastro.prada@gmail.com' }, { rol: 'Contabilidad', nombre: 'AUDELINA MALDONADO MURILLO', correo: 'contabilidad@nuvex.com.co' }, { rol: 'Gerencia', nombre: 'Eduard Castro', correo: 'ecastro.prada@gmail.com' }],
  trazabilidad: [{ fecha: '26 jun 2026', accion: 'Simulación creada', usuario: 'Eduard Castro' }, { fecha: '26 jun 2026', accion: 'Auditoría QA aprobada', usuario: 'Eduard Castro' }, { fecha: '26 jun 2026', accion: 'Contrato firmado por cliente', usuario: 'Yuli P. Rivera T.' }, { fecha: '26 jun 2026', accion: 'Documentos recibidos', usuario: 'Marsela Gomez S.' }, { fecha: '26 jun 2026', accion: 'Caso radicado ante el banco', usuario: 'Marsela Gomez S.' }],
};
createRoot(document.getElementById('root')!).render(<CaseSnapshotPDF expediente={data} />);
