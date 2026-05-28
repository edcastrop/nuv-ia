# Validación de Identidad y Control Contractual

Sistema para evitar que datos mal digitados generen documentos jurídicos con errores. Introduce un ciclo formal de validación entre Licenciado → Contratación antes de habilitar la generación de cualquier documento dirigido al banco.

## 1. Modelo de datos (migración Supabase)

**Nuevas columnas en `expedientes`:**
- `validacion_estado` text default `'pendiente_validacion'` — enum lógico: `pendiente_validacion | en_revision_contratacion | devuelto_datos_incorrectos | datos_validados | bloqueado_inconsistencia`
- `validacion_confirmado_licenciado` bool default false
- `validacion_confirmado_at` timestamptz
- `validacion_aprobado_por` uuid (contratación)
- `validacion_aprobado_at` timestamptz
- `validacion_motivo_devolucion` text
- `validacion_version` int default 1 (incrementa cuando cambian datos críticos tras aprobación)

**Nueva tabla `expediente_validacion_historial`:**
- `id, expediente_id, accion (enviar|aprobar|devolver|bloquear|desbloquear|cambio_critico), motivo, datos_snapshot jsonb, user_id, created_at`

**Nueva tabla `documentos_jurídicos_versiones`** (marcar versiones obsoletas):
- `id, expediente_id, tipo (poder|contrato|solicitud_plazos|derecho_peticion|tutela|otros), version int, obsoleto bool default false, motivo_obsoleto text, created_by, created_at, snapshot jsonb`

**Trigger** en `expedientes`: si tras `datos_validados` se modifica cualquier columna crítica (nombre, cédula, banco, número_crédito, etc. dentro de `cliente_data`), marcar `validacion_estado = 'pendiente_validacion'`, incrementar `validacion_version`, marcar versiones documentales como `obsoleto = true`, e insertar historial `cambio_critico`.

**RLS y GRANTs:**
- Licenciado: SELECT/UPDATE en su propio expediente (solo si estado permite edición).
- Contratación + admin/gerencia/super_admin: SELECT/UPDATE todos; pueden aprobar/devolver/bloquear.
- Historial: insertable por authenticated; select por owner/contratación/admin.

## 2. Lógica de bloqueo (frontend + función)

**`src/lib/validacionIdentidad.ts`** (nuevo):
- `puedeGenerarDocumentos(expediente)` → solo `true` si `validacion_estado === 'datos_validados'`.
- `detectarInconsistencias(clienteData)` → heurísticas (nombre con números/caracteres raros, cédula longitud, ciudad inexistente vs `colombiaCities`, campos vacíos críticos).
- `confirmarDatosLicenciado(expedienteId)`, `enviarAValidacion`, `aprobarValidacion`, `devolverValidacion(motivo)`, `bloquearInconsistencia(motivo)`.

**Documentos bloqueados:** Poder, Contrato (Datos Contrato), Solicitud Cambio de Plazos, Derechos de petición, Tutelas, y cualquier doc dirigido al banco. Se inserta un guard en:
- `src/components/expediente-maestro/ModuloJuridico.tsx` (genera poder + solicitud plazos + DP/tutelas)
- `src/components/expediente-maestro/DocumentosLegales.tsx`
- `src/components/expediente-maestro/EnviarContratacion.tsx` (botón Enviar a Contratación queda bloqueado además por falta validación)

Mostrar alerta destacada cuando bloqueado:
> "Este expediente aún no tiene datos validados. No se pueden generar documentos jurídicos hasta que Contratación apruebe la información."

## 3. UI Licenciado

**Nuevo componente `ValidacionDatosCriticosBlock`** en MaestroEditor:
- Resumen visible de campos críticos (nombre, doc, banco, crédito, producto, dirección, cotitular).
- Panel de "Posibles inconsistencias" en rojo/ámbar con resultado de `detectarInconsistencias`.
- Checkbox: "Confirmo que revisé los datos críticos del cliente."
- Botón "Enviar a validación de Contratación" (deshabilitado hasta checkbox + sin inconsistencias críticas no resueltas).
- Si estado = `devuelto_datos_incorrectos`: banner con motivo y botón "Reenviar tras corregir".

