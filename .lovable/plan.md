# FASE 7.6 — NUVIA Operating Model

Propuesta de arquitectura. **No se implementa hasta aprobación.**

---

## 1. Principios del modelo

1. Un caso tiene **un único estado oficial** en `expedientes.estado_caso` y un **subestado operativo** en `expedientes.subestado` (nuevo). Todo lo demás es derivado.
2. Cada transición de estado se registra en `expediente_historial` y dispara eventos (notificación, SLA, métrica).
3. Cada etapa tiene **responsable primario** (single accountable owner) y responsables consultados.
4. SLA por etapa se mide en **días hábiles Colombia** (`diasHabiles.ts`).
5. Etapas 14 (Pipeline Maestro actual) se mantienen — esta fase **agrega 15 Referido y 16 Promotor** como ciclo de relación post-cierre.
6. Command Center mide cada etapa con 3 dimensiones: **volumen, velocidad, conversión**.

---

## 2. Mapa maestro del ciclo de vida

```text
                           CICLO COMERCIAL
                          ┌────────────────────────────────┐
   E1 Lead ──► E2 Diagnóstico ──► E3 Análisis Financiero ──► E4 Auditoría Financiera
                                                                       │
                            CICLO DE CIERRE COMERCIAL                  ▼
                          ┌──────────────────────── E5 Presentación Cliente
                          ▼
                   E6 Firma / Contratación
                          │
                          ▼              CICLO OPERATIVO JURÍDICO
                   E7 Radicación ──► E8 Seguimiento ──► E9 Respuesta Banco
                                                              │
                                                              ▼
                                                    E10 Informe Final
                                                              │
                          CICLO FINANCIERO                    ▼
                          ┌────────────── E11 Cuenta de Cobro
                          ▼
                   E12 Pago Honorarios ──► E13 Paz y Salvo ──► E14 Finalizado
                                                                       │
                          CICLO DE RELACIÓN (NUEVO)                    ▼
                                            E15 Referido ──► E16 Promotor
```

---

## 3. Tabla operativa por etapa

