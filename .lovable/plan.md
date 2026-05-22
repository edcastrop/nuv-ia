## Proyección Detallada del Crédito — módulo independiente

Crear un módulo nuevo bajo `/proyeccion`, accesible desde la barra superior, sin tocar la propuesta comercial, el Resultado Final ni la Cuenta de Cobro.

### 1. Navegación
- Agregar entrada **"Proyección"** en `_authenticated.tsx` (junto a Simulador, Casos, Dashboard, Academia) apuntando a `/proyeccion`.

### 2. Nueva ruta `src/routes/_authenticated/proyeccion.tsx`
- Selector de caso: lista los expedientes del asesor (tabla `expedientes`) con buscador por cliente / cédula / Nº crédito.
- Al elegir un caso, carga `cliente_data`, `credito_data`, `propuesta_data` y `aprobado_data` y arma los inputs base sin pedirlos de nuevo.
- Soporta tanto PESOS como UVR (detecta `modo`).

### 3. Sección "Cobertura Fresh" (solo visual, no afecta cálculos NUVEX)
Campos editables:
- Tiene cobertura Fresh (switch)
- Valor cobertura Fresh mensual ($)
- Tasa cobertura Fresh (%) — informativa
- Cuotas Fresh totales (default **84**)
- Cuotas Fresh pagadas
- Cuotas Fresh pendientes = `84 - pagadas` (auto, editable)

Lectura desde extracto:
- Extender `extracto.functions.ts` para intentar detectar `coberturaFresh { activa, valorMensual, tasa, cuotasTotales, cuotasPagadas }`. Si se detecta, autocompletar al confirmar; si no, queda manual.
- Persistir estos campos en `credito_data.coberturaFresh` del expediente.

### 4. Motor de proyección (`src/lib/proyeccion.ts`)
Genera mes a mes desde la fecha de inicio (default = hoy) hasta saldo = 0:
- **PESOS**: amortización francesa con `tasaMensual = (1+TEA)^(1/12) - 1` y cuota actual del banco.
- **UVR**: usa `saldoUVR`, `valorUVR`, `variacionUVR` y `tasaCobrada` (proyecta valor UVR mensual igual que `finance.ts`).
- Para cada cuota calcula: saldo inicial, interés, capital, seguros, cobertura Fresh (solo durante `cuotasFreshPendientes`), cuota antes de cobertura, cuota pagada por cliente = cuota − Fresh, saldo final, fecha estimada.
- Genera dos proyecciones: **Actual** (cuota actual / plazo restante) y **Optimizada** (toma `propuesta_data.seleccionada` — la propuesta manual elegida — con nueva cuota y nuevo plazo).

### 5. UI del módulo
- Header con datos base (cliente, banco, producto, Nº crédito, saldo, cuota, seguros, tasa, plazo, propuesta optimizada elegida).
- Card "Cobertura Fresh" (sección editable).
- Botón principal **"Generar Proyección Detallada"**.
- **Descomposición visual de cuota** (barra apilada): Capital · Interés · Seguros · Cobertura Fresh, con la cuenta "cuota antes − Fresh = cuota pagada".
- **Resumen ejecutivo** (dos columnas): Escenario Actual vs Optimizado — fecha finalización, total intereses, total seguros, total pagos.
- **Comparativo** (tabla): cuotas pendientes, años, fecha fin, intereses, seguros, Fresh total, total proyectado.
- **Gráficos** (recharts ya disponible):
  1. Línea: evolución del saldo Actual vs Optimizado.
  2. Donut/Stacked bar: distribución Capital/Intereses/Seguros/Fresh.
  3. Línea de tiempo: fecha fin actual vs optimizada.
- **Tablas mes a mes** (Actual y Optimizado) en tabs, con todas las columnas pedidas.

### 6. Exportaciones
- **PDF** "Informe Detallado de Proyección del Crédito" usando `jsPDF` + `jspdf-autotable` (`pdfExport.ts` ya está en el proyecto):
  - Pág 1: datos + dashboard ejecutivo + comparativo.
  - Pág 2: gráficos (capturados con `html2canvas`) + fechas de finalización.
  - Pág 3: explicación técnica (Cobertura Fresh, intereses, seguros) + nota legal.
  - Anexo opcional: tabla completa mes a mes (autoTable).
- **Excel**: botón "Descargar Excel" usando `xlsx` (instalar `xlsx` si falta) con dos hojas: Proyección Actual / Proyección Optimizada, columnas: Cuota, Fecha, Saldo inicial, Capital, Interés, Seguros, Cobertura Fresh, Cuota pagada, Saldo final.

### 7. Persistencia en expediente
- Al generar, hacer `update` sobre `expedientes.credito_data` añadiendo:
  - `coberturaFresh` (activa, valor, tasa, totales, pagadas, pendientes)
  - `fechaFinalizacionActual`, `fechaFinalizacionOptimizada`
- No se modifican honorarios ni ahorro: la Fresh es solo visualización.

### 8. Diseño
- Paleta NUVEX (#242424 / #445DA3 / #84B98F), tipografía Inter, estética tipo Bloomberg / wealth management: tarjetas oscuras, KPIs grandes, tablas densas legibles, separadores finos.

### Detalles técnicos
- Archivos nuevos:
  - `src/routes/_authenticated/proyeccion.tsx`
  - `src/components/nuvex/ProyeccionDetallada.tsx` (UI principal)
  - `src/components/nuvex/CoberturaFreshFields.tsx`
  - `src/lib/proyeccion.ts` (motor)
  - `src/lib/proyeccionExport.ts` (PDF + Excel)
- Archivos editados:
  - `src/routes/_authenticated.tsx` (nuevo nav item)
  - `src/lib/extracto.functions.ts` + `src/components/nuvex/ExtractoReader.tsx` (detectar Fresh)
- Dependencias: `xlsx` (si no está instalada).
- No se toca `PesosSimulator`, `UVRSimulator`, `ResultadoFinal`, `PrintDocument` ni `SaveExpedienteButton`.
