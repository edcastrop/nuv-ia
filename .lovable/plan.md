# NUVEX Financial Audit Engine™ — Etapas C → G

Continuamos sobre lo ya construido (Etapas A y B): tablas `audit_simulaciones`, `audit_respuestas_banco`, `analista_metricas`, `audit_alertas` y el motor puro `src/lib/auditEngine.ts`.

## Decisiones confirmadas por el usuario

### Niveles de autonomía
- **Nivel 1 — Supervisada** (< 30 simulaciones o score histórico < 85)
  - Score ≥ 95 → genera PDF marcado "Pendiente Auditoría"
  - Score 85–94 → bloqueado, escala a Dirección Financiera
  - Score < 85 → bloqueado
- **Nivel 2 — Intermedia** (≥ 30 simulaciones y score histórico ≥ 85)
  - Score ≥ 95 → genera PDF y presenta propuesta
  - Score 85–94 → advertencia visible, puede generar con marca
  - Score < 85 → bloqueado, escala
- **Nivel 3 — Avanzada** (≥ 100 simulaciones y score histórico ≥ 95)
  - Genera y presenta libre, salvo UVR complejo / inconsistencias críticas / alto riesgo → escala

### Registro de respuesta del banco
- **Director Financiero**: cuota, plazo, cuotas eliminadas aprobadas; recalcula honorarios; aprueba resultado financiero.
- **Apoderado**: adjunta oficio, correo, soporte bancario; aprueba resultado jurídico.
- **Analista Comercial**: solo lectura + notificaciones (banco respondió, diferencias detectadas, otrosí generado, contactar cliente).

## Etapa C — Integración en simuladores

- `src/lib/autonomia.ts` (nuevo): `calcularNivelAutonomia(metricas)`, `puedeGenerarPdf(nivel, resultado)` con reglas anteriores. Devuelve `{ nivel, accion: "permitir" | "permitir_con_marca" | "bloquear", motivo }`.
- `src/hooks/useNivelAutonomia.ts` (nuevo): lee `analista_metricas` del usuario actual, fallback Nivel 1.
- `src/components/nuvex/AuditBadge.tsx` (nuevo): semáforo compacto (verde ≥95, ámbar 85–94, rojo <85) + tooltip con desglose 40/30/20/10.
- `src/components/nuvex/AuditPanel.tsx` (nuevo): tabla extracto vs analista, lista de inconsistencias con severidad, score detallado, badge "REQUIERE REVISIÓN DIRECCIÓN FINANCIERA" cuando aplica.
- `PesosSimulator.tsx` y `UVRSimulator.tsx`: tras lectura OCR llaman `auditarSimulacion`, persisten en `audit_simulaciones` (debounced) y muestran `AuditPanel`. Botón "Exportar propuesta comercial" se deshabilita según `puedeGenerarPdf`. Para Nivel 1 con score ≥95, el PDF sale con marca "Pendiente Auditoría" (texto adicional en `nuvexPdfKit`).
- `PropuestasComerciales.tsx`: muestra `AuditBadge` por escenario y bloquea exportar cuando la auditoría lo indica.

## Etapa D — Clasificación de alto riesgo

Ya cubierto en motor (`clasificarRiesgo`). En UI:
- Banner rojo en simulador + escenario cuando `clasificacion.requiereRevision = true`.
- Alerta automática en `audit_alertas` (severidad `alta`) al guardar simulación con motivo.

## Etapa E — Respuesta del banco (solo Director / Apoderado)

- `src/components/expediente/RespuestaBancoBlock.tsx` (nuevo): formulario con dos pestañas:
  - **Financiero** (solo `director_financiero_qa` / `super_admin`): cuota aprobada, plazo aprobado, cuotas eliminadas aprobadas, observaciones; al guardar dispara recálculo de honorarios existente (`aplicar_recalculo_honorarios`).
  - **Jurídico** (solo `apoderado` / `director_juridico` / `super_admin`): tipo de soporte, número de oficio, fecha, archivo (Supabase Storage), aprobación jurídica.
- Visible para Analista Comercial en modo lectura.
- Inserta en `audit_respuestas_banco`, marca `aprobado_financiero` / `aprobado_juridico`.
- Notificaciones automáticas vía `notify_user` al Analista Comercial cuando:
  - el banco responde,
  - condiciones difieren de las presentadas,
  - se generó otrosí (placeholder gancho — sin generación automática aún),
  - debe contactar al cliente.

## Etapa F — Cálculo y recálculo de nivel de autonomía

- `public.recalcular_nivel_autonomia(_user_id uuid)` (RPC SECURITY DEFINER):
  - Cuenta simulaciones aprobadas (`audit_simulaciones.score_total >= 85`).
  - Calcula `score_promedio_90d`.
  - Calcula precisión (`audit_respuestas_banco` aprobadas vs simuladas, |Δcuota|<3% y |Δplazo|≤1).
  - Aplica reglas Nivel 1/2/3 y actualiza `analista_metricas`.
- Trigger `AFTER INSERT` en `audit_simulaciones` y `audit_respuestas_banco` que llama la RPC del usuario afectado.
- Alerta en `audit_alertas` al cambiar de nivel.

## Etapa G — Dashboard Dirección Financiera

- Nueva ruta `src/routes/_authenticated/auditoria-financiera.tsx` (acceso `director_financiero_qa`, `super_admin`, `gerencia`).
- Tabs:
  - **Pendientes**: simulaciones con `revisado_director = false` y `requiere_revision = true`.
  - **Ranking**: tabla con nombre, nivel, score promedio, simulaciones, precisión, %devoluciones, %aprobación.
  - **Alertas**: feed de `audit_alertas`.
- Acciones: marcar revisado, ajustar nivel manual (`super_admin`), añadir nota.
- Link desde el menú lateral del Director Financiero.

## Detalles técnicos

- Hook `useUserRole` se amplía con `isDirectorFinanciero` (ya existe `isDirectorQA`, lo reutilizamos) y se añade `nivelAutonomia` al `useNivelAutonomia` separado para no recargar.
- Cero cambios en `finance.ts`, `cuotaBase`, `proyeccionExport`, `nuvexPdfKit` (salvo añadir marca "Pendiente Auditoría" condicional, parámetro opcional).
- Validaciones siguen siendo cliente; el motor `auditEngine.ts` se mantiene puro y testeable.
- Snapshots se guardan al exportar PDF; durante edición solo se evalúa en memoria para evitar ruido en la BD.

## Validación antes de cerrar

- Caso Nivel 1 con score 92 → PDF bloqueado, escala a Director.
- Caso Nivel 2 con score 96 → PDF habilitado sin marca.
- Caso Nivel 3 con UVR → PDF bloqueado, banner alto riesgo.
- Director registra respuesta del banco con cuota distinta → recálculo de honorarios se dispara, Analista recibe notificación.
- Analista intenta abrir formulario de respuesta → solo ve lectura.
