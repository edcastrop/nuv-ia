## Fase 2 NUVIA QA AI — Operacionalización

### 1. Migración correctiva (única migración SQL)

**`qa_alertas`** — agregar columnas para cierre auditable:
- `resuelta_by uuid`, `resuelta_at timestamptz`, `notas text`

**Nueva tabla `qa_reglas_historial`** — versionado de cambios de reglas:
- `regla_id`, `codigo`, `version_anterior`, `version_nueva`, `payload_anterior jsonb`, `payload_nuevo jsonb`, `changed_by uuid`, `changed_at timestamptz`
- GRANTs a `authenticated`/`service_role` + RLS:
  - SELECT: `can_use_qa_ai(auth.uid())` (cualquier autorizado QA puede leer historial)
  - INSERT: `can_use_qa_ai(auth.uid())`
  - sin UPDATE/DELETE (inmutable, append-only)

**Trigger `qa_reglas_audit`** sobre `qa_reglas BEFORE UPDATE`:
- Si cambia `payload`, incrementa `version`, copia `auth.uid()` a `updated_by`, refresca `updated_at`, y registra fila en `qa_reglas_historial`.

### 2. Server functions (`src/lib/qaAI.functions.ts`)

Nuevas, todas protegidas por `requireSupabaseAuth`. Las de escritura validan `can_use_qa_ai` server-side antes de ejecutar:

- `listAlertasQA({ severidad?, estado?, banco?, analistaId? })` — JOIN con `qa_auditorias` para mapear `analista_id`/`modalidad` + JOIN opcional con `expedientes` para `banco`/`codigo`/`cliente_nombre`.
- `obtenerAlertaQA(id)` — detalle + datos de la auditoría asociada (link al dictamen).
- `actualizarAlertaQA({ id, accion: "reconocer" | "resolver", notas? })` — cambia estado, registra `reconocida_by/at` o `resuelta_by/at`. Inserta entry en `qa_auditoria_log`.
- `listReglasQA()` — lectura de las 16 reglas seed agrupadas por `tipo` (tolerancia / umbral / penalizacion).
- `actualizarReglaQA({ id, payload })` — chequea rol vía `has_role`, UPDATE → el trigger maneja versión + historial.
- `listHistorialReglaQA(id)` — últimas N entradas de `qa_reglas_historial`.
- `cargarToleranciasActivas()` — lee `qa_reglas where activa=true`, devuelve objeto `Partial<Tolerancias>` listo para inyectar en `qaMath.auditar()`.
- `qaKpis` (extender) — agrega `pendientesRevision` (dictamen `requiere_revision`), `topTipoInconsistencia` (agregación count por `tipo` de `qa_inconsistencias`).

**`auditarCaso` (modificar):** antes de llamar `auditar(...)`, carga reglas activas y las pasa como `tolerancias` override. El default `TOLERANCIAS_DEFAULT` queda como fallback si la regla está inactiva o falta.

### 3. Rutas nuevas (2)

**`/qa-ai/alertas`** (`src/routes/_authenticated/qa-ai.alertas.tsx`):
- `ExecutiveHero` + `KpiGrid` (abiertas / reconocidas / resueltas hoy).
- `FilterBar` con `NSelect` para severidad, estado, banco, analista.
- Tabla NUVIA dark con columnas: fecha, severidad (badge color), tipo, mensaje, expediente (link), score auditoría, estado, acciones.
- Acciones por fila: "Reconocer" (estado abierta → reconocida) y "Resolver" (cualquier → resuelta con textarea para notas), modal `dialog`.
- Click en fila → drawer/modal con detalle + link "Ver dictamen" → `/qa-ai/$id`.
- Acciones deshabilitadas si rol no autorizado.

