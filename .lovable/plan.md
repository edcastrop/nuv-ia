
# NUVIA FINANCIAL QA AI
**Auditor Matemático Financiero Autónomo de NUVEX**

Motor que reconstruye matemáticamente cada simulación, la contrasta contra el extracto bancario y emite un dictamen automático con QA Score. Se construye como **capa aditiva** sobre el módulo QA existente (`/qa`), reutilizando `audit_simulaciones`, `analisis_capacidad_pago`, `extractos_lecturas` y `motorExtractos/*`. **Cero impacto** sobre Pipeline, Expedientes, Treasury, Contratación ni Honorarios.

---

## 1. Arquitectura funcional

```text
┌──────────────────────────────────────────────────────────────┐
│              /qa  (Validación Financiera QA — actual)        │
│              + nueva pestaña "NUVIA QA AI"                   │
└────────────────────────────┬─────────────────────────────────┘
                             │
   ┌────────────┬────────────┼────────────┬────────────────┐
   ▼            ▼            ▼            ▼                ▼
Dashboard   Auditor       Casos       Alertas         Copiloto
QA AI       Matemático    auditados   críticas        QA (drawer)
   │            │            │            │                │
   ▼            ▼            ▼            ▼                ▼
serverFn:  serverFn:    serverFn:    serverFn:        serverFn:
qaKpis     auditarCaso  listCasosQA  alertasQA        qaCopiloto
           recalcular   dictamen
           compararExt
                             │
                             ▼
                   ┌──────────────────────┐
                   │  Motor matemático    │
                   │  qaMath.ts (puro TS) │
                   │  - VP / VF / TIR     │
                   │  - amortización      │
                   │  - UVR / FRECH       │
                   │  - tolerancias       │
                   └──────────────────────┘
                             │
                             ▼
                   ┌──────────────────────┐
                   │  Lovable AI Gateway  │
                   │  gemini-3-flash      │
                   │  - copiloto QA       │
                   │  - explicar diff     │
                   └──────────────────────┘
```

**Principios**
- Sólo lectura sobre `extractos_lecturas`, `audit_simulaciones`, `analisis_capacidad_pago`, `expedientes`, `clientes`.
- Escritura exclusiva sobre tablas nuevas `qa_*`.
- El motor matemático es **determinístico y puro** (`src/lib/qaMath.ts`), 100% testeable; la IA sólo se usa para el copiloto y para explicar diferencias en lenguaje natural.
- Todo dictamen queda en `qa_auditorias` con trazabilidad completa (inputs, outputs, fórmulas aplicadas, versión del motor).

---

## 2. Modelo matemático

### 2.1 Tasas
- EA ↔ MV: `MV = (1+EA)^(1/12) − 1`; `EA = (1+MV)^12 − 1`.
- Nominal anual MV: `NA = MV × 12`.
- Tasa real UVR: ya viene pactada; cuota se calcula en UVR y se convierte a COP con UVR del día.

### 2.2 Cuota teórica (sistema francés, cuota fija)
```
C = SC · i / (1 − (1+i)^(−n))
```
donde `SC` = saldo capital, `i` = tasa periódica (MV o MV real UVR), `n` = cuotas pendientes.

### 2.3 Cuota con seguros
```
C_total = C + seguro_vida + seguro_incendio + seguro_terremoto
```

### 2.4 Cobertura FRECH (subsidio tasa)
- Tasa subsidiada: `i_sub = i − cobertura_pp/12` (cobertura en puntos EA convertidos a MV).
- Cuota con subsidio: misma fórmula con `i_sub`.
- Beneficio mensual: `C(i) − C(i_sub)`.

### 2.5 Amortización (tabla mes a mes)
Para cada cuota `k = 1..n`:
- `interes_k = saldo_{k-1} · i`
- `capital_k = C − interes_k`
- `saldo_k = saldo_{k-1} − capital_k`

### 2.6 Costo total y número de veces pagado
- `costo_total = C · n + Σ seguros`
- `veces_pagado = costo_total / valor_desembolsado`

### 2.7 Validación contra extracto (tolerancias)
| Métrica | Tolerancia |
|---|---|
| Cuota | ±0.5% o ±$5.000 |
| Saldo capital | ±$10.000 |
| Tasa EA | ±0.05 pp |
| Total seguros | ±$2.000 |
| Cobertura FRECH | ±0.10 pp |

Cualquier diferencia > tolerancia → inconsistencia con severidad (`info` / `warning` / `critica`).

