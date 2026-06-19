# Plan: Quick Peek completo + KPI de Ahorro Acumulado

## A. Quick Peek — hidratación de datos

**Archivo:** `src/components/pipeline/LeadQuickPeek.tsx` (refactor de lectura, sin cambiar la UI base)

Hoy el peek solo lee `credito_data` y `propuesta_data` con llaves fijas. Vamos a:

1. **Loader nuevo `useQuickPeekData(expedienteId)`** (hook con TanStack Query) que llame a un server fn `getQuickPeekData` y traiga en un solo request:
   - `proyecciones_financieras` más reciente del expediente (saldo_capital, cuota_actual, tea_pct, cuotas_totales, cuotas_pagadas, cuotas_pendientes).
   - `expediente_proyecciones` activa (cuota propuesta, plazo nuevo, ahorro, cuotas_pendientes_proyectadas).
   - `auditoria_global` → último % consolidado del expediente (motor de auditoría general).
   - `qa_auditorias` → score QA del simulador (extra, ya disponible en `expedientes.qa_score`).
   - Banco/etapa ya están en el expediente.

2. **Cascada de lectura** dentro del peek (sin perder retrocompat): `quickPeekData → propuesta_data/credito_data → cliente_data`. Si todo está vacío, "—".

3. **Tiles nuevos / actualizados:**
   - Banco (chip arriba se mantiene, pero también agregamos tile destacado en grid).
   - Etapa (ya existe).
   - **Cuota actual / Cuota propuesta** (se llenan).
   - **Cuotas pendientes / Cuotas pendientes proyectadas** (nuevo par de tiles).
   - **Tasa actual / Tasa propuesta**.
   - **Ahorro del lead** (ya existe, sube de jerarquía).
   - **Honorarios base / final** (ya existen).
   - **% Auditoría** → barra horizontal coloreada (rojo <60, amarillo 60-79, verde ≥80) con el valor del motor de auditoría general.

4. Mantener glassmorphism NUVIA y tokens dark existentes; nada de hardcoded colors.

## B. Ahorro Acumulado — dentro del Control Panel lateral

**Archivos:**
- `src/lib/pipelineAhorro.functions.ts` (nuevo) — server fn `getAhorroAcumulado({ rango })`.
- `src/components/pipeline/PipelineControlPanel.tsx` (editar) — nueva sección colapsable.
- `src/routes/_authenticated/pipeline.tsx` (editar) — pasar el rango seleccionado al panel.

### Server function

`getAhorroAcumulado({ rango: 'hoy' | 'semana' | 'mes' | 'trimestre' | 'anio' | 'todo' })`:

- Filtra `expedientes` donde `estado_caso IN ('cierre','cobro','cerrado')` (estados finales — confirmaré valores exactos del enum al implementar).
- Ventana sobre `updated_at` / `aceptacion_cliente_at` según el rango.
- Calcula ahorro por caso desde `propuesta_data.ahorro` con fallback a `expediente_proyecciones`.
- Devuelve:
  ```ts
  {
    total: number,
    casos: number,
    desglose: {
      bancos: { nombre: string, total: number, casos: number }[],
      analistas: { id: string, nombre: string, total: number, casos: number }[],
      oficinas: { nombre: string, total: number, casos: number }[]
    }
  }
  ```

### UI dentro del Control Panel

Nueva sección colapsable "Ahorro acumulado":

```text
┌─────────────────────────────────────────┐
│ AHORRO GENERADO            [Mes ▾]      │
│ $ 50.230 M  ·  30 clientes              │
│                                         │
│ [Bancos] [Analistas] [Oficinas]         │  ← tabs
│                                         │
│ Bancolombia       $10.400 M   10 casos →│
│ Davivienda        $ 8.200 M    7 casos →│
│ BBVA              $ 5.900 M    5 casos →│
│ ...                                     │
└─────────────────────────────────────────┘
```

- Selector de rango: Hoy / Semana / Mes / Trimestre / Año / Todo, persistido en `localStorage`.
- Cada fila clickeable filtra el Kanban (`?banco=` / `?asesor=`) y cierra el panel en mobile.
- Tokens NUVIA dark, glow verde en el total, sparkline opcional al lado (fase 2 si hay tiempo).

## C. Notas técnicas

- Sin cambios de schema.
- Server fn protegida con `requireSupabaseAuth`.
- Reuso del query client; `staleTime: 30s` para el peek, `60s` para el ahorro.
- No tocar lógica de pipeline ni del Kanban; solo lectura adicional.
- Sin hardcoded colors: todo con `var(--nuvia-*)`.

## Orden de implementación

1. `getQuickPeekData` server fn + hook.
2. Refactor `LeadQuickPeek` con cascada + nuevos tiles + barra % auditoría.
3. `getAhorroAcumulado` server fn.
4. Sección "Ahorro acumulado" en `PipelineControlPanel`.
5. Verificación con Playwright sobre `/pipeline` (abrir peek de un caso real y verificar valores).
