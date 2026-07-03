## Alcance
Enriquecer el **Input Console** del NUVIA Amortization Engine con: Fecha de desembolso, Conversor de tasa (con "Tasa fresh"), Activación completa de campos UVR, Importar desde expediente (opcional), Guardar escenarios (últimos 10), y KPI de Punto de equilibrio. Exportar PDF/Excel ya existe — solo se pule para incluir los nuevos campos.

## Cambios en `herramientas.amortizacion.tsx`

### 1. Fecha de desembolso
- Nuevo state `fechaDesembolso` (input tipo `month`, default: mes actual).
- En cada `Row` se calcula `fechaCuota = fechaDesembolso + periodo meses`.
- Se agrega columna **Fecha** (mm/aaaa) en la tabla, PDF y Excel.

### 2. Conversor de tasa (con Tasa Fresh)
Nuevo bloque colapsable "Convertidor de tasa" arriba del input TEA:
- **Tasa Fresh**: campo libre donde el analista pega cualquier tasa (ej. la que ve en el extracto).
- Selector de tipo origen: `EA`, `NMV`, `NAMV`, `NASV`, `MV` (mensual vencida directa).
- Muestra en vivo la conversión a las otras 4 tasas.
- Botón **"Usar como TEA"** que copia el valor convertido al campo TEA principal.

Fórmulas (agregadas al bloque MATH):
- NMV → EA: `(1 + nmv)^12 − 1`
- NAMV → EA: `(1 + nam/12)^12 − 1`
- NASV → EA: `(1 + nas/2)^2 − 1`
- MV → EA: `(1 + mv)^12 − 1`

### 3. Activar campos UVR
Ya existen `uvrInicial` y `varUvr`. Se agrega:
- **Variación UVR anual esperada** con presets rápidos (chips): `Conservador 3%`, `Base 5%`, `DANE histórico 6.2%`.
- Chip informativo con el valor UVR del día (placeholder editable — futura integración con tabla `nuvia_uvr_mensual`).
- Validación visual: si `modo === "uvr"` y falta `uvrInicial`, el botón Calcular queda deshabilitado con tooltip.

### 4. Importar desde expediente (opcional)
Botón "Importar caso NUV_…" arriba del Input Console:
- Abre modal con búsqueda por código de expediente (query a `expedientes` filtrando por `codigo ilike`).
- Al seleccionar: hidrata TEA, plazo, valor, seguros, banco, cliente desde `cliente_data` / `extracto_data`.
- Si no hay caso o el analista lo cierra, la herramienta sigue funcionando standalone.

### 5. Guardar escenarios (últimos 10)
- `localStorage` key: `nuvia_amort_scenarios`.
- Cada escenario guarda: `{ nombre, modo, tea, plazo, valor, seguros, fechaDesembolso, uvrInicial, varUvr, ts }`.
- Nuevo Panel "Escenarios guardados" con lista + botón "Cargar" y "Eliminar".
- Botón **"Guardar escenario"** en el footer del Input Console pide nombre (prompt) y guarda.

### 6. KPI: Punto de equilibrio
Nueva tarjeta en la sección de resultados:
- Muestra el número de cuota donde `capital ≥ interés` (ya existe `findBreakEven`).
- Sub-línea: fecha estimada (usando `fechaDesembolso + breakEven meses`) y % del plazo transcurrido.
- Visualmente: card gradiente NUVIA con ícono `Target`, número grande, y micro-copy "En la cuota X pagas más capital que intereses".

### 7. Exportar (ajuste)
- PDF y Excel agregan la columna **Fecha**.
- Header del PDF/Excel incluye fecha de desembolso y punto de equilibrio.

## Notas técnicas
- Sin cambios de esquema DB (los escenarios son locales; el import solo lee `expedientes`).
- Sin nuevas dependencias.
- Se preserva 100% el look actual (glass + tokens NUVIA dark).
- Los abonos extraordinarios (#3) se construyen **después**, como herramienta independiente (aprobado por el usuario).
