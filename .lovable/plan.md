# NUVEX V2 — UX + Workflow Automático + Comisiones

Este es un cambio grande. Lo divido en 4 entregas independientes que se pueden validar por separado, manteniendo todas las prohibiciones (NO tocar simuladores, OCR, PDFs, jurídico, cartera).

---

## Entrega 1 — UX post-simulación: "Abrir Expediente"

**Objetivo:** después de guardar una simulación, mostrar confirmación con cliente/banco/producto y dos botones: `ABRIR EXPEDIENTE` (→ `/casos/$id`) y `SEGUIR SIMULANDO`.

**Cambios:**
- Nuevo componente `src/components/nuvex/CasoCreadoModal.tsx` (modal/card de éxito).
- Hook en `SaveExpedienteButton.tsx` (callback `onSaved` ya existe) → el padre (`PesosSimulator`, `UVRSimulator`) muestra el modal con los datos del expediente recién guardado.
- "Seguir simulando" = cierra el modal y resetea el simulador (usa `onReset` existente en Home).
- "Abrir expediente" = `navigate({ to: '/casos/$id', params: { id } })`.

Sin tocar la lógica del simulador, sólo el wrapper de "guardado exitoso".

---

## Entrega 2 — Workflow automático de estados (núcleo)

**Objetivo:** ampliar la máquina de estados con los 19 estados principales + 2 especiales, submotivos, disparadores automáticos y confirmaciones humanas.

### Migración SQL
1. Extender el enum `caso_estado` con los nuevos valores (prospecto, propuesta_enviada, acepto_propuesta, documentacion_completa, contrato_generado, contrato_firmado, poder_generado, poder_firmado, radicacion_preparada, radicado_banco, en_estudio_banco, aprobado_banco, docs_complementarios_banco, aplicado_banco, honorarios_pendientes, honorarios_pagados, caso_finalizado, devuelto_banco, negado_banco).  
   *Mantener los valores existentes para no romper datos.*
2. Nueva tabla `caso_submotivos` (expediente_id, estado, submotivo, observacion, created_at, user_id) con RLS espejando `expedientes`.
3. Nueva tabla `caso_alertas` (expediente_id, tipo, dias_estancado, leida, created_at) con RLS.

### Código
- `src/lib/casoEstados.ts`: añadir nuevos estados, mapa `ACCION_A_ESTADO` extendido, lista `ESTADOS_REQUIEREN_CONFIRMACION`, `SUBMOTIVOS_DEVUELTO`, `SUBMOTIVOS_NEGADO`, helpers `transicionAutomatica()` y `requiereSubmotivo()`.
- `useEstadoSugerido.ts`: soportar submotivo opcional en `confirmar`.
- `ConfirmEstadoModal.tsx`: cuando el estado destino sea `devuelto_banco` o `negado_banco`, mostrar `<select>` de submotivos (obligatorio).
- Disparadores automáticos: invocar `cambiarEstadoCaso(id, estado, accion)` desde:
  - `SaveExpedienteButton` (acción `simulacion_guardada` → `simulado`).
  - Componente que exporta PDF propuesta (sin tocar el PDF: añadir hook después del export). *Identificar punto exacto durante implementación.*
  - `ModuloJuridico` / `DocumentosLegales` cuando se genera contrato o poder (sólo hook post-acción).
  - `EnviarContratacion` (envío docs jurídica → `documentacion_completa`).
  - Cartera al crear cuenta de cobro / registrar pago (sólo hook, sin tocar lógica).

### Alertas de estancamiento
- Cron route `src/routes/api/public/hooks/casos-alertas.ts` (POST, verifica `CRON_SECRET`): recorre expedientes por estado, calcula días desde última transición vía `expediente_historial` y crea filas en `caso_alertas`.
- Componente `EstadoCasoBlock`: si existe alerta sin leer, badge de "Estancado N días".

---

## Entrega 3 — Centro de notificaciones + Dashboards

