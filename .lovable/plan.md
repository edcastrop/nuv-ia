# Fase 4 — Integración automática QA

Objetivo: que NUVIA Financial QA AI se ejecute automáticamente al finalizar la lectura de un extracto, persista el dictamen en el expediente, exponga badges en Pipeline/Expediente/Torre/Dashboard y bloquee transiciones cuando el dictamen sea **QA FAILED**. Sin nuevos módulos, sin nuevos formularios, sin duplicar datos.

## Alcance autorizado

- Modificar `MotorExtractosNUVEX` (lector de extractos) para disparar `auditarCaso` automáticamente al confirmar la lectura.
- Modificar pantalla del Expediente para añadir sección **QA FINANCIERO** y badge.
- Modificar Pipeline / Torre de Control / Dashboard sólo para mostrar badges y un nuevo widget "Salud del Pipeline QA".
- Añadir guardas operativas que impidan avanzar etapas cuando `dictamen = QA FAILED`.

## Fuera de alcance (no se toca)

Simuladores PESOS/UVR, Honorarios, Contratación, Treasury AI, Cartera, Mensajería, NUVIA IA. Tampoco se crean rutas nuevas en `/qa-ai`.

---

## Cambios técnicos

### 1. Base de datos (1 migración)

- `qa_auditorias`: agregar columnas `extracto_lectura_id uuid REFERENCES extractos_lecturas(id)`, `categoria text` (QA_CERTIFIED / APROBADO_OBS / REQUIERE_REVISION / QA_FAILED), `auto_ejecutada boolean default false`.
- `expedientes`: agregar columnas denormalizadas `qa_score numeric`, `qa_dictamen text`, `qa_categoria text`, `qa_auditoria_id uuid`, `qa_ejecutada_at timestamptz`. Sirven para badges en pipeline/torre sin joins costosos.
- Trigger `trg_qa_sync_expediente` en `qa_auditorias AFTER INSERT/UPDATE`: copia score, dictamen, categoría e id al `expedientes` correspondiente.
- Función `public.qa_bloquea_avance(_expediente_id uuid) RETURNS boolean` (SECURITY DEFINER): `true` si la última auditoría es `QA_FAILED`.
- RLS: políticas existentes ya cubren lectura por `can_access_expediente`; sólo añadir `GRANT` para nuevas columnas (heredan).

### 2. Disparo automático tras lectura de extracto

`src/components/nuvex/MotorExtractosNUVEX.tsx` → en `confirmar()`, después del `insert` exitoso:
- Si hay `expedienteId`: obtener `id` del registro recién creado en `extractos_lecturas`.
- Invocar `auditarCaso({ expedienteId, extractoLecturaId, auto: true })`.
- Mostrar inline (no modal) el resultado: chip con score + categoría + link a `/qa-ai/:id` para detalle.
- Manejo de error tolerante: si la auditoría falla, mostrar aviso pero NO revertir la lectura.

### 3. `src/lib/qaAI.functions.ts` — `auditarCaso`

- Aceptar nuevo input opcional `extractoLecturaId` y bandera `auto`.
- Cuando se llama con `extractoLecturaId`, leer directamente ese registro (en vez de la última lectura del expediente). Reutiliza el resto del motor sin recálculos.
- Persistir `extracto_lectura_id`, `auto_ejecutada=true`, `categoria` derivada del score con los umbrales configurables existentes.
- Crear/actualizar alertas QA como ya hace hoy.

### 4. Sección "QA Financiero" en Expediente

`src/components/expediente/QAFinancieroBlock.tsx` (nuevo, componente puro):
- Lee `qa_auditorias` por `expediente_id` ordenado desc, `limit 1`.
- Muestra: badge categoría, Score, dictamen, fecha, top 5 hallazgos (`qa_inconsistencias`), responsable, alertas abiertas (`qa_alertas`), botón "Ver dictamen completo" → `/qa-ai/:id` (ya existe), botón "Reejecutar auditoría" (sólo roles `can_use_qa_ai`).
- Montar el bloque en la página del expediente justo después del bloque de extractos.

