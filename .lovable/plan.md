# Módulo Roles, Permisos, Validación QA y Auditoría — NUVEX

Solución escalable (10 → 100+ licenciados) integrada con casos, expedientes, simulador, jurídica, cartera y contabilidad. Sin romper funcionalidades existentes.

---

## 1. Roles y jerarquías (RBAC)

Ampliar enum `app_role` con los nuevos roles y asegurar que los existentes sigan funcionando.

Roles finales:
- `super_admin` (existe)
- `gerencia` (existe → "Gerencia Administrativa")
- `director_financiero_qa` (**NUEVO**)
- `director_juridico` (**NUEVO**)
- `juridica` (existe → "Analista Jurídico")
- `contabilidad` (existe)
- `licenciado` (existe)
- `auxiliar_operativo` (**NUEVO**, reemplaza/coexiste con `operaciones`)
- `apoderado` (**NUEVO**)
- `admin`, `asesor`, `cartera` se conservan por compatibilidad

Helpers SQL (security definer, evitan recursión RLS):
- `is_director_qa(uid)`, `is_director_juridico(uid)`, `is_auxiliar(uid)`, `is_apoderado(uid)`
- `can_validar_proyeccion(uid)` = super_admin OR director_financiero_qa
- `can_aprobar_doc_juridico(uid)` = super_admin OR director_juridico

Cliente: ampliar `src/hooks/useUserRole.ts` con `isDirectorQA`, `isDirectorJuridico`, `isApoderado`, `isAuxiliar`, y helper `can(modulo, accion)`.

---

## 2. Validación Financiera QA (flujo obligatorio)

Nuevos valores en `caso_estado`:
- `proyeccion_pendiente_qa`
- `proyeccion_aprobada_qa`
- `proyeccion_devuelta_qa`

Mapeo en `map_caso_to_expediente_estado`: los tres → `SIMULADO` (no avanza el expediente hasta aprobación).

Flujo:
```
simulacion_realizada
  → [Licenciado: "Enviar a Validación Financiera"]
proyeccion_pendiente_qa
  → [QA: Aprobar]  → proyeccion_aprobada_qa → habilita "Presentar propuesta"
  → [QA: Devolver] → proyeccion_devuelta_qa  (motivo + observación obligatoria)
```

Regla bloqueante: el botón "Presentar propuesta" / "Enviar a contratación" se deshabilita si el caso no está en `proyeccion_aprobada_qa` (excepto super_admin con override auditado).

Tabla nueva `validaciones_qa`:
- `expediente_id`, `solicitada_por`, `solicitada_at`
- `validada_por`, `validada_at`
- `resultado` ('aprobada'|'devuelta')
- `motivo` (enum: cuota_incorrecta, fresh_incorrecto, ocr_incorrecto, honorarios_incorrectos, error_financiero, error_digitacion, otro)
- `observacion` (text, obligatoria si devuelta)
- `tiempo_validacion_min` (calculado)
- RLS: licenciado ve las suyas; QA, gerencia y super_admin ven todas.

Trigger `audit_validacion_qa` → `finanzas_auditoria` + `caso_alertas`.

---

## 3. Dashboard Financiero QA

Nueva ruta `src/routes/_authenticated/qa.index.tsx` (sólo visible para director_financiero_qa, super_admin, gerencia).

Componentes:
- KPIs: pendientes por validar, aprobadas hoy, devueltas hoy, tiempo promedio (min).
- Tabla "Pendientes" con acción rápida → modal Aprobar/Devolver.
- Ranking licenciados: Simulaciones, Aprobadas, Devueltas, Calidad %.
  - Calidad % = aprobadas_primera_revision / total_simulaciones
  - Semáforo: ≥95 verde, 85-94 ámbar, <85 rojo.

Vistas SQL: `qa_metrics_diarias`, `qa_ranking_licenciados` (materializadas para escalar).

---

## 4. Centro de Configuración — Roles y Permisos

Tablas nuevas:
- `permisos_catalogo` (`modulo`, `accion`) — semilla con módulos: casos, expedientes, simulador, juridico, cartera, contabilidad, dashboard, apoderados, academia, configuracion × acciones: ver, crear, editar, aprobar, eliminar, exportar.
- `rol_permisos` (`role`, `modulo`, `accion`, `permitido`) — matriz editable.
- `roles_personalizados` (`nombre`, `clonado_de`, `activo`) para futura expansión (clonar/activar/desactivar).

Helper `has_permission(uid, modulo, accion)` — consulta `user_roles` ∪ `rol_permisos`, retorna boolean; usado en RLS y UI.

UI nueva: `src/routes/_authenticated/super-admin.permisos.tsx` con matriz editable (sólo super_admin). Mantiene defaults por código si la tabla está vacía.

---

## 5. Auditoría empresarial

Aprovechar `finanzas_auditoria` (ya existe). Generalizar uso y añadir tabla nueva `auditoria_global`:
- `user_id`, `rol_efectivo`, `accion`, `entidad`, `entidad_id`, `caso_id`, `expediente_id`, `valor_anterior` jsonb, `valor_nuevo` jsonb, `ip`, `user_agent`, `observacion`, `created_at`.