**`/qa-ai/config`** (`src/routes/_authenticated/qa-ai.config.tsx`):
- `ExecutiveHero` con badge "Reglas y tolerancias · v{maxVersion}".
- 3 `NCard` separadas: **Tolerancias** (5 reglas), **Umbrales** (4 reglas), **Penalizaciones** (6 reglas).
- Cada regla = fila con descripción + inputs `.nuvia-input-sm` por key de payload (ej. `abs`, `pct`).
- Botón "Guardar" por regla → llama `actualizarReglaQA` → mensaje "Versión bumped a N".
- Sub-card "Historial reciente" desplegable por regla (últimas 5 entradas con `changed_by`/`changed_at`).
- **Lectura abierta para todos los roles QA; edición solo si `canValidarProyeccion` (super_admin / director_financiero_qa / gerencia)** — inputs deshabilitados y banner "Solo lectura — contacta a Dirección QA" para roles menores.

### 4. Dashboard `/qa-ai` (extender)

En `qa-ai.index.tsx`:
- 2 KPIs nuevos: "Pendientes revisión" + "Tipo inconsistencia más frecuente".
- 3 botones en `ExecutiveHero.actions`: "Auditar nuevo" (existente) + "Ver alertas" + "Configurar reglas" (este último solo visible si `canValidarProyeccion`).

### 5. Seguridad / RLS

| Acción | Roles autorizados |
|---|---|
| Ver alertas | Cualquier rol con acceso a QA AI (RLS existente `qa_alertas_select`) |
| Reconocer/resolver alerta | `can_use_qa_ai` (existente `qa_alertas_write`) |
| Leer reglas | Todos los autenticados (RLS existente `qa_reglas_select USING (true)`) |
| Editar reglas | `can_use_qa_ai` (existente `qa_reglas_write`) — además check server-side en `actualizarReglaQA` |
| Leer historial | `can_use_qa_ai` (nueva policy) |

Analistas (`asesor`, `licenciado`, etc.) ven resultados y alertas pero NO pueden editar tolerancias — bloqueo doble: UI deshabilita inputs + server fn rechaza.

### Fuera de alcance (Fase 2)
- Copiloto IA, export PDF, bloqueo automático de pipeline, ML, corrección automática.
- Cero cambios a: Pipeline, Expedientes, Simuladores, Honorarios, Contratación, Treasury, Cartera.

### Riesgos detectados

1. **Trigger de versionado puede generar loops** si `updated_at` se incluye en el chequeo de cambio — el trigger comparará solo `payload` y `activa`, no metadatos. Mitigación: condición `OLD.payload IS DISTINCT FROM NEW.payload OR OLD.activa IS DISTINCT FROM NEW.activa`.
2. **Reglas con payload incompatible** (ej. `tol.cuota` sin `abs`) → motor caerá a fallback `TOLERANCIAS_DEFAULT`. Mitigación: validación Zod en `actualizarReglaQA` por código (`tol.cuota` exige `abs` y `pct`).
3. **Race condition** si dos directores editan la misma regla en simultáneo — el trigger incrementa versión secuencial, el último gana. No es crítico, el historial preserva ambos. No se implementa optimistic locking en Fase 2.
4. **Alertas huérfanas** (auditoría borrada) — FK con `ON DELETE CASCADE` ya existe; no requiere acción.
5. **Cambio de tolerancias retroactivo** — auditorías históricas conservan el score con tolerancias del momento (ya guardado en `qa_auditorias.outputs`), no se recalculan. Comportamiento esperado y deseable.
6. **UI de config con 15 reglas en una sola pantalla** puede saturarse — mitigado con 3 secciones agrupadas + `NCard` con scroll independiente.

### Entregables al finalizar
- Archivos modificados: `qaAI.functions.ts`, `qa-ai.index.tsx`
- Archivos nuevos: `qa-ai.alertas.tsx`, `qa-ai.config.tsx`
- Migración: 1 sola con columnas qa_alertas + tabla historial + trigger + RLS
- Confirmación: `auditarCaso` carga `cargarToleranciasActivas()` antes de ejecutar el motor
- Validación funcional: crear alerta de prueba → reconocerla → resolverla; editar `tol.cuota` → ver versión bumped a 2 → confirmar que próxima auditoría usa nuevo umbral
- Riesgos arriba documentados