| # | Etapa | Estado oficial | Subestados | Responsable primario | SLA (días háb.) | Evento que dispara salida | Riesgos clave | KPI etapa | Automatización | Command Center mide |
|---|-------|----------------|------------|----------------------|-----------------|---------------------------|---------------|-----------|----------------|---------------------|
| 1 | Lead | `lead` | nuevo, contactado, calificado, descartado | Asesor Comercial | 2 | Cliente acepta diagnóstico | Lead frío, sin respuesta | Tasa contacto 24h, % calificados | Auto-asignación, recordatorio 24/48h | Volumen entrada, % calificación |
| 2 | Diagnóstico | `diagnostico` | datos_básicos, datos_crédito, completo | Asesor Comercial | 3 | Expediente Maestro completo | Datos incompletos, banco no soportado | % completitud, tiempo medio | Validación cédula, autocompletar banco | Tiempo medio diagnóstico |
| 3 | Análisis Financiero | `analisis` | capacidad_pago, simulación, propuesta_borrador | Analista Financiero | 3 | Propuesta lista para auditoría | Capacidad insuficiente, error de simulación | % aprobación interna, error promedio | Motor capacidad pago, simulación automática | Throughput por analista |
| 4 | Auditoría Financiera | `auditoria` | en_revisión, observaciones, aprobada, rechazada | Auditor Financiero | 2 | Auditoría aprobada | Reproceso, demora QA | % aprobada 1ra vez, días en QA | Audit Engine, alertas estancamiento | % rechazo, tiempo en QA |
| 5 | Presentación Cliente | `presentacion` | agendada, presentada, en_decisión, aceptada, rechazada | Asesor Comercial | 5 | Cliente acepta propuesta | No-show, objeción precio | Tasa cierre, ciclo decisión | Recordatorio reunión, plantilla PDF | Conversión presentación→firma |
| 6 | Firma / Contratación | `contratacion` | enviado, firmado_cliente, firmado_apoderado, contratado | Apoderado / Jurídica | 3 | Contrato + poderes firmados | Cliente desiste, firma incompleta | % firma <72h, % desistimiento | Envío firma electrónica, checklist envíos | Funnel firma |
| 7 | Radicación | `radicacion` | preparado, radicado_banco, acuse_recibido | Apoderado | 2 | Acuse del banco | Banco rechaza radicación, documento faltante | % radicado <48h post-firma | Validación radicación, packaging PDF | Tiempo firma→radicación |
| 8 | Seguimiento | `seguimiento` | esperando_banco, gestión_activa, escalado | Apoderado | 30 | Banco responde | Silencio banco, pérdida trazabilidad | Días promedio, % escalados | Recordatorios, alertas estancamiento | Edad promedio, casos estancados |
| 9 | Respuesta Banco | `respuesta_banco` | recibida, favorable, parcial, desfavorable | Apoderado + Auditor | 2 | Respuesta cargada y validada | Lectura incorrecta, respuesta ambigua | % favorable, ahorro real vs proyectado | Motor extractos, comparación auto vs proyección | % favorable por banco/producto |
| 10 | Informe Final | `informe_final` | borrador, validado, enviado_cliente | Analista Financiero | 3 | Cliente recibe informe | Discrepancia ahorro, retraso entrega | Precisión histórica, días emisión | Generación PDF, comparativa auto | Precisión proyectado vs real |
| 11 | Cuenta de Cobro | `cuenta_cobro` | generada, enviada, aceptada_cliente | Cartera / Contabilidad | 2 | Cuenta aceptada | Cliente disputa monto, dato fiscal errado | Días informe→cuenta, % aceptadas 1ra | Generación automática desde honorarios calc | Tiempo emisión cuenta |
| 12 | Pago Honorarios | `pago_honorarios` | esperando, parcial, pagado | Cartera | 15 | Pago confirmado | Mora, pago parcial, disputa | DSO, % en mora, recaudo MTD | Recordatorios cartera, conciliación tesorería | DSO, cartera vencida |
| 13 | Paz y Salvo | `paz_salvo` | en_emisión, emitido, entregado | Jurídica | 3 | Cliente confirma recepción | Olvido emisión, dato erróneo | Días pago→paz y salvo | Plantilla automática, envío firmado | Tiempo cierre financiero→operativo |
| 14 | Finalizado | `finalizado` | archivado | Operaciones | 1 | Archivo + métricas consolidadas | Métricas no consolidadas | Casos cerrados/mes, ciclo total | Consolidación métricas, encuesta NPS auto | Lead→Finalizado, NPS |
| 15 | Referido | `referido` | encuesta_enviada, referidos_recibidos, contactados | Asesor Comercial | 30 | Referido convertido a Lead | Cliente no refiere, contacto frío | # referidos/cliente, tasa conversión | NPS auto + solicitud referidos, link único | Referral rate, LTV ampliado |
| 16 | Promotor | `promotor` | activo, embajador, inactivo | Gerencia Comercial | continuo | (sin salida — relación continua) | Promotor se enfría, churn de marca | # promotores activos, NPS sostenido, casos generados | Programa lealtad, contenido VIP, reactivación auto | Promotores activos, casos originados por promotor |

---

## 4. Modelo de datos (sin crear todavía)

Cambios mínimos al esquema actual — todo aditivo, no rompe lo existente:

1. `expedientes.subestado TEXT NULL` — subestado granular dentro del estado oficial.
2. `expedientes.responsable_primario_id UUID NULL` — owner único por etapa actual.
3. `expedientes.sla_vence_at TIMESTAMPTZ NULL` — calculado al entrar a la etapa.
4. Nueva tabla `etapa_sla_config` — SLA configurable por (estado, subestado).
5. Nueva tabla `casos_referidos` — `caso_origen_id`, `caso_referido_id`, `cliente_referente_id`, `fecha`, `convertido`.
6. Nueva tabla `clientes_promotores` — `cliente_id`, `nivel` (activo/embajador/inactivo), `nps_ultimo`, `casos_originados`, `fecha_alta`.
7. Nueva vista `v_caso_etapa_actual` — denormaliza estado + subestado + responsable + SLA + días en etapa.

---

## 5. Motor de transiciones (extender `pipelineTransiciones.ts`)

Cada transición declara:

```text
{
  from: { estado, subestado? },
  to:   { estado, subestado },
  requires: ["radicacion_validada", "auditoria_aprobada", ...],
  onEnter: ["set_sla", "asignar_responsable", "notificar"],
  onExit:  ["registrar_historial", "emitir_evento"],
  blockIf: ["cartera_vencida_critica", ...]
}
```

