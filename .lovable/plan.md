# NUVIA TREASURY AI 1.0 — Arquitectura propuesta

Motor inteligente de tesorería y conciliación bancaria. Se construye como **nueva capacidad aditiva** dentro de Finanzas. **Cero impacto** sobre Pipeline, Expedientes, Simuladores, Contratación, QA, Motor Honorarios, Comisiones ni módulos existentes.

---

## 1. Arquitectura funcional

```text
                  ┌─────────────────────────────────────┐
                  │     /finanzas/treasury (nuevo)      │
                  │   NUVIA TREASURY AI — Shell         │
                  └────────────────┬────────────────────┘
                                   │
   ┌──────────┬────────────┬───────┴───────┬───────────┬────────────┐
   ▼          ▼            ▼               ▼           ▼            ▼
Dashboard  Concilia-     Cartera        Flujo de   Auditoría   Config
Tesorería  ción IA        IA             Caja IA   Financiera  Bancos/Reglas
   │          │            │               │           │            │
   └────┬─────┴─────┬──────┴───────┬───────┴─────┬─────┴────────┬───┘
        ▼           ▼              ▼             ▼              ▼
   serverFn:    serverFn:      serverFn:     serverFn:     serverFn:
   treasuryKpis ingestExtracto carteraAging  forecastCaja  auditTreasury
                matchEngine                                 configReglas
                aprenderRegla
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  Lovable AI Gateway   │
                       │  (gemini-3-flash)     │
                       │  - parse PDF/Excel    │
                       │  - clasificar movs    │
                       │  - copiloto preguntas │
                       └───────────────────────┘
```

**Principios:**
- Sólo **lectura** sobre tablas existentes (`cartera`, `cuentas_cobro`, `honorarios_calculos`, `comisiones`, `expedientes`, `clientes`, `pago_conciliacion`).
- **Escritura exclusiva** sobre tablas nuevas (`treasury_*`).
- Toda conciliación confirmada se **propaga** a `pago_conciliacion` y `cartera_pagos` vía serverFn explícita (no mutamos esas tablas en frecuencia automática sin aprobación humana).
- Aprendizaje supervisado: cada corrección del usuario → fila en `treasury_match_rules`.

---

## 2. Modelo de datos propuesto (8 tablas nuevas, todas prefijo `treasury_`)

```text
treasury_bancos
  id, nombre, alias, tipo_cuenta, numero_cuenta, moneda, saldo_actual,
  activo, parser_profile (text), created_at, updated_at

treasury_extractos                     (cada archivo cargado)
  id, banco_id → treasury_bancos, archivo_url, formato (pdf|xlsx|csv|txt),
  periodo_inicio, periodo_fin, total_movs, total_ingresos, total_egresos,
  estado (procesando|listo|error), parse_log jsonb,
  uploaded_by, created_at

treasury_movimientos                   (cada línea del extracto)
  id, extracto_id → treasury_extractos, fecha, valor, tipo (credito|debito),
  descripcion_raw, referencia, contraparte, canal (nequi|pse|trans|...),
  estado_match (no_identificado|sugerido|conciliado|descartado),
  confianza numeric(5,2),               -- 0..100
  match_tipo (cartera|cuenta_cobro|honorario|comision|otro|null),
  match_id uuid,                        -- polimórfico
  conciliado_by, conciliado_at, notas, created_at, updated_at

treasury_match_candidatos              (top-N candidatos por movimiento)
  id, movimiento_id → treasury_movimientos, score numeric(5,2),
  match_tipo, match_id, motivo jsonb,   -- razones del score
  posicion smallint, created_at

treasury_match_rules                   (aprendizaje supervisado)
  id, patron text,                      -- regex sobre descripcion_raw / referencia
  canal text, contraparte_hint text,
  match_tipo, match_id_default uuid null,
  cliente_id_default uuid null,
  veces_aplicada int, ultimo_uso, created_by, created_at

treasury_ajustes                       (correcciones manuales)
  id, movimiento_id, accion (asignar|descartar|dividir|fusionar),
  payload jsonb, user_id, created_at

treasury_auditoria                     (trazabilidad completa)
  id, entidad (extracto|movimiento|regla|ajuste|config),
  entidad_id, accion, valor_anterior jsonb, valor_nuevo jsonb,
  user_id, created_at

treasury_config                        (kv para reglas globales)
  key text PK, value jsonb, updated_by, updated_at
  -- ej: { tolerancia_pct: 1.5, umbral_auto_conciliar: 92, umbral_sugerir: 70 }
```

