# Case Snapshot PDF — Resumen ejecutivo del caso

Módulo nuevo, **aditivo**: no toca expediente, PDFs comerciales, contratos, informes ni permisos existentes.

## Entregables

1. **`src/lib/caseSnapshot.functions.ts`** — `getCaseSnapshotData(expedienteId)` server fn con `requireSupabaseAuth`. Agrupa en un único payload tipado:
   - Expediente, cliente, banco, producto, estado, fecha, analista (resuelto vía `resolverAnalistaRealQA` ya existente), score QA, nivel autonomía.
   - Perfil cliente (de `clientes` + `analisis_capacidad_pago` más reciente).
   - Perfil crédito (última lectura en `extractos_lecturas` + `expedientes`).
   - Propuesta seleccionada (de `expediente_proyecciones` / `proyeccion_escenarios` marcado como recomendado).
   - Honorarios (`honorarios_calculos` + `cuentas_cobro` + `comisiones`).
   - Estado operativo (de `expediente_checklist_*`, `envios_contratacion`, `audit_respuestas_banco`, `cartera`).
   - Intervinientes (analista, director financiero, jurídica, apoderado, contabilidad, gerencias — vía `user_roles` + `profiles`).
   - Trazabilidad (últimos 10 de `expediente_historial` / `caso_eventos`).

2. **`src/lib/caseSnapshotPdf.ts`** — Generador con `pdf-lib` (ya usado en `paqueteDocumentalPdf.ts`). Diseño **NUVIA dark premium**:
   - Paleta: fondo `#0B1226`, superficie `#141C30`, borde `rgba(255,255,255,0.08)`, primario `#445DA3`, accent `#84B98F`, texto `#F5F7FB`, secundario `#A8B1C8`.
   - Tipografía Helvetica/HelveticaBold (built-in pdf-lib). Mayúsculas para labels, tabular para cifras.
   - Estructura: portada, perfil cliente, perfil crédito, propuesta (con badge "RECOMENDADA POR NUVIA"), honorarios, timeline operativo (10 hitos con check/dot), intervinientes, trazabilidad. Header con logo NUVIA + footer con paginación, fecha de emisión, "Financial Intelligence Executive Snapshot".
   - Formateo COP con `formatCOP` existente (`src/lib/format.ts`).

3. **`src/components/expediente/CaseSnapshotButton.tsx`** — Botón "Descargar Case Snapshot" (icono `FileDown`), tono NUVIA primary glow. Estados: idle / loading / done. Visible para roles: `analista`, `director_financiero`, `juridica`, `apoderado`, `contabilidad`, `gerencia_administrativa`, `gerencia_comercial`, `super_admin`, `admin`. Usa `useUserRole` + `useServerFn` + descarga vía `descargarBlob`.

4. **Integración**: insertar `<CaseSnapshotButton expedienteId={exp.id} />` en `src/components/expediente/ResumenEjecutivo.tsx` dentro del `action` del `SectionHeader` (junto al % avance). Sin migraciones, sin cambios de schema.

## Detalles técnicos

- Server fn devuelve DTO plano (sin `Date`, sin instancias). Errores controlados → fallback con campos vacíos para no romper PDF.
- Resolución de analista: reutiliza patrón existente que prioriza `expedientes.asesor_id` sobre el caller.
- Datos faltantes → render como "—", nunca crashea.
- PDF tamaño Letter, márgenes 50pt, secciones con tarjetas redondeadas simuladas (`drawRectangle` con borde + fill translúcido).
- Timeline operativo: 10 dots horizontales con color verde (hecho) / amarillo (en curso) / gris (pendiente).
- No instala dependencias nuevas (pdf-lib ya está).
- No modifica RLS, permisos, ni rutas existentes.

## Validaciones post-build

- Build limpio.
- Abrir caso → botón visible → PDF se descarga con datos reales del caso actual.
- Verificar en preview (Playwright) que el botón aparece y descarga sin error de consola.
