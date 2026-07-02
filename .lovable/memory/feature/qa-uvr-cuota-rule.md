---
name: QA UVR — regla de cuota
description: En QA de créditos UVR nunca comparar cuota COP directa; usar unidades UVR y nunca marcar crítica
type: feature
---
En `src/lib/qaMath.ts::compararExtracto`, para `modalidad === "uvr"` la
comparación de cuota bancaria contra cuota teórica NO puede hacerse en pesos
directamente: el extracto muestra "cuota programada del período" que fluctúa
por valor UVR del día, abonos previos y recálculos internos del banco.

Regla:
1. Convertir `ext.cuota / valorUVR` y comparar contra `rec.todasCuotas[0].cuotaUvr` (cuota UVR fija teórica).
2. Tolerancia: `max(50 UVR, 5% de cuota UVR teórica)` → dentro de esto NO se marca inconsistencia.
3. Fuera de tolerancia → severidad máxima `warning`, NUNCA `critica`.

Esto evita rechazos falsos (dictamen=rechazado) en créditos UVR bien
reconstruidos donde el analista subió el pago del mes anterior o el extracto
muestra un cargo parcial.

