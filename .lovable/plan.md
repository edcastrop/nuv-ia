# Veredicto narrativo en la auditoría QA

Hoy la auditoría arroja `score`, `dictamen`, `diferencias[]` y `alertas[]`, pero no narra **quién tiene la razón** ni **dónde está el error**. Propongo añadir un bloque de **Veredicto** que el motor genera automáticamente — el mismo razonamiento que acabo de hacer manualmente, hecho por el sistema cada vez que se corre una auditoría.

## Qué verá el analista

En la página `/qa-ai/:id`, debajo del score, una tarjeta nueva **"Veredicto NUVIA"** con:

1. **Una frase de cabecera** con el resultado: *"El extracto es internamente coherente, pero la cuota cobrada implica un plazo real de 253 meses ≠ 324 reportados."*
2. **Tabla de responsables** — cuatro filas fijas:
   - Extracto del banco
   - Excel del analista
   - Simulador NUVIA
   - Auditoría NUVIA
   
   Cada una con un check / warning / cruz y una línea de por qué.
3. **¿El extracto tiene errores?** — Sí / No / Inconsistencia matemática, con la causa probable (1–3 viñetas).
4. **Recomendación al analista** — qué validar manualmente (recalculo por banco, plazo original vs. remanente, abono extra implícito, etc.).

## Cómo se genera (matemática, no IA)

En `src/lib/qaMath.ts` añado `construirVeredicto(inputs, outputs, diferencias)` que ejecuta estos checks deterministas y produce el objeto `veredicto`:

### Check 1 — Coherencia cuota ↔ plazo ↔ tasa
Compara la **cuota oficial del extracto** con la **cuota teórica francesa** para (saldo, tasa, plazo).
- Si `|cuotaOficial − cuotaTeórica| / cuotaTeórica > 2%` → el extracto está sobre/sub-cobrando.
- Calcula el **plazo real implícito** con la cuota oficial:  
  `n_real = −ln(1 − saldo·i / cuota) / ln(1+i)`
- Si `|n_real − plazoReportado| > 6` meses → emite hallazgo "Plazo real implícito ≠ plazo reportado".

### Check 2 — Saldo UVR ↔ saldo pesos
`saldoUVR × valorUVR` debe coincidir con `saldoCapital` (tolerancia 0.5%).

### Check 3 — FRECH coherente
`cuotaBase − FRECH` debe coincidir con la cuota neta cliente (tolerancia 1%).

### Check 4 — Cuotas pagadas + pendientes = plazo original
Si hay desfase, lo reporta.

### Reglas para la fila de responsables
- **Extracto**: ✅ si pasa Check 2, 3 y 4; ⚠️ si falla Check 1 (cuota no reconcilia con plazo).
- **Excel analista**: ✅ siempre que el escenario sea "cuota teórica del plazo formal" — se asume correcto si el dictamen del extracto pasa.
- **Simulador NUVIA**: ✅ si usa `cuotasPendientes` del extracto sin recortar.
- **Auditoría NUVIA**: ✅ si `score ≥ 95`; ⚠️ si entre 70–95; ❌ si rechazada.

### Causa probable (Check 1 fallido)
Reglas heurísticas:
- Si `n_real < plazoReportado` y diferencia > 30 → "Cuota recalculada con plazo original, no remanente" o "Sobreaporte implícito en la cuota".
- Si `n_real > plazoReportado` → "Cuota subdimensionada — riesgo de saldo residual".
- Si Check 3 falla → "Aplicación incorrecta del subsidio FRECH".

## Cambios técnicos

- `src/lib/qaMath.ts`: nueva función `construirVeredicto()` + tipo `Veredicto`. Versión motor → `1.2.0`.
- `src/lib/qaAI.functions.ts`: persistir `veredicto` dentro de `outputs.veredicto` (no requiere migración — `outputs` es JSONB).
- `src/components/qa-ai/VeredictoBlock.tsx` (nuevo): tarjeta con cabecera, tabla de responsables, sección "¿Hay errores en el extracto?" y recomendaciones. Estilo dark con tokens NUVIA (NCard / NSelect convenciones).
- `src/routes/_authenticated/qa-ai.$id.tsx`: insertar `<VeredictoBlock veredicto={data.outputs.veredicto} />` justo después del bloque de score.
- `src/lib/qaPdf.ts`: incluir el veredicto en el PDF descargable.
- Reejecutar auditoría existente para poblar el campo.

## Lo que NO cambia

- No toco el score ni el dictamen actuales — el veredicto es **explicativo**, paralelo.
- No uso IA generativa: 100% determinista para que sea auditable y consistente.
- Modalidades soportadas en v1: UVR y Pesos (FNA, Davivienda).

## Próximo paso si lo apruebas

Implemento el motor + componente + integración en el detalle de auditoría, y dejo botón "Reejecutar auditoría" disponible para poblar veredictos viejos.
