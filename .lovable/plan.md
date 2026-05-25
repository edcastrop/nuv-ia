# Plan — Ajuste financiero NUVEX (honorarios a éxito + cartera + comisiones)

Este es un cambio grande que toca BD, cartera, finanzas, comisiones, cuentas de cobro y auditoría. Lo divido en fases para poder validar entre cada una.

## Fase 1 — Recálculo de honorarios a éxito (base del resto)

**BD (migración):**
- `expedientes`: agregar `cuotas_pactadas int`, `cuotas_aprobadas_banco int`, `honorarios_pactados numeric`, `honorarios_recalculados numeric`, `recalculo_user_id uuid`, `recalculo_at timestamptz`.
- Trigger / función `recalc_honorarios_exito()`:
  - si `cuotas_aprobadas = cuotas_pactadas` → `honorarios_final = honorarios_pactados`
  - si `cuotas_aprobadas < cuotas_pactadas` → `honorarios_final = round(honorarios_pactados / cuotas_pactadas * cuotas_aprobadas)`
  - si `cuotas_aprobadas > cuotas_pactadas` → mantener pactados (solo super_admin puede subir manualmente)
  - validar no negativo y no cero si hubo éxito.
- Registrar en `finanzas_auditoria` (entidad `expediente`, acción `recalculo_honorarios`).

**UI:**
- En `ResultadoFinal` (módulo del expediente) → bloque **"Reajuste de honorarios a éxito"** con: cuotas pactadas, cuotas aprobadas, honorarios pactados, honorarios recalculados, diferencia a favor del cliente, alerta amarilla cuando hubo recálculo.
- Inputs editables (cuotas aprobadas banco) solo para roles autorizados.

## Fase 2 — Cartera usa honorarios recalculados + métodos de pago + soporte

**BD:**
- `cartera_pagos`: agregar `metodo_pago text` (transferencia, tarjeta_wompi, nequi, pse, efectivo, otro), `cuenta_receptora_id uuid`, `valor_bruto numeric`, `fee_wompi numeric`, `iva_fee numeric`, `valor_neto numeric`, `numero_transaccion text`. (Algunos ya existen — reuso `comprobante_url`, `comprobante_num`.)
- Nueva tabla `cuentas_receptoras` (banco, tipo, número, titular, nit, estado, observaciones) con RLS finanzas.
- Nueva tabla `parametros_financieros` (key/value JSON) para fee_wompi_porcentaje, comision_predeterminada_licenciado (50), iva_fee_wompi, etc.
- Trigger en `cartera`: al crear, tomar `honorarios_final` del expediente (que ya considera recálculo).
- Validación: pago no puede quedar validado sin `comprobante_url` salvo super_admin.

**UI:**
- `CarteraDetalle`: select método de pago obligatorio, select cuenta receptora, drag&drop comprobante (reuso patrón del Expediente Maestro), si método = wompi mostrar valor bruto / fee / iva / neto auto-calculado.
- Catálogo de cuentas receptoras editable bajo `/finanzas/cuentas-receptoras` (admin/contabilidad).

## Fase 3 — Comisión licenciado parametrizable + casos comisionables

**BD:**
- `cuentas_cobro`: el campo `porcentaje_comision` ya existe. Ampliar enum permitido a {30,35,40,45,50}.
- Agregar columna `comisionable` (vista o flag derivado en `comisiones`): el trigger `auto_liquidar_comision` ya genera comisión cuando `estado_caso = honorarios_pagados`. Modificar para tomar `porcentaje` del parámetro `comision_predeterminada_licenciado` (default 50) si no hay regla específica, y usar `honorarios_final` (recalculado).
- Anti-duplicado: ya hay `unique (expediente_id, user_id, rol)` en `comisiones`; agregar check que no permita asignar el mismo `expediente_id` a dos `cuenta_cobro_id` activas.

**UI (`comisiones.index.tsx` + `comisiones.$id.tsx`):**
- Lista "Casos comisionables del mes" con selector multi-caso.
- Selector porcentaje {30,35,40,45,50} con default desde parámetro.
- Recalcular valor en vivo.
- Botón "Enviar a Contabilidad" deshabilitado si: no hay %, no hay casos, valor ≤ 0, duplicados.
- PDF: agregar columna porcentaje y estado de revisión (ya existe `cuentaCobroPdf.ts`, ampliar).

## Fase 4 — Contabilidad: devolución y estados extendidos

**BD:**
- `cuentas_cobro.estado` ampliar a: borrador, enviada, pendiente_revision, aprobada, devuelta_correccion, rechazada, programada_pago, pagada.
- Nueva columna `motivo_devolucion text`, `version int default 1`.
- Al devolver, incrementar versión y guardar snapshot en `cuentas_cobro_historial`.

**UI (`contabilidad.cuentas-cobro.tsx`):**
- Acciones: aprobar, devolver (motivo obligatorio), rechazar, programar pago, marcar pagada.
- Vista licenciado: si estado = devuelta_correccion, permitir editar y reenviar.
- Notificaciones (insert en `caso_alertas` o tabla `notificaciones` si la creamos — reuso `finanzas_alertas`).

## Fase 5 — Auditoría

- Cada acción (recálculo, registro de pago, aprobación CC, devolución) inserta en `finanzas_auditoria` con valor_anterior/nuevo y motivo.

---

## Archivos principales a editar/crear

- `supabase/migrations/<timestamp>_recalculo_honorarios_y_cobros.sql` (Fase 1+2+3+4 en una sola migración)
- `src/lib/honorarios.ts` (helpers de recálculo client-side)
- `src/components/nuvex/ResultadoFinal.tsx` (bloque reajuste)
- `src/lib/cartera.ts` + `cartera.functions.ts` (métodos pago, wompi, cuenta receptora, soporte obligatorio)
- `src/components/cartera/CarteraDetalle*.tsx` (UI pagos)
- `src/lib/cuentasReceptoras.ts` + ruta `/finanzas/cuentas-receptoras`
- `src/lib/parametrosFinancieros.ts` + UI en `/finanzas/parametros`
- `src/lib/comisiones.ts` + `comisiones.functions.ts` (% extendido, anti-duplicado, devolución)
- `src/routes/_authenticated/comisiones.$id.tsx` (selector %, validaciones)
- `src/routes/_authenticated/contabilidad.cuentas-cobro.tsx` (estados extendidos, devolver con motivo)
- `src/lib/cuentaCobroPdf.ts` (mostrar % y estado revisión)

---

## Preguntas antes de empezar

1. **¿Construyo todo en una sola entrega o prefieres validar fase por fase?** Recomiendo fase por fase (es 1–2 días de trabajo total y permite probar cada bloque).
2. **Cuenta receptora inicial**: confirmas datos exactos a precargar (Bancolombia, número, titular, NIT)? Si no, dejo la fila Bancolombia "Activa" sin número y la editas en UI.
3. **Notificaciones a contabilidad/licenciado**: ¿solo dentro del sistema (campanita) o también por correo (Resend ya está configurado)?
4. **El campo "Cuotas pactadas" hoy ya existe en `propuesta_data` JSON** — ¿lo migro al esquema tipado o lo dejo en JSON y solo agrego `cuotas_aprobadas_banco` + `honorarios_recalculados` como columnas?

Cuando me confirmes, arranco con Fase 1 (recálculo) que es la base del resto.
