# Nueva estructura de productos bancarios NUVEX

Este es un cambio transversal que toca DB, simulador, expediente, OCR, documentos legales y dashboard. Lo hago por fases para no romper flujos existentes.

## 1. Base de datos — tabla maestra

Nueva tabla `public.productos_bancarios`:

- `id` (uuid)
- `banco` (text)
- `tipo_producto` ENUM: `credito_hipotecario` | `leasing_habitacional`
- `modalidad` ENUM: `pesos` | `uvr_baja` | `uvr_media` | `uvr_alta` | `uvr`
- `cobertura` (bool)
- `nombre_comercial` (text, único)
- `codigo` (text, único — ej `BCO_CH_PESOS_COB`)
- `activo` (bool)
- `orden` (int)

RLS: lectura `authenticated`, escritura solo `super_admin` / `admin`.
Seed inicial con los 36 productos (Bancolombia 8, Davivienda 16, Bogotá 8, Caja Social 4).

## 2. Capa TypeScript

- `src/lib/productosBancarios.ts`: tipos + helper `parseProductoComercial(nombre)` que retorna `{banco, tipo, esLeasing, esUVR, modalidadUVR, cobertura}`.
- Hook `useProductosBancarios()` → carga lista activa cacheada (react-query).
- Reemplazar las constantes `PRODUCTOS_PESOS` / `PRODUCTOS_UVR` por consultas a la tabla, manteniendo compatibilidad con `tipoProducto` (string nombre_comercial) ya guardado en expedientes.

## 3. Selector de producto unificado

Nuevo componente `<ProductoBancarioSelect>` que reemplaza el `SelectField` de "Tipo de producto" en:
- `ClientFields.tsx` (simulador Pesos/UVR)
- Editor de expediente maestro
- Cualquier formulario que pida producto

El selector muestra dos pasos: Banco → Producto, o un único combo agrupado por banco. Guarda el `nombre_comercial` exacto (compatibilidad con datos existentes) y opcionalmente `producto_id`.

## 4. Integración con simulador

`/index.tsx` y `ModeSelector`: cuando se elige un producto, derivar automáticamente `modo` (`pesos` vs `uvr`) y abrir el simulador correspondiente. Si el producto es UVR Baja/Media/Alta (Davivienda), pasar `submodalidadUVR` al UVRSimulator para que aplique la curva/tasa correcta (los cálculos actuales se mantienen; solo etiqueta).

## 5. Hipotecario vs Leasing → Intervinientes

`intervinientes.tsx` ya soporta titular/cotitular. Lo extiendo:
- Si `tipo_producto = leasing_habitacional`: las etiquetas pasan a **Locatario / Colocatario**.
- Si `credito_hipotecario`: **Titular / Cotitular** (actual).

Se hace mediante prop `modoIntervinientes: "hipotecario" | "leasing"` derivada del producto.

## 6. Documentos legales

Los generadores ya leen `cliente_data.tipoProducto` como string. Garantizo que ese campo siempre sea el `nombre_comercial` exacto del catálogo y actualizo:
- `poderTemplates.ts`
- `legalDocs.ts` / `legalDocsExport.ts`
- `solicitudCambioPlazosDocx.ts`
- `checklistDocumentalDocx.ts`
- `proyeccionFinancieraExport.ts`
- Ficha contractual / Informe final / Otro Sí

Cambio puntual: donde dicen "Titular" reemplazo por la etiqueta dinámica (Locatario si leasing).

## 7. OCR / Motor de extractos

`bankProfiles.ts` ya detecta banco + producto + moneda. Añado un mapper `mapMotorAProductoComercial({banco, producto, moneda, beneficioActivo, modalidadUVR?})` que retorna el `nombre_comercial` exacto del catálogo, para autoseleccionar el producto al cargar un extracto.

## 8. Dashboard / Estadísticas

En `dashboard.tsx` y `super-admin.expedientes.tsx`, añadir tarjetas:
- Por banco
- Hipotecario vs Leasing
- Pesos vs UVR
- Con cobertura vs Sin cobertura

Se construyen agregando `expedientes` y resolviendo el producto vía `parseProductoComercial`.

## 9. Compatibilidad / migración de datos

Los expedientes existentes guardan `tipo_producto` como texto libre. Script de normalización (best-effort): match por nombre exacto contra catálogo; los que no matcheen quedan como `legacy` y se muestran con un badge "producto sin catalogar" en el expediente, sin romper nada.

## Orden de entrega

1. Migración DB + seed (te la mando para aprobación).
2. Capa TS + selector + integración simulador/intervinientes.
3. Integración OCR + documentos.
4. Dashboard.
5. QA cruzado en un expediente real antes de cerrar.

## Confirmaciones que necesito antes de arrancar

1. **UVR Baja / Media / Alta de Davivienda**: ¿son solo etiqueta comercial o cada una tiene una tasa/curva distinta que debe afectar el simulador hoy? (Hoy el UVRSimulator es uno solo).
2. **Catálogo cerrado**: ¿agrego también FNA, Davibank, AV Villas, Credifamilia, Bancoomeva, Occidente, Popular que ya están en `BANCOS`, o por ahora solo los 4 bancos del mensaje y los demás quedan inactivos?
3. **Productos existentes en expedientes**: ¿migro/normalizo los nombres viejos al nuevo catálogo, o los dejo como legacy y solo aplico catálogo a casos nuevos?