## 4. UI Contratación

**Nueva ruta `src/routes/_authenticated/contratacion.validacion.tsx`**:
- Bandeja "Expedientes pendientes por validar" (filtro por estado `en_revision_contratacion`).
- Columnas: cliente, licenciado, banco, fecha creación, # datos críticos completos, link a documentos soporte (checklist).
- Detalle: revisión lado-a-lado de campos críticos + acciones:
  - **Aprobar datos** → estado `datos_validados`, registra auditoría, notifica al licenciado.
  - **Devolver por corrección** → exige motivo (select: nombre mal digitado, doc incorrecto, lugar expedición faltante, banco incorrecto, # crédito incorrecto, dirección incompleta, cotitular incompleto, otro + texto libre).
  - **Marcar inconsistencia crítica** → estado `bloqueado_inconsistencia`, notifica admin.

Acceso: roles `contratacion`, `juridica`, `admin`, `gerencia`, `super_admin`.

## 5. Notificaciones

Reusa `src/lib/notificaciones.ts` para:
- Devolución → al asesor_id del expediente.
- Aprobación → al asesor_id.
- Inconsistencia crítica → super_admin/gerencia.
- Cambio crítico post-aprobación → contratación + asesor.

## 6. Auditoría y versionamiento

- Cada acción inserta en `expediente_validacion_historial` + `auditoria_global`.
- Al generar un documento (poder/contrato/etc.), insertar fila en `documentos_juridicos_versiones` con snapshot del `cliente_data`.
- Al detectar cambio crítico tras aprobación (trigger), `UPDATE documentos_juridicos_versiones SET obsoleto = true, motivo_obsoleto = 'Cambio en dato crítico'` para ese expediente.
- En UI documental mostrar badge "OBSOLETO — regenerar" sobre documentos antiguos.

## 7. Permisos

- **Licenciado**: ingresar/corregir, confirmar checkbox, enviar a validación. NO puede aprobar.
- **Contratación/Jurídica**: aprobar, devolver, marcar inconsistencia.
- **Super Admin**: auditar todo + desbloqueo excepcional (botón "Desbloquear" con motivo obligatorio).

## 8. Plan de verificación (checklist final)

Ejecutar `tsc --noEmit` y validar manualmente los 13 escenarios del brief (crear correcto, crear mal digitado, alerta IA, envío, aprobación → desbloqueo, devolución → bloqueo, corrección, regeneración, cambio crítico → obsolescencia, nueva versión).

## Archivos a crear/editar

**Crear:**
- `supabase/migrations/<ts>_validacion_identidad.sql`
- `src/lib/validacionIdentidad.ts`
- `src/lib/validacionIdentidad.functions.ts` (server fns: aprobar/devolver/bloquear/desbloquear con auth + auditoría)
- `src/components/expediente-maestro/ValidacionDatosCriticosBlock.tsx`
- `src/components/contratacion/BandejaValidacion.tsx`
- `src/routes/_authenticated/contratacion.validacion.tsx`

**Editar:**
- `src/components/expediente-maestro/MaestroEditor.tsx` (montar bloque + propagar estado)
- `src/components/expediente-maestro/ModuloJuridico.tsx` (guard de generación)
- `src/components/expediente-maestro/DocumentosLegales.tsx` (guard)
- `src/components/expediente-maestro/EnviarContratacion.tsx` (sumar `validacion_estado !== 'datos_validados'` a `faltantes`)
- `src/components/nuvex/Layout.tsx` o sidebar de roles para exponer "Validación" a contratación/jurídica
- `src/lib/casoEstados.ts` (registrar estado validación si se desea reflejar en timeline)

Sin estos cambios, los licenciados podrán seguir generando documentos con errores tipográficos críticos que terminan en contratos y radicaciones bancarias incorrectas.