### 2.8 Auditoría de simulación NUVEX
Recalcula con el motor las métricas que el analista capturó (cuotas eliminadas, ahorro proyectado, nuevo plazo, honorarios). Diferencia > 2 cuotas o > $500.000 ahorro → `ALERTA CRÍTICA`.

### 2.9 QA Score (0–100)
```
score = 100
  − Σ penalización_inconsistencias        (info -1, warning -5, critica -15)
  − penalización_diff_cuota               (max 10)
  − penalización_diff_simulacion          (max 25)
  − penalización_campos_faltantes         (max 10)
  + bonus_completitud                     (max 5)
```
Categorías: 95-100 EXCELENTE · 85-94 APROBADO · 70-84 REVISAR · 0-69 RECHAZADO.

### 2.10 Dictamen
| Score | Inconsistencias críticas | Dictamen |
|---|---|---|
| ≥95 | 0 | APROBADO |
| 85-94 | 0 | APROBADO CON OBSERVACIONES |
| 70-84 | cualquiera | REQUIERE REVISIÓN |
| <70 ó ≥1 crítica | — | RECHAZADO |

---

## 3. Modelo de datos (5 tablas nuevas, prefijo `qa_`)

```text
qa_auditorias                          (una fila por ejecución del motor)
  id, expediente_id → expedientes, analista_id → profiles,
  simulacion_id → audit_simulaciones (null si auditoría libre),
  extracto_id → extractos_lecturas,
  modalidad (hipotecario|leasing|uvr),
  motor_version text,                          -- ej "1.0.0"
  qa_score numeric(5,2),
  categoria (excelente|aprobado|revisar|rechazado),
  dictamen  (aprobado|aprobado_obs|requiere_revision|rechazado),
  inputs jsonb,                                -- snapshot de lo auditado
  outputs jsonb,                               -- métricas recalculadas
  diferencias jsonb,                           -- {cuota, saldo, tasa, ...}
  alertas jsonb,                               -- [{tipo,severidad,mensaje}]
  ejecutado_at, ejecutado_by, created_at

qa_inconsistencias                     (detalle normalizado para reporting)
  id, auditoria_id → qa_auditorias,
  tipo (tasa|seguros|cuota|frech|uvr|flujo|simulacion|extracto|honorario|plazo),
  severidad (info|warning|critica),
  campo text, valor_extracto numeric, valor_calculado numeric,
  diferencia numeric, mensaje text, sugerencia text, created_at

qa_alertas                             (alertas accionables visibles en dashboard)
  id, auditoria_id, expediente_id, tipo, severidad, mensaje,
  estado (abierta|reconocida|resuelta), reconocida_by, reconocida_at, created_at

qa_reglas                              (reglas y tolerancias configurables)
  id, codigo text unique, descripcion text,
  tipo (tolerancia|umbral|penalizacion),
  payload jsonb,                              -- ej {campo:'cuota', pct:0.5, abs:5000}
  activa bool, version int, updated_by, updated_at

qa_auditoria_log                       (append-only — trazabilidad)
  id, auditoria_id, accion (crear|recalcular|reconocer_alerta|cerrar),
  payload jsonb, user_id, created_at
```

