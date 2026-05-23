## Objetivo

Centralizar toda la lógica del beneficio Fresh / Cobertura VIS / Mi Casa Ya en el expediente del cliente: detección OCR automática, autocompletado, cálculos derivados (84 cuotas), resumen visual, almacenamiento permanente y reutilización en todos los módulos NUVEX (simuladores, PDF, proyecciones, paz y salvo, cuenta de cobro).

## Fase 1 — Modelo de datos unificado (`src/lib/proyeccion.ts`)

Extender `CoberturaFresh` con los campos derivados y de auditoría:

```ts
interface CoberturaFresh {
  activo: boolean;
  tipoBeneficio: "FRECH" | "FRESH" | "VIS" | "MI_CASA_YA" | "SUBSIDIO_TASA" | "OTRO";
  valorMensual: number;
  tasa: number;
  cuotasTotales: number;      // default 84
  cuotasPagadas: number;
  cuotasPendientes: number;
  beneficioRecibido: number;  // derivado
  beneficioRestante: number;  // derivado
  detectadoOCR: boolean;
  fuente: "ocr" | "manual" | "mixto";
  ultimaSincronizacion: string | null;
}
```

Crear helper puro `computeFreshDerivados(fresh, cuotasPagadasCredito)` que devuelve `{ cuotasPagadas, cuotasPendientes, beneficioRecibido, beneficioRestante }` aplicando el tope de 84.

## Fase 2 — Detección OCR (`src/lib/extracto.functions.ts`)

Añadir al parser del extracto la detección de patrones (case-insensitive):

- Activación: `/frech|fresh|cobertura vis|mi casa ya|subsidio (gobierno|de tasa)|cobertura a la tasa|beneficio de cobertura/`
- Valor mensual: filas con `valor (fresh|subsidio) mensual` → monto.
- Tasa: `tasa (subsidiada|de cobertura|fresh)` → porcentaje.

Devolver en el payload del OCR un bloque `coberturaDetectada` con `{ activo, valorMensual?, tasa?, tipoBeneficio, confidence }` y un flag `incompleto` cuando falte algún campo.

## Fase 3 — Hook de sincronización OCR ↔ expediente

Nuevo hook `useFreshSync` (en `src/hooks/useFreshSync.ts`) que:

1. Recibe `coberturaDetectada` del OCR y `coberturaActual` del expediente.
2. Si el expediente está vacío → autocompletar y activar.
3. Si difieren → exponer `diff` para que el componente muestre el aviso "Se detectaron cambios frente a la información previamente almacenada" con botones **Actualizar** / **Conservar**.
4. Recalcular derivados cada vez que cambian `valorMensual`, `cuotasPagadas` del crédito o `cuotasTotales`.
5. Mostrar toast "Información de cobertura no encontrada con suficiente confianza. Verifique manualmente." cuando OCR active el beneficio pero falten campos.

## Fase 4 — UI del módulo Fresh (`CoberturaFreshFields.tsx`)

- Selector de **Tipo de beneficio** (FRECH/FRESH/VIS/Mi Casa Ya/Subsidio tasa/Otro).
- Tarjeta nueva **RESUMEN DEL BENEFICIO DE COBERTURA** debajo del formulario:
  - Valor Fresh mensual
  - Cuotas subsidiadas pagadas / pendientes
  - Beneficio recibido acumulado (verde)
  - Beneficio restante estimado (verde)
  - Estilo azul corporativo `#445DA3`, indicadores verde `#84B98F`.
- Validación visual: si falta algún valor → borde ámbar + mensaje "Complete los campos antes de guardar".
- Badge "Detectado automáticamente desde extracto" cuando `fuente !== "manual"`.

## Fase 5 — Persistencia en expediente

- En `src/lib/expedientes.ts` agregar `cobertura_fresh` al payload `UpsertPayload` y al tipo `Expediente` (almacenado dentro de `credito_data.coberturaFresh` para no romper esquema actual — JSONB existente).
- `SaveExpedienteButton` bloquea guardado si `fresh.activo && incompleto` (regla 8) y muestra el detalle de campos faltantes.
- Al reabrir el expediente, hidratar el estado Fresh desde `credito_data.coberturaFresh` en `PesosSimulator` y `UVRSimulator`.

## Fase 6 — Reutilización en módulos posteriores

Ya consumen `CoberturaFresh` (proyección.ts, PrintDocument, ProyeccionDetallada, PazYSalvo). Verificar y, donde no esté:

- **PrintDocument.tsx (PDF):** añadir mini-bloque "Cobertura activa: $X/mes · N cuotas restantes" en página 2 sólo si `fresh.activo`.
- **ProyeccionDetallada.tsx:** mostrar dos líneas por cuota mientras dure el beneficio — **Cuota real pagada** (con subsidio descontado) y **Cuota sin subsidio** (regla 7).
- **ResultadoFinal / Cuenta de cobro / Paz y Salvo:** leer del expediente, no del formulario.

## Fase 7 — Validación y auditoría

- En `useFreshSync`: comparar hash `{valorMensual,tasa,cuotasTotales}` OCR vs. expediente.
- Componente `<FreshAuditBanner />` con las acciones Actualizar / Conservar.
- Log local (no DB) del último diff aplicado.

## Detalles técnicos

- Todos los cálculos derivados son puros y se exportan desde `src/lib/cobertura.ts` (nuevo) para que PDF, proyección y UI compartan la misma fuente de verdad.
- No se modifican fórmulas financieras base ni el cálculo de honorarios.
- No se crean nuevas tablas: se reutiliza `expedientes.credito_data` (JSONB) — sin migración.
- Tope duro 84 cuotas se aplica tanto en input (clamp) como en el cálculo derivado.

## Fuera de alcance

- Cambios visuales al PDF más allá del bloque informativo mínimo.
- Nuevas integraciones de OCR (sólo se amplía el parser existente).
- Cambios en lógica de honorarios o ahorro total.