### Centro de notificaciones (nueva ruta `/_authenticated/notificaciones`)
Tabs: Mis casos estancados · Tareas pendientes · Sin seguimiento · Honorarios pendientes.  
Consulta `caso_alertas` + `expedientes` filtrados por `asesor_id`.

### Dashboard Super Admin (extender `super-admin.index.tsx`)
Bloques: casos por estado (simulado/estancado/radicado/aprobado/devuelto/negado/aplicado), honorarios pendientes vs pagados, facturación proyectada, ranking licenciados (ya existe parcialmente vía `porAsesor`).

### Métricas por banco y causales
- `src/lib/metricas.functions.ts` (`createServerFn` + `requireSupabaseAuth`): `getMetricasPorBanco()` y `getMetricasCausales()` (joins con `caso_submotivos`).
- Componente `MetricasBancos.tsx` y `MetricasCausales.tsx` (tablas + barras simples con CSS, sin nueva dependencia).

---

## Entrega 4 — Módulo Comisiones y Cuentas de Cobro

### Migración SQL
- `comisiones_reglas` (licenciado_id, banco, producto, porcentaje, vigencia_desde, vigencia_hasta).
- `comisiones` (expediente_id UNIQUE, licenciado_id, honorarios_cobrados, porcentaje, valor_comision, fecha_causacion).
- `cuentas_cobro` (id, licenciado_id, periodo_desde, periodo_hasta, total, estado, pdf_path, enviada_at, contabilidad_at, pagada_at, observacion).
- `cuentas_cobro_items` (cuenta_id, comision_id UNIQUE) — la unicidad evita duplicar casos.
- `cuentas_cobro_historial` (cuenta_id, estado_anterior, estado_nuevo, user_id, observacion, created_at).
- RLS: licenciados ven sus comisiones; contabilidad/super_admin ven todas. Nuevo rol `contabilidad` agregado al enum `app_role` si no existe.

### Liquidación automática
Trigger en `expedientes` (o hook en `cambiarEstadoCaso`): al pasar a `honorarios_pagados`, insertar fila en `comisiones` aplicando la regla vigente para ese licenciado/banco. Idempotente vía UNIQUE(expediente_id).

### UI
- Ruta `/_authenticated/comisiones` (visible para licenciado/asesor/coordinador/super_admin):
  - Tab "Mis comisiones" (tabla: cliente, banco, producto, honorarios, comisión, estado).
  - Tab "Generar cuenta de cobro" (filtros periodo/casos, checklist, botón → server fn).
- Ruta `/_authenticated/comisiones/$id`: detalle de cuenta de cobro, botón `ENVIAR A CONTABILIDAD` (usa Resend vía connector existente → `contabilidad@nuvex.com.co`).
- Ruta `/_authenticated/contabilidad/cuentas-cobro` (rol contabilidad/super_admin): aprobar / rechazar / solicitar ajuste / marcar como pagada.
- Dashboard comisiones: bloque dentro de super-admin con totales por estado.

### PDF cuenta de cobro
Reutilizar `nuvexPdfKit` ya existente (NO modificarlo, sólo invocarlo desde `src/lib/cuentasCobro.functions.ts`). Genera PDF y lo sube al bucket `extractos` (o nuevo bucket `cuentas-cobro`).

---

## Orden de implementación y validación

1. **Entrega 1** sola (rápida, alto impacto UX) → validar.
2. **Entrega 2** (migración + workflow) → validar transiciones y alertas con un caso real.
3. **Entrega 3** (notificaciones + dashboards) → validar métricas.
4. **Entrega 4** (comisiones) → validar liquidación automática y envío a contabilidad.

Cada entrega es independiente y la app sigue funcionando entre entregas.

## Aprobación necesaria

Por el tamaño, propongo empezar **sólo con Entrega 1 ahora** y, una vez validada en producción, seguir con Entrega 2. ¿Confirmas que arranque por la 1, o prefieres que empuje las 4 entregas seguidas (varios mensajes, varias migraciones)?
