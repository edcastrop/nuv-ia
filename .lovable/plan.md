# Reestructuración del Simulador NUVEX

Convertir el simulador en una herramienta comercial enfocada exclusivamente en: **Extracto → Simulación → Propuesta → PDF Comercial**. Todo lo jurídico, documental, intervinientes y operativo queda únicamente en el Expediente Maestro.

## Alcance — qué cambia y qué NO

**Cambia (simuladores PESOS y UVR):**
- Bloque "Datos del Cliente" simplificado.
- Eliminación del bloque "Intervinientes" del simulador.
- Bloque "Datos del Crédito" reordenado y compacto.
- Bloque "Beneficio Fresh" condicional.
- Propuestas editables + botón "Nueva propuesta".
- Diseño tipo dashboard comercial (cards), no hoja de cálculo.
- PDF comercial recortado a lo financiero.

**NO cambia:**
- Fórmulas financieras (`src/lib/finance.ts`, motores PESOS/UVR).
- Motor de extractos / OCR.
- Expediente Maestro y todos sus bloques jurídicos/documentales/intervinientes.
- Cálculo de honorarios (piso $1.800.000 / $2.000.000).
- Persistencia en `expedientes`, `proyecciones_financieras`, `proyeccion_escenarios`.

## Bloques del nuevo simulador

### 1. Datos del Cliente (compacto)
Campos: Nombre, Cédula, Correo, Celular, Banco, Número de crédito, Producto financiero.
Botón existente "Leer cédula con IA" (reusar `CedulaReader`) ahora autocompleta directamente en estos campos (no en intervinientes).

### 2. Datos del Crédito
Saldo a capital, Valor desembolsado, Tasa, Cuota actual, Seguros, Cuotas pactadas / pagadas / pendientes, Fecha desembolso.

### 3. Beneficio Fresh (condicional)
Toggle SI/NO. Si SI → Valor beneficio, Tasa beneficio, Cuotas restantes beneficio. Si NO → ocultos.

### 4. Simulación (corazón)
- **Resumen actual** en cards: saldo, cuota, cuotas pendientes, intereses proyectados, seguros proyectados, veces pagado.
- **Propuestas como cards** (no tabla). Cada card muestra: cuotas eliminadas, nueva cuota, ahorro total, honorarios, nuevo plazo, abono adicional mensual, "veces pagado".
- **Propuestas editables**: las 4 sugeridas (12/24/36/48 o 36/48/60/72…) son ahora inputs editables. Al cambiar el número de cuotas, recalcula en vivo.
- **Botón "+ Nueva propuesta"**: agrega cards adicionales con cualquier valor permitido por el crédito.
- **Marcar como recomendada**: una sola card destacada; alimenta el PDF y la persistencia.

## Eliminaciones del simulador
- Bloque "Intervinientes" (`IntervinientesFields`) — fuera de Pesos/UVR Simulator.
- Cotitular / Colocatario / Dirección / Lugar expedición de cédula del titular sale de los datos del simulador (sigue existiendo en Expediente Maestro).
- Cobertura jurídica/documental y poderes ya no se muestran aquí.

## PDF Comercial
Recortar la plantilla actual para incluir SOLO:
1. Datos cliente
2. Datos crédito
3. Situación actual
4. Propuesta recomendada
5. Comparativo actual vs optimizado
6. Ahorro proyectado

Quitar: contrato, poder, cotitulares, documentación, jurídico.

## Archivos a modificar

```text
src/components/nuvex/
  PesosSimulator.tsx        ← restructurar bloques + propuestas editables
  UVRSimulator.tsx          ← idem
  ClientFields.tsx          ← simplificar a 7 campos + integrar CedulaReader
  CedulaReader.tsx          ← agregar modo "cliente directo" (sin intervinientes)
  ScenarioTable.tsx         ← convertir a ScenarioCards (cards editables)
  RecommendedResult.tsx     ← ajustar a propuesta única recomendada
  pdf/ (plantilla comercial) ← recortar secciones jurídicas/documentales
  MotorExtractosNUVEX.tsx   ← quitar render de IntervinientesFields aquí si aplica

NO se toca:
  IntervinientesFields.tsx  ← sigue vivo en Expediente Maestro
  src/lib/finance.ts        ← fórmulas intactas
  src/lib/motorExtractos/*  ← OCR intacto
  src/components/expediente-maestro/*  ← intacto
```

## Cambios técnicos clave

1. **Propuestas editables**: extender `PesosPropuesta` / `UVRPropuesta` con un estado local `cuotasEliminadas` editable por card. Usar `calculatePesosManualByCuotas` / `calculateUVRManualByCuotas` (ya existen) para recalcular cuando el usuario edita el número.
2. **Nueva propuesta**: estado `propuestasCustom: number[]` añadido al simulador; se concatena con las sugeridas. Validación: `0 < cuotasEliminadas < cuotasPendientes`.
3. **Cards comerciales**: nuevo componente `PropuestaCard` con badge "Recomendada", input numérico para cuotas, métricas en grid 2x3.
4. **Persistencia**: el payload guardado a `expedientes` / `proyecciones_financieras` mantiene la misma forma; solo cambia la UI.
5. **PDF**: editar la plantilla en `src/components/nuvex/pdf/*` (o `src/lib/proyeccionFinancieraExport.ts`) para omitir secciones jurídicas.

## QA antes de cerrar

- Simular un caso PESOS con extracto Davivienda hipotecario → propuesta recomendada → PDF.
- Simular un caso UVR con cobertura Fresh → toggle SI/NO funciona → PDF.
- Editar manualmente cuotas en una propuesta → cuota, ahorro y honorarios recalculan.
- Agregar 2 propuestas custom → marcar la última como recomendada → PDF refleja la elegida.
- Verificar que el Expediente Maestro del caso siga mostrando intervinientes / cotitulares / jurídico sin cambios.
- `bun run build` limpio.

## Riesgos

- El simulador y el Expediente Maestro comparten algunos componentes (`IntervinientesFields`, `CedulaReader`). El cambio se limitará a **dejar de renderizarlos en los simuladores**; los componentes siguen existiendo para el Expediente Maestro.
- La forma del payload persistido NO cambia para no romper expedientes existentes; los campos ya no editables en el simulador (dirección titular, cotitulares) se siguen guardando vacíos / desde el Expediente Maestro.