**RLS y grants** (todas las tablas):
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated; GRANT ALL … TO service_role`.
- Política: `can_manage_finanzas(auth.uid())` para lectura/escritura (mismo helper que ya usa `tesoreria_movimientos`). Bitácora `treasury_auditoria`: append-only para `authenticated`.

**Reutilización (sin modificar):**
- `cartera`, `cartera_pagos`, `cartera_cuotas` → lectura para matching + insert de pagos cuando el usuario confirma.
- `cuentas_cobro` → lectura para matching.
- `honorarios_calculos`, `comisiones` → lectura para matching.
- `clientes`, `expedientes` → lectura para enriquecer contraparte.
- `pago_conciliacion` → insert/update sólo cuando el usuario confirma conciliación.

---

## 3. Pantallas propuestas (NUVIA Design System)

Todas montadas en rutas nuevas bajo `/finanzas/treasury/*`. Ninguna ruta existente se renombra ni elimina.

### 3.1 `/finanzas/treasury` — Dashboard Tesorería
- `ExecutiveHero` "NUVIA Treasury AI · Motor de tesorería".
- `KpiGrid` (8 KPIs):
  Saldo bancario · Ingresos mes · Conciliados · Pendientes · Cartera por cobrar · Honorarios pendientes · Flujo 30 días · Alertas activas.
- 2 columnas: timeline últimos extractos · panel `InsightCard` con resumen IA.

### 3.2 `/finanzas/treasury/conciliacion`
- Dropzone para PDF/XLSX/CSV/TXT (drag-and-drop nuvia).
- Lista de extractos cargados (estado, totales, % conciliado).
- Al abrir un extracto → 3 paneles tipo Kanban:
  - **Conciliados** (verde) — N movs, $X, confianza promedio.
  - **Sugeridos** (amber) — N movs, lista con top-3 candidatos + botón "Aceptar"/"Cambiar".
  - **No identificados** (rojo) — N movs, asignación manual (buscador de expediente/cuenta de cobro/cliente).
- Cada acción manual dispara `aprenderRegla()`.

### 3.3 `/finanzas/treasury/cartera`
- Aging buckets: al día / 30 / 60 / 90+.
- Alertas: aprobado sin pago · pago parcial · promesa vencida · cuenta de cobro emitida sin recaudo.
- Tabla con `tabular-nums`, NSelect filtros, export.

### 3.4 `/finanzas/treasury/flujo-caja`
- KPI: ingresos esperados 30d.
- 3 columnas (Alta / Media / Baja probabilidad) alimentadas desde pipeline + cartera + cuentas de cobro.
- Gráfico de barras semanal (sin libs nuevas, SVG inline al estilo NUVIA).

### 3.5 `/finanzas/treasury/auditoria`
- Tabla de `treasury_auditoria` con filtros entidad/usuario/acción y diff JSON (mismo patrón que `finanzas.auditoria`).

### 3.6 `/finanzas/treasury/config`
- Bancos activos (CRUD `treasury_bancos`).
- Reglas globales (`treasury_config`): tolerancia %, umbrales de auto-conciliar / sugerir.
- Lista de reglas aprendidas (`treasury_match_rules`) con activar/desactivar.

### 3.7 Copiloto IA (drawer global del módulo)
- Panel lateral con preguntas predefinidas + input libre.
- Llama serverFn `treasuryCopiloto({pregunta})` → AI Gateway `google/gemini-3-flash-preview` con contexto agregado (KPIs + aging + flujo).

---

## 4. Flujo completo de conciliación

```text
[Usuario] sube extracto (PDF/XLSX/CSV/TXT)
    │
    ▼
serverFn ingestExtracto:
  1. Sube archivo a Storage (bucket treasury-extractos, privado)
  2. INSERT treasury_extractos (estado=procesando)
  3. Parseo:
       - CSV/XLSX → parser nativo (papaparse/xlsx ya disponibles)
       - PDF/TXT → AI Gateway (gemini-3-flash) con prompt estructurado
                    → output JSON {movimientos: [...]}
  4. INSERT bulk treasury_movimientos
  5. estado=listo
    │
    ▼
serverFn matchEngine(extracto_id):
  Para cada movimiento:
    Genera candidatos cruzando:
      - cartera (saldo pendiente, cliente, expediente)
      - cuentas_cobro (monto, cliente, número)
      - honorarios_calculos (monto neto, expediente)
      - treasury_match_rules (patrón sobre descripcion_raw)
    Score (0..100) ponderando:
      valor exacto (35) · cliente/cedula match (25) · referencia (15) ·
      fecha cercana ±5d (10) · regla aprendida previa (15)
    INSERT top-3 en treasury_match_candidatos
    Si score >= umbral_auto_conciliar (def 92): estado=conciliado
    Si score >= umbral_sugerir       (def 70): estado=sugerido
    Else: estado=no_identificado
    │
    ▼
[Usuario] revisa en /conciliacion:
    - Acepta sugerencia  → confirmarMatch()
    - Cambia a otro      → asignarManual() + aprenderRegla()
    - Descarta           → descartarMovimiento()
    │
    ▼
serverFn confirmarMatch:
  - UPDATE treasury_movimientos (estado=conciliado, conciliado_by/at)
  - Según match_tipo:
      cartera        → INSERT cartera_pagos
      cuenta_cobro   → UPDATE cuentas_cobro (estado, pagado_at)
      honorario      → marcar honorario pagado
  - INSERT pago_conciliacion (estado=pagado) si aplica
  - INSERT treasury_auditoria
  - Si vino de corrección manual → INSERT/UPDATE treasury_match_rules
```

**Aprendizaje:** la regla guardada usa `patron` (regex sobre `descripcion_raw`) + `contraparte_hint`. En la próxima ingesta, `matchEngine` consulta `treasury_match_rules` ANTES del cruce general; si hay hit ⇒ score +15 y `match_id_default` precargado.

---

## 5. Plan de implementación por fases

### Fase 1 — MVP (este sprint, **lo único a construir ahora**)
- Migración SQL con 8 tablas + RLS + grants + bucket storage `treasury-extractos`.
- serverFns: `treasuryKpis`, `listExtractos`, `ingestExtracto` (CSV/XLSX nativo + PDF vía IA), `matchEngine`, `confirmarMatch`, `asignarManual`, `descartarMovimiento`, `aprenderRegla`, `listMovimientos`.
- Rutas:
  - `/finanzas/treasury` (dashboard)
  - `/finanzas/treasury/conciliacion` (carga + 3 paneles)
  - `/finanzas/treasury/auditoria`
- Entry en sidebar Finanzas: **"Treasury AI"** (badge "Beta").
- Alertas básicas en dashboard.

### Fase 2 — Cartera IA + Flujo de Caja
- Rutas `/cartera` y `/flujo-caja` con aging real y forecast determinístico (no ML).
- Alertas avanzadas (promesa vencida, pago parcial).

### Fase 3 — Copiloto IA + Configuración avanzada
- Drawer copiloto con AI Gateway + contexto agregado.
- CRUD bancos, reglas globales, gestión de reglas aprendidas.

### Fase 4 — Inteligencia avanzada (no en alcance ahora)
- Forecast ML, detección de anomalías, modelos externos.

---

## 6. Garantías de no-impacto

| Módulo | Acción |
|---|---|
| Pipeline, Expedientes, Simuladores, Contratación, QA, Honorarios, Comisiones | Sólo lectura (SELECT). Cero ALTER, cero nuevos triggers. |
| `cartera_pagos`, `pago_conciliacion`, `cuentas_cobro` | Sólo INSERT/UPDATE explícito en `confirmarMatch`, con auditoría. |
| `tesoreria_movimientos`, `finanzas.*` actuales | Sin cambios. Treasury vive en rutas y tablas nuevas. |
| Diseño | NUVIA Design System 1.0 (ExecutiveHero, KpiGrid, NCard, NSelect, .nuvia-input). |

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Parseo PDF poco confiable | Fallback manual; mostrar `parse_log`; permitir re-subir como XLSX. |
| Falsos positivos en auto-conciliación | Umbral conservador 92; toda auto-conciliación queda en auditoría y es reversible. |
| Reglas aprendidas mal entrenadas | Pantalla en `/config` para revisar, desactivar o borrar reglas. |
| Costo AI Gateway por extractos grandes | Parser nativo para CSV/XLSX (mayoría); IA sólo PDF/TXT. |
| RLS demasiado abierta | Helper `can_manage_finanzas` ya restringe a roles financieros existentes. |

---

**Esperando aprobación para ejecutar Fase 1.**
Si quieres ajustes (más/menos tablas, otro alcance de MVP, otro orden de pantallas, mover el copiloto a Fase 1, etc.) lo replanteo antes de tocar la base.
