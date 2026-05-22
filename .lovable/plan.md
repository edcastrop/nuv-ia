
# Cuota Base de Simulación — Corrección estructural

## Objetivo
Que cualquier crédito con beneficio (FRECH, Fresh, cobertura, Mi Casa Ya, subsidio VIS, etc.) se simule sobre la **obligación financiera real**, no sobre la cuota subsidiada. Cero cambios a fórmulas financieras: solo se corrige **qué cuota** se usa como input.

## Alcance

1. **Detección en extracto** (`src/lib/extracto.functions.ts`)
   - Ampliar el prompt de Lovable AI para extraer 3 cuotas distintas: `cuotaPagadaCliente`, `valorBeneficio`, `cuotaSinBeneficio` (cuota antes de subsidio si aparece) + `tipoBeneficio` (FRECH, Fresh, Cobertura VIS, Mi Casa Ya, Subsidio Gobierno, etc.).
   - Detectar keywords: FRECH, Fresh, Tasa Fresh, Cobertura, Cobertura VIS, Mi Casa Ya, Subsidio, Subsidio Gobierno, Subsidio a la tasa, Beneficio VIS, Cobertura de tasa, Subsidio vivienda.
   - Calcular `cuotaBaseSimulacion` siguiendo la jerarquía:
     - **P1**: cuota sin subsidio + seguros (si existe en el extracto).
     - **P2**: cuota pagada cliente + valor beneficio.
     - **P3**: marcar `requiereVerificacion: true`.

2. **Bloque visual "Resumen de interpretación del crédito"** (`src/components/nuvex/ExtractoReader.tsx`)
   - Después de leer el extracto, antes de aplicar al simulador, mostrar tarjeta con:
     - Cuota pagada por cliente
     - Beneficio aplicado (+ tipo)
     - **Cuota base de simulación** (editable)
     - Seguros mensuales
     - Tasa utilizada
   - Botones [Confirmar] / [Editar]. El analista puede sobre-escribir manualmente la cuota base antes de aplicar.
   - Si `requiereVerificacion`, mostrar alerta amarilla con el texto: *"Se detectó un posible beneficio de cobertura o subsidio. Verifique manualmente la cuota base de simulación."*
   - Al confirmar, el extracto inyecta `cuotaBaseSimulacion` (en vez de la cuota cliente) como la cuota del simulador, y guarda los metadatos del beneficio en el estado del simulador.

3. **Simuladores** (`PesosSimulator.tsx`, `UVRSimulator.tsx`)
   - Añadir estado para `interpretacionExtracto` ({ cuotaPagadaCliente, valorBeneficio, tipoBeneficio, cuotaBaseSimulacion, tieneBeneficio }).
   - El campo "Cuota actual" sigue siendo editable y queda **enlazado a la cuota base de simulación** (no a la cuota cliente).
   - Pequeño badge informativo bajo el campo cuando `tieneBeneficio === true`: *"Cuota base de simulación · Beneficio detectado: {tipo}"*.
   - Estos metadatos viajan al expediente y a Proyección.

4. **Expediente** (`src/lib/expedientes.ts` + persistencia)
   - Persistir en `credito_data` los nuevos campos: `cuotaPagadaCliente`, `valorBeneficio`, `tipoBeneficio`, `cuotaBaseSimulacion`, `segurosMensuales`, `tieneBeneficio`. No requiere migración SQL (la columna `credito_data` ya es `jsonb`).

5. **Proyección Detallada** (`ProyeccionDetallada.tsx`)
   - Cargar `cuotaBaseSimulacion` desde el expediente y usarla como `cuotaActualPesos` en `proyectar(...)` (hoy ya lo hace pero leyendo la cuota cliente con seguros).
   - Mostrar en el bloque de "Datos del crédito" la cuota base + cuota cliente + beneficio para trazabilidad.

6. **PDF Propuesta + Resultado Final** (`pdfExport.ts`, `ResultadoFinal.tsx`)
   - Nueva sección "Parámetros financieros utilizados":
     - Cuota pagada por cliente
     - Beneficio aplicado ($ + tipo)
     - **Cuota base utilizada para simulación**
     - Tasa utilizada
   - En Resultado Final añadir el aviso fijo: *"La optimización fue calculada sobre la obligación financiera real del crédito y no sobre la cuota subsidiada o beneficiada temporalmente."* (solo cuando `tieneBeneficio`).

7. **PDF de Proyección** (`proyeccionExport.ts`)
   - Reemplazar la fila "Cuota actual" por "Cuota base de simulación" + fila adicional "Cuota pagada por cliente" cuando exista beneficio.

## Lo que NO se toca
- `proyeccion.ts` (motor) — sin cambios.
- `finance.ts` — sin cambios.
- Cálculo de honorarios, ahorro, amortización — sin cambios.
- Lógica existente de Cobertura Fresh visual en la tabla — sin cambios.

## Riesgos / consideraciones
- Para casos guardados antes de este cambio, no existirá `cuotaBaseSimulacion`. Fallback: usar la `cuotaActual` actual (comportamiento previo).
- La detección depende de Lovable AI; cuando el modelo no encuentre el beneficio, el bloque visual seguirá mostrándose con `tieneBeneficio: false` y todo opera como hoy.
- El analista siempre puede editar manualmente la cuota base — esa edición es la fuente de verdad final.

¿Procedo con la implementación tal como está descrita?