**RLS / grants** (todas):
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated; GRANT ALL … TO service_role`.
- Policies con `has_role(auth.uid(),'qa_financiero')` o `has_role(...,'super_admin')` para lectura/escritura; el resto de roles sólo lee auditorías de sus propios expedientes vía `expediente.asesor_id = auth.uid()`.
- `qa_auditoria_log` append-only para `authenticated`.

**Reutilización (sin modificar)**
- `extractos_lecturas` → fuente de `Saldo capital, Tasa EA/MV, Cuota, Seguros, Cuotas pagadas/pendientes, Desembolso, FRECH, UVR, Modalidad`.
- `audit_simulaciones` → métricas declaradas por el analista (cuotas eliminadas, ahorro, nuevo plazo).
- `analisis_capacidad_pago` → contexto cliente.
- `motorExtractos/*` → parsers ya existentes (Bancolombia, Davivienda hipotecario, Davivienda leasing) — el motor QA los consume directamente.

---

## 4. Pantallas (NUVIA Design System)

Todas dentro del módulo QA actual. Sidebar QA sub-tabs:
`Validación Financiera` (actual) · **NUVIA QA AI** (nuevo) · `Auditorías` · `Alertas` · `Config`.

### 4.1 `/qa/qa-ai` — Dashboard QA AI
- `ExecutiveHero` "NUVIA Financial QA AI · Auditor matemático autónomo".
- `KpiGrid` (6): Casos auditados · Aprobados · Con observaciones · Rechazados · QA promedio · Alertas críticas abiertas.
- 2 columnas: top analistas con más errores · top bancos con más inconsistencias.
- Acción: "Auditar nuevo caso" → wizard.

### 4.2 `/qa/qa-ai/nuevo` — Wizard de auditoría (3 pasos)
1. **Seleccionar caso**: expediente + simulación + extracto (autocompleta si ya están vinculados).
2. **Revisar lectura**: muestra los 11 campos extraídos del extracto, editables (con flag `corregido_manual`).
3. **Ejecutar auditoría**: corre `auditarCaso()` → render del dictamen.

### 4.3 `/qa/qa-ai/$id` — Resultado de auditoría
- Hero con QA Score grande + categoría + dictamen.
- Tabs:
  - **Resumen**: 6 KPIs (cuota teórica, costo total, veces pagado, ahorro real, diferencia cuota, diferencia simulación).
  - **Reconstrucción matemática**: tabla amortización (primeras 12 + últimas 12 cuotas) con `tabular-nums`.
  - **Comparación vs extracto**: lado a lado (extracto / calculado / Δ / estado).
  - **Comparación vs simulación analista**: cuotas eliminadas, ahorro, plazo.
  - **Inconsistencias**: lista con severidad, fórmula aplicada y sugerencia.
  - **Trazabilidad**: log + versión del motor + JSON snapshot descargable.
- Acciones: "Reconocer alertas" · "Recalcular" · "Exportar PDF" (reusa `nuvexPdfKit`).

### 4.4 `/qa/qa-ai/alertas`
- Tabla `qa_alertas` filtrable por severidad / estado / analista / banco.
- Acciones bulk: reconocer / cerrar.

### 4.5 `/qa/qa-ai/config`
- Editor de `qa_reglas`: tolerancias, umbrales y penalizaciones.
- Versionado: cada cambio crea nueva versión; el motor referencia la versión activa en el momento de auditar.

### 4.6 Copiloto QA (drawer global del módulo)
- Botón flotante en todas las pantallas QA AI.
- Preguntas predefinidas:
  - ¿Qué casos tienen inconsistencias críticas esta semana?
  - ¿Qué simulaciones presentan mayor riesgo?
  - ¿Qué analista requiere revisión?
  - ¿Qué banco presenta más diferencias?
- serverFn `qaCopiloto({pregunta})` → AI Gateway con contexto agregado (últimas 200 auditorías, KPIs, alertas abiertas). **La IA nunca recalcula matemática**, sólo interpreta resultados.

---

## 5. Flujo de auditoría (extremo a extremo)

```text
[Analista] termina simulación NUVEX
     │
     ▼
[QA Financiero] abre /qa/qa-ai/nuevo, selecciona expediente+simulacion+extracto
     │
     ▼
serverFn auditarCaso(payload):
  1. Carga extracto (extractos_lecturas) + simulacion (audit_simulaciones)
  2. Normaliza con normalizeCreditMoneyInput (reusa src/lib/creditoSanity)
  3. qaMath.reconstruir({modalidad, saldo, i, n, seguros, frech, uvr}):
       - tasas (EA↔MV, real UVR)
       - cuota teórica, cuota con/sin subsidio
       - tabla amortización completa
       - costo total, veces pagado
  4. qaMath.compararExtracto(calculado, extracto, reglas) → diferencias
  5. qaMath.compararSimulacion(calculado, simulacion) → diff cuotas/ahorro
  6. qaMath.detectarInconsistencias(...) → array tipado
  7. qaMath.calcularScore(...) → {score, categoria, dictamen}
  8. INSERT qa_auditorias + qa_inconsistencias + qa_alertas (críticas)
  9. INSERT qa_auditoria_log (accion=crear)
 10. Return {auditoriaId, score, dictamen, ...}
     │
     ▼
[QA Financiero] revisa /qa/qa-ai/$id:
  - Acepta dictamen      → cierra alertas
  - Recalcula con ajuste → serverFn recalcular() (nueva versión)
  - Escala a Dirección   → notif a super_admin
     │
     ▼
Si dictamen ≠ APROBADO → bloquea avance del expediente al siguiente estado
(integración con casoEstados / pipelineTransiciones — sólo lectura del flag).
```

---

## 6. KPIs y reportes

**Dashboard**
- Casos auditados (día/semana/mes)
- % aprobados, % con observaciones, % rechazados
- QA Score promedio (tendencia 30d)
- Tiempo promedio auditoría (segundos — debe ser <2s, todo es determinístico)
- Alertas críticas abiertas

**Analistas**
- Ranking por QA promedio
- % de simulaciones con diff > tolerancia
- Tipo de error más frecuente

**Bancos**
- Inconsistencias por banco / producto
- Diferencia promedio de cuota
- Tasa de errores en seguros / FRECH / UVR

**Modalidades**
- Comparativo hipotecario vs leasing vs UVR
- Errores específicos UVR (conversión, fecha)

---

## 7. Plan de implementación por fases

### Fase 1 — Motor matemático + auditoría básica (sprint actual)
- Migración SQL: 5 tablas `qa_*` + RLS + grants + seed de `qa_reglas` con tolerancias por defecto.
- `src/lib/qaMath.ts` (puro TS, 100% testeable): tasas, cuota, amortización, FRECH, UVR, comparaciones, score, dictamen.
- Suite de tests Vitest en `src/lib/__tests__/qaMath.test.ts` (≥30 casos: hipotecario fijo, hipotecario UVR, leasing, con/sin FRECH, edge cases tasas extremas).
- serverFns: `auditarCaso`, `recalcular`, `listAuditorias`, `obtenerAuditoria`.
- Rutas: `/qa/qa-ai` (dashboard) + `/qa/qa-ai/nuevo` (wizard) + `/qa/qa-ai/$id` (resultado).
- Entrada en tabs QA con badge "Beta".

### Fase 2 — Alertas y configuración
- Ruta `/qa/qa-ai/alertas` + workflow reconocer/resolver.
- Ruta `/qa/qa-ai/config` con editor de `qa_reglas` versionadas.
- Notificaciones (reusa `notificaciones_usuario`) cuando se crea alerta crítica.

### Fase 3 — Copiloto QA + Export PDF
- Drawer copiloto con AI Gateway (`google/gemini-3-flash-preview`).
- Export PDF del dictamen vía `nuvexPdfKit`.
- Integración con `pipelineTransiciones`: bloquea avance si último dictamen ≠ APROBADO/APROBADO_OBS.

### Fase 4 — Inteligencia avanzada (fuera de alcance ahora)
- Detección de patrones de error por analista/banco con ML ligero.
- Auto-corrección sugerida (recomienda valor correcto, no aplica).
- Comparativos históricos entre versiones del motor.

---

## 8. Garantías de no-impacto

| Módulo | Acción |
|---|---|
| Pipeline, Expedientes, Simuladores NUVEX, Treasury, Contratación, Honorarios, Comisiones | Sólo lectura. Cero ALTER. Cero triggers. |
| `audit_simulaciones`, `extractos_lecturas`, `analisis_capacidad_pago` | Sólo SELECT desde el motor QA. |
| Módulo QA actual (`/qa`, `validaciones_qa`, `ValidacionQABlock`) | Sin cambios. Convive como pestaña hermana. |
| Diseño | NUVIA Design System (ExecutiveHero, KpiGrid, NCard, NSelect, `.nuvia-input`, tokens dark). |

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Diferencias por redondeo banco vs motor | Tolerancias configurables en `qa_reglas`; motor versionado. |
| Extracto mal parseado → falso negativo | Wizard permite corregir lectura antes de auditar; flag `corregido_manual`. |
| UVR / FRECH con reglas regulatorias cambiantes | Parámetros en `qa_reglas` (no hardcode); historial versionado. |
| Confusión con QA actual | Tab separada "NUVIA QA AI" con badge Beta; ambas conviven. |
| Costo IA en copiloto | Sólo en drawer y bajo demanda; el motor matemático no consume IA. |

---

## 10. Equipo virtual aplicado

| Rol | Aporte concreto en la arquitectura |
|---|---|
| Matemáticos Financieros | Fórmulas §2.1–2.6, sistema francés, UVR. |
| Auditores Bancarios | Tolerancias §2.7, severidades, dictámenes §2.10. |
| Actuarios | Tratamiento de seguros (vida/incendio/terremoto) y costo total esperado. |
| Expertos Hipotecario | FRECH (cobertura tasa), conversión EA↔MV, validación cuota constante. |
| Expertos Leasing Habitacional | Tratamiento de canon, opción de compra al final, diferencias contables. |
| Arquitectos IA | Separación motor determinístico (qaMath.ts) vs copiloto IA; trazabilidad jsonb; versionado de reglas y motor. |

---

**Esperando aprobación para ejecutar Fase 1.**
Si quieres ajustes (otro orden de pantallas, mover el copiloto a Fase 1, distintas tolerancias por defecto, o limitar el MVP a sólo hipotecario sin leasing/UVR) lo replanteo antes de tocar la base.
