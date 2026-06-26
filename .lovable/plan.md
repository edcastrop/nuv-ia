## NUVIA Financial QA AI — Command Center Redesign

Rediseño completo de la **capa visual, operativa y analítica** del módulo. **No se toca** lógica matemática, motor QA, reglas, score, base de datos, permisos, automatizaciones ni integraciones. Todo el dashboard lee data real desde los server functions existentes (`qaAI.functions.ts`), extendiendo solo las consultas de lectura cuando haga falta para alimentar los nuevos paneles.

### Archivos a crear/modificar

**Modificar** (frontend puro):
- `src/routes/_authenticated/qa-ai.index.tsx` — reemplazar dashboard actual por command center
- `src/lib/qaAI.functions.ts` — **agregar** server fns de lectura agregada (no se toca lo existente):
  - `qaRiesgoPorBanco()` — agregaciones por banco desde `qa_auditorias`
  - `qaRankingAnalistas()` — agregaciones por analista
  - `qaTopInconsistencias()` — top desde `qa_inconsistencias`
  - `qaTendencia30d()` — serie 30 días
  - `qaColaRevision(filters)` — lista priorizada
  - `qaCopilotoSignals()` — señales para panel lateral

**Crear** componentes en `src/components/qa-ai/`:
- `QAFilterBar.tsx` — barra sticky de filtros globales (FASE 1)
- `PanelPrioridad.tsx` — 6 cards "Requieren tu atención" (FASE 2)
- `HeatmapBancos.tsx` — tabla riesgo por banco (FASE 3)
- `RankingAnalistas.tsx` — tabla desempeño + nivel autonomía (FASE 4)
- `TopInconsistencias.tsx` — lista con tendencia/gravedad (FASE 5)
- `TendenciaQAChart.tsx` — gráfico líneas 30 días (FASE 6, recharts)
- `ColaRevision.tsx` — tabla priorizada con acciones (FASE 7)
- `CopilotoQAPanel.tsx` — panel lateral señales automáticas (FASE 8, reutiliza drawer existente)
- `ReconstruirCasoButton.tsx` — modo investigación (FASE 9, abre `qa-ai/$id` con todos los bloques)

### Layout final del dashboard

```text
┌───────────────────────────────────────────────────────────┐
│ HERO: NUVIA Financial QA AI                               │
│ Centro de Control de Auditoría Matemática y Riesgo Op.    │
├───────────────────────────────────────────────────────────┤
│ [Filtros sticky: Analista|Banco|Producto|Modal|UVR|...]   │
├───────────────────────────────────────────────────────────┤
│ REQUIEREN TU ATENCIÓN (6 cards clickeables)               │
│ [Bloqueados] [Esp.Dictamen] [Devueltos] [Críticas]        │
│ [UVR sin rev] [Vencidos SLA]                              │
├──────────────────────────┬────────────────────────────────┤
│ RIESGO POR BANCO         │ RANKING ANALISTAS              │
│ (heatmap, click→filtra)  │ (precisión, autonomía L1/L2/L3)│
├──────────────────────────┼────────────────────────────────┤
│ TOP INCONSISTENCIAS      │ TENDENCIA QA 30d (líneas)      │
├──────────────────────────┴────────────────────────────────┤
│ COLA DE REVISIÓN (orden inteligente + acciones)           │
│ Cliente|Banco|Analista|Producto|Modal|Score|Riesgo|Estado │
│ Acciones: Ver | Dictamen | Devolver | Aprobar | Reconstruir│
└───────────────────────────────────────────────────────────┘
                       ┌──────────────────────┐
                       │ COPILOTO QA (drawer) │
                       │ señales automáticas  │
                       └──────────────────────┘
```

### Reglas de cálculo (solo presentación, no motor)

- **Riesgo banco**: alto si `avg_score<90` o `%error>15`; medio 90–95; bajo >95
- **Autonomía analista**: L1 supervisado (precisión<85 o <10 casos); L2 semi (85–94); L3 autónomo (≥95 y ≥30 casos)
- **Orden cola**: `prioridad = (critico*1000) + (bloqueado*500) + (100-score)*10 + diasAntiguedad + ticket/1M`
- **SLA vencido**: `ejecutado_at > 48h` sin dictamen final

### Diseño visual

- Tokens NUVIA existentes: `#242424` fondo, `#445DA3` azul accent, `#84B98F` verde éxito, `#FFFFFF` texto
- Componentes `NCard`, `KpiCard`, `SectionHeader`, `nuvia-input`, `NSelect` (memoria de inputs dark)
- Tablas: `color` explícito en cada `th`/`td` con tokens (memoria dark-table)
- Gráficos: recharts ya disponible, líneas finas estilo Bloomberg
- Cards de prioridad: borde lateral 3px con color de severidad

### Validaciones antes de entregar

- Tipos OK (`tsgo`), build limpio
- Server fns existentes (`qaKpis`, `listAuditoriasQA`, `obtenerAuditoriaQA`) **intactas**
- Permisos vía `useUserRole().canValidarProyeccion` se mantienen
- CopilotoQADrawer existente sigue funcionando
- Navegación a `/qa-ai/$id`, `/qa-ai/nuevo`, `/qa-ai/alertas`, `/qa-ai/config` intacta
- Botón "Abrir simulación del analista" en `qa-ai/$id` intacto

### Fuera de alcance (no se toca)

Motor matemático, `qaMath.ts`, `qaGuard.ts`, `simuladorAutoQA.ts`, reglas en `qa_reglas`, score, RLS, migraciones, edge functions, `qa-ai.$id.tsx`, `qa-ai.nuevo.tsx`, `qa-ai.config.tsx`, `qa-ai.alertas.tsx`.

¿Apruebas el plan para implementarlo?