Helper `audit_log(...)` (function) llamado desde:
- Cambios de estado (trigger sobre `expedientes`)
- Aprobaciones / rechazos QA y jurídico
- Pagos (`cartera_pagos` ya audita; replicar a global)
- Modificaciones de permisos
- Generación de documentos
- Eliminaciones

UI: `src/routes/_authenticated/super-admin.auditoria.tsx` — filtros por usuario, rol, acción, fecha, entidad. Export CSV.

---

## 6. Notificaciones inteligentes

Usar `caso_alertas` + `finanzas_alertas` (ya existen) + nueva tabla `notificaciones_usuario`:
- `user_id`, `tipo`, `titulo`, `mensaje`, `link`, `leida`, `created_at`, `severidad`.

Triggers automáticos:
- `proyeccion_pendiente_qa` → notifica a todos los director_financiero_qa.
- Aprobada / devuelta → notifica al licenciado dueño.
- `caso_alertas` cron existente (`casos-alertas.ts`) ya cubre >7 días para gerencia.
- CC `enviada` → notifica a contabilidad.
- `comision_liberada` (alerta ya existe) → notifica al licenciado.

Componente `NotificationBell` en el header (badge con conteo no leídas, realtime por canal supabase).

---

## 7. Integración UI

- `EstadoCasoBlock`: añadir botones contextuales según rol y estado (Enviar a QA / Aprobar QA / Devolver QA).
- `casos.$id.tsx`: banner amarillo si `proyeccion_devuelta_qa` con motivo + observación.
- Sidebar (`_authenticated.tsx`): nuevos enlaces "Validación QA" (QA + gerencia + super), "Permisos" (super), "Auditoría" (super), "Notificaciones".
- Apoderado: vista simplificada `/mis-casos` (sólo expedientes con `apoderado_id = uid`, sin cartera/honorarios/simulaciones).

---

## Cambios técnicos (resumen)

**Migraciones SQL:**
1. ALTER TYPE `app_role` ADD VALUES (`director_financiero_qa`, `director_juridico`, `auxiliar_operativo`, `apoderado`).
2. ALTER TYPE `caso_estado` ADD VALUES (`proyeccion_pendiente_qa`, `proyeccion_aprobada_qa`, `proyeccion_devuelta_qa`).
3. CREATE TABLE `validaciones_qa`, `permisos_catalogo`, `rol_permisos`, `roles_personalizados`, `auditoria_global`, `notificaciones_usuario`.
4. CREATE FUNCTION `has_permission`, `can_validar_proyeccion`, `can_aprobar_doc_juridico`, `audit_log`, `notify_user`.
5. Triggers de auditoría/notificación sobre `expedientes`, `validaciones_qa`, `cuentas_cobro`, `cartera_pagos`, `comisiones`, `rol_permisos`.
6. Vistas/materialized views `qa_metrics_diarias`, `qa_ranking_licenciados`.
7. Update `map_caso_to_expediente_estado` con nuevos estados.
8. RLS para todas las tablas nuevas usando los nuevos helpers.

**Código TypeScript/React:**
- `src/lib/permisos.ts` — wrapper `can(modulo, accion)` + tipos.
- `src/lib/validacionQA.functions.ts` — `enviarAQA`, `aprobarQA`, `devolverQA`.
- `src/lib/notificaciones.ts` — fetch + realtime + marcar leídas.
- `src/lib/auditoria.ts` — `logAccion()` helper para callsites cliente.
- `src/hooks/useUserRole.ts` — ampliado.
- `src/hooks/useNotificaciones.ts` (nuevo).
- `src/components/notificaciones/NotificationBell.tsx`.
- `src/components/qa/EnviarValidacionButton.tsx`, `AprobarQAModal.tsx`, `DevolverQAModal.tsx`.
- Rutas: `qa.index.tsx`, `super-admin.permisos.tsx`, `super-admin.auditoria.tsx`, `apoderado.mis-casos.tsx`.
- Sidebar y `casos.$id.tsx` actualizados.

**Lo que NO se toca:**
- Motor OCR
- Simuladores (Pesos/UVR)
- Cálculo de honorarios y recálculo a éxito
- Generación de PDFs y contratos
- Lógica de cartera y comisiones por recaudo real
- Mapeo casos↔expedientes (sólo se extiende para los 3 nuevos estados)

---

## Plan de ejecución (orden propuesto)

1. Migración SQL (enums, tablas, funciones, RLS, triggers, seed permisos).
2. Hooks y libs cliente (`useUserRole`, `permisos.ts`, `validacionQA.functions.ts`, `notificaciones.ts`).
3. Botones QA en `EstadoCasoBlock` + bloqueo de "Presentar propuesta".
4. Dashboard QA + ranking.
5. Centro de permisos (matriz editable).
6. Vista de auditoría global.
7. Campana de notificaciones (header + realtime).
8. Vista apoderado.
9. QA visual + ajustes finales sin romper estilos NUVEX.

¿Aprueba el plan para iniciar la implementación?
