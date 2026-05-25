# Módulo PRO — Finanzas y Tesorería NUVEX

Es un módulo muy extenso (18 secciones). Para no romper nada y mantener calidad, propongo dividirlo en **5 entregas independientes y validables**. Cada entrega queda funcional por sí sola.

NO se tocará: simuladores, OCR, PDFs comerciales, jurídica, expediente maestro, cartera ya creada.

---

## Entrega 1 — Fundaciones (rol + esquema + nav)

- Nuevo rol `contabilidad` en enum `app_role` + helper `can_manage_finanzas()`.
- Layout `/finanzas` (sidebar interno con submódulos) visible para `super_admin`, `admin`, `gerencia` y `contabilidad`.
- Tablas nuevas:
  - `nomina_empleados`, `nomina_pagos`
  - `tesoreria_movimientos` (ingresos/egresos con categoría)
  - `finanzas_auditoria` (usuario, rol, acción, valor_anterior, valor_nuevo, motivo, documento, created_at)
  - `finanzas_alertas` (tipo, severidad, expediente_id/cartera_id/cuenta_cobro_id, mensaje IA, leida)
- Ampliar enum `comision_estado` con: `no_causada`, `causada`, `pendiente_cuenta_cobro`, `radicada`, `aprobada`, `programada_pago`, `pagada`, `rechazada`.
- Bucket `comprobantes-finanzas` privado.

## Entrega 2 — Cartera Clientes + Recaudos

- Vista `/finanzas/cartera` con filtros por estado, días mora, banco, asesor.
- Vista `/finanzas/recaudos` para registrar pagos (usa `cartera_pagos` ya existente + comprobante en bucket).
- Validaciones: pago > saldo requiere confirmación; saldo cero → `estado_caso = honorarios_pagados` (ya cubierto por trigger existente).
- Auditoría automática de cada pago en `finanzas_auditoria`.

## Entrega 3 — Comisiones y Cuentas de Cobro v2

- Reescribir trigger `auto_liquidar_comision` para distinguir `causada` vs `pagada` y respetar nuevos estados.
- Vista licenciado `/comisiones`: seleccionar casos causados del mes → generar PDF cuenta de cobro (membrete NUVEX, periodo, NIT, casos, totales).
- Botón "Enviar a contabilidad" → envía email a `contabilidad@nuvex.com.co` con PDF adjunto + cambia estado a `radicada`.
- Panel `/finanzas/cuentas-cobro`: aprobar / rechazar (motivo obligatorio) / solicitar ajuste / programar pago / marcar pagada (comprobante obligatorio).
- Validaciones: no duplicar comisión por caso, no pagar sin honorarios recaudados, no marcar pagada sin comprobante.

## Entrega 4 — Nómina + Tesorería + Reportes

- `/finanzas/nomina`: CRUD empleados, pagos mensuales con estados (pendiente / programada / pagada / observada), comprobante obligatorio.
- `/finanzas/tesoreria`: registro de ingresos/egresos por categoría, flujo de caja diario y mensual, saldo proyectado vs real.
- `/finanzas/dashboard`: KPIs (ingresos causados/recaudados, honorarios pendientes/vencidos, comisiones por estado, nómina, flujo neto, rentabilidad por licenciado/banco/mes).
- `/finanzas/reportes`: exportar PDF/Excel (recaudo, cartera vencida, comisiones, nómina, flujo, rentabilidad).

## Entrega 5 — Alertas IA + Auditoría + cron

- `/finanzas/alertas`: centro unificado con badge en sidebar (realtime).
- Server route `/api/public/hooks/finanzas-alertas` evaluando las 12 alertas del brief + mensajes sugeridos vía Lovable AI (`google/gemini-2.5-flash`).
- pg_cron diario para generar alertas.
- `/finanzas/auditoria`: tabla filtrable de toda acción financiera con diff valor_anterior → valor_nuevo.

---

## Decisión

¿Arranco directamente con **Entrega 1 (rol + esquema + navegación)**? Es la base obligatoria para todo lo demás y no rompe nada existente. Al terminar te aviso y validamos antes de seguir con la 2.