### 5. Badges visuales globales

Componente compartido `src/components/qa-ai/QABadge.tsx`:
- Input: `categoria | null`.
- Salida: chip con color (🟢 CERTIFIED / 🟡 OBSERVADO / 🟠 REVISIÓN / 🔴 FAILED) y tooltip con score.
- Integrar en:
  - Tarjeta de caso del **Pipeline** (`KpisPipeline14` lista de expedientes).
  - Encabezado del **Expediente**.
  - Tabla del **Torre de Control** (CommandCenter widget de casos).
  - **Dashboard** `/inicio` (RoleHome) al lado de cada caso reciente.
- Todos consumen las columnas denormalizadas en `expedientes`.

### 6. Guardas operativas (bloqueo QA FAILED)

- Helper `src/lib/qaGuard.ts`: `requireQaOk(expedienteId)` → consulta `qa_categoria` y lanza error UX si `QA_FAILED`.
- Aplicar en los puntos de transición que ya existen, sin tocar lógica de negocio:
  - Botón "Enviar a Director Financiero" / "Solicitar validación QA proyección".
  - Botón "Enviar a Contratación" en `EnviarContratacion`.
  - Botón "Avanzar etapa" en `EtapaTransicionDialog`.
- Mensaje uniforme: "El caso debe corregirse antes de continuar. Última auditoría QA falló (score X)".

### 7. Métricas y widget Torre de Control

- Extender `src/lib/qaAI.functions.ts` con `qaKpisGlobales()`:
  - Casos auditados hoy, errores detectados/corregidos, promedio score, % aprobados/observados/rechazados, tiempo ahorrado estimado (count auditorías auto × 4 min).
- Nuevo widget `src/components/torre-control/widgets/SaludPipelineQA.tsx`:
  - KPIs anteriores + listado top 5 tipos de inconsistencia + top analistas con más errores (group by `expedientes.asesor_id`).
- Integrarlo en el grid existente del Command Center (sin reorganizarlo).

---

## Riesgos

- **Latencia en confirmar lectura**: la auditoría puede tardar varios segundos. Mitigación: ejecutar `auditarCaso` en background, mostrar estado "Auditando…" en la UI del lector y permitir cerrar el modal.
- **Auditorías con datos faltantes**: si el extracto no trae cuota/tasa, el motor genera `QA_FAILED` automáticamente. Es comportamiento deseado, pero se documenta en el bloque con sugerencia "Completar campos críticos antes de reauditar".
- **Bloqueo retroactivo**: expedientes existentes sin auditoría no se bloquean (qa_categoria null = permitido). Sólo bloquea cuando explícitamente es FAILED.
- **Permisos**: la inserción en `qa_auditorias` desde el motor de extractos requiere que cualquier analista pueda crear auditorías. Las políticas actuales lo permiten vía `can_use_qa_ai` extendida a roles operativos — se ajusta la policy de INSERT a `auth.uid() = asesor_id` del expediente para no abrir demasiado.
- **Trigger sync**: si una auditoría se borra, las columnas denormalizadas pueden quedar desactualizadas. Se incluye `AFTER DELETE` para recomputar a la auditoría previa o limpiar.

---

## Entregables al finalizar

- Migración aplicada (columnas, trigger, función guard).
- `MotorExtractosNUVEX` con disparo automático verificado.
- Componente `QAFinancieroBlock` montado en Expediente.
- `QABadge` integrado en Pipeline, Expediente, Torre, Dashboard.
- Guardas operativas en los 3 puntos de transición listados.
- Widget Salud Pipeline QA en Torre de Control.
- Reporte de QA funcional: flujo end-to-end (subir extracto → ver dictamen → bloqueo si FAILED).

¿Apruebas la Fase 4 con este alcance?