Beneficio: única fuente de verdad para flujos, validaciones, automatizaciones y auditoría.

---

## 6. Eventos del sistema (event bus interno)

Lista de eventos canónicos que el resto de NUVIA escucha:

- `caso.estado_cambiado`
- `caso.sla_vencido`
- `caso.estancado_7d` / `caso.estancado_15d` / `caso.estancado_30d`
- `caso.documento_faltante`
- `caso.respuesta_banco_recibida`
- `caso.cuenta_cobro_generada`
- `caso.pago_recibido`
- `caso.paz_salvo_emitido`
- `caso.finalizado`
- `cliente.nps_respondido`
- `cliente.referido_generado`
- `cliente.promotor_activado`

Cada evento alimenta: notificaciones, Command Center, IA Copilot, auditoría.

---

## 7. Integración con NUVIA IA

| Etapa | Uso de IA |
|-------|-----------|
| Lead | Scoring de probabilidad de cierre |
| Diagnóstico | Sugerir banco/producto + autocompletar |
| Análisis | Detectar inconsistencias capacidad pago |
| Auditoría | Pre-flagging de anomalías antes del auditor humano |
| Presentación | Generar guion personalizado por cliente |
| Seguimiento | Predecir días restantes hasta respuesta banco |
| Respuesta Banco | Clasificar respuesta (favorable/parcial/desfavorable) desde texto |
| Informe Final | Redacción ejecutiva automática |
| Cartera | Priorizar gestión de cobro |
| Referido | Identificar clientes con alta probabilidad de referir |
| Promotor | Detectar promotores en riesgo de churn |

Toda IA respeta la política Command Center: **recomienda, no ejecuta** en MVP.

---

## 8. Qué mide Command Center por etapa

Cada etapa expone al Command Center:

- **Volumen**: # casos en la etapa, entrada/salida del mes.
- **Velocidad**: tiempo promedio en etapa, % dentro de SLA, casos estancados.
- **Conversión**: % que avanza vs % que retrocede o se pierde.
- **Salud**: aporta al Health Score global (peso configurable por etapa).
- **Owner**: responsable primario y carga relativa (para Scoreboard).

Vista nueva propuesta para Command Center: **"Mapa del Pipeline en vivo"** — heatmap de las 16 etapas con volumen, SLA y cuellos de botella.

---

## 9. Riesgos globales del modelo

1. **Migración de datos**: casos antiguos sin `subestado` requieren backfill conservador.
2. **Sobre-modelado**: 16 etapas × 4 subestados ≈ 60 combinaciones. Mitigar con motor declarativo, no `if` anidados.
3. **SLA mal calibrado**: empezar con valores conservadores y ajustar con histórico de 30 días.
4. **Etapas 15-16 dependen de NPS**: requiere encuesta automatizada antes de activarlas.
5. **Eventos no idempotentes**: doble disparo puede inflar métricas — usar `evento_id` único.
6. **Romper Pipeline Maestro actual**: la fase es 100% aditiva, etapas 1-14 mantienen IDs actuales (`pipelineEtapas.ts` intacto).

---

## 10. Plan de implementación sugerido (cuando se apruebe)

1. **7.6.1** — Migración aditiva (subestado, responsable_primario, sla_vence_at) + backfill.
2. **7.6.2** — `etapa_sla_config` + motor de transiciones declarativo.
3. **7.6.3** — Event bus interno + auditoría idempotente.
4. **7.6.4** — Vista "Mapa del Pipeline" en Command Center.
5. **7.6.5** — Etapas 15 Referido + 16 Promotor (tablas + UI mínima).
6. **7.6.6** — Integración IA por etapa (incremental, no bloqueante).

Todo **sin tocar** módulos congelados, Pipeline Maestro 1-14, Home por roles, Torre de Control, Command Center.

---

## 11. Qué NO incluye esta fase

- Portal Cliente (Fase 8).
- Ejecución de workflows por IA.
- Programa formal de lealtad para Promotores (queda como Fase 9+).
- Reescritura del Pipeline Maestro existente.

---

**Esperando aprobación para pasar a 7.6.1.** Si quieres ajustar SLAs, responsables, subestados o el alcance de las etapas 15-16 antes de implementar, este es el momento.
