
# Plan: Módulo "Proyección Financiera NUVEX"

Nuevo módulo avanzado de modelado financiero hipotecario / leasing habitacional, accesible para **Licenciado**, **Analista Financiero (director_financiero_qa)** y **Director Financiero**. Permite construir proyecciones desde cero o desde un expediente existente, comparar escenarios ilimitados y exportar informes corporativos.

---

## 1. Acceso y ruta

- Ruta: `/_authenticated/proyeccion-financiera` (entrada nueva en sidebar: "Proyección Financiera").
- Gate de rol: `licenciado`, `director_financiero_qa`, `gerencia`, `super_admin`, `admin`.
- Mantener la ruta existente `/proyeccion` (proyección técnica dentro del expediente) intacta — este es un módulo nuevo independiente.

## 2. Modelo de datos (Supabase)

Nuevas tablas:

- **`proyecciones_financieras`** — cabecera del caso de proyección
  - `expediente_id` (nullable, FK lógico), `cliente_nombre`, `banco`, `tipo_producto` (hipotecario|leasing), `moneda` (pesos|uvr), `fecha_desembolso`, `valor_desembolsado`, `saldo_capital`, `cuota_actual`, `tea_pct`, `cuotas_totales`, `cuotas_pagadas`, `cuotas_pendientes`, `fecha_terminacion_estimada`, `seguro_vida`, `seguro_incendio`, `seguro_terremoto`, `otros_seguros`, `uvr_valor`, `saldo_uvr`, `variacion_uvr_pct`, `created_by`, `notas`
- **`proyeccion_escenarios`** — escenarios ilimitados por proyección
  - `proyeccion_id` (FK), `nombre`, `tipo` (actual|nuvex|conservador|agresivo|personalizado), `aporte_mensual_extra`, `abono_extraordinario`, `nueva_tasa`, `nuevo_plazo`, `resultado_jsonb` (KPIs + tabla amortización cacheada), `es_principal`
- RLS: SELECT/INSERT/UPDATE/DELETE para roles autorizados + creador; GRANT a `authenticated` y `service_role`.

## 3. Motor financiero (frontend)

Nuevo archivo `src/lib/proyeccionFinanciera.ts` que reutiliza `src/lib/proyeccion.ts` y añade:

- `calcularEscenario({ saldo, tasa, cuota, seguros, aporteExtra, abonoExtraordinario })` → devuelve tabla mes-a-mes, totales, fecha fin, costo total.
- `compararEscenarios(actual, optimizado)` → KPIs: años/meses eliminados, intereses evitados, seguros evitados, ahorro total, ROI cliente, costo de no actuar (= intereses + seguros que se pagarían de más manteniendo el escenario actual).
- Soporte pesos y UVR (usa motor existente).

## 4. UI / componentes

Estructura en `src/components/proyeccion-financiera/`:

- `ProyeccionFinancieraView.tsx` — layout principal tipo dashboard fintech (Bloomberg/Revolut), responsive mobile-first.
- `FormularioDatos.tsx` — secciones colapsables:
  - Información general (banco, producto, moneda, fecha, cliente)
  - Datos del crédito (valor, saldo, cuota, tasa, plazos)
  - Seguros desglosados (vida, incendio, terremoto, otros) + cálculos derivados
  - Datos UVR (condicional)
  - Botón "Cargar desde expediente" si se pasó `?expedienteId=…`
- `CalculadoraAvanzada.tsx` — sliders/inputs para cuota, tasa, plazo, aportes mensuales, abonos extraordinarios; recálculo en vivo.
- `MotorNuvex.tsx` — chips de aporte rápido (+100k, +200k, +300k, +500k, libre) y resultados instantáneos.
- `ComparadorEscenarios.tsx` — tabla lado a lado "Crédito Actual" vs "Optimizado NUVEX".
- `EscenariosManager.tsx` — crear/duplicar/eliminar/renombrar escenarios; ilimitados.
- `KpiCards.tsx` — tarjetas destacadas con prioridad visual al "Costo de No Actuar".
- `GraficasProyeccion.tsx` — 6 gráficas con `recharts`:
  1. Capital vs Interés mes a mes (área apilada)
  2. Tiempo Actual vs Optimizado (barras)
  3. Composición de cuota (pie/donut)
  4. Saldo pendiente (línea)
  5. Ahorro acumulado (línea)
  6. Costo de no actuar (barras comparativas)
- `TablaAmortizacion.tsx` — virtualizada + exportable.
- `InformeEjecutivo.tsx` — preview del informe.

## 5. Exportaciones

- **PDF Corporativo**: reutilizar `src/lib/pdf/nuvexPdfKit.ts` para generar informe con header de marca, KPIs, gráficas (renderizadas), tabla resumen y recomendación.
- **Excel**: `xlsx` (ya disponible) con hojas: Resumen, Escenarios, Amortización, KPIs.

## 6. Identidad visual

- Tokens NUVEX existentes: azul `#445DA3`, verde `#84B98F`, oscuro `#242424`.
- Diseño minimalista fintech: tarjetas blancas con sombra suave, tipografía clara, KPI hero destacando "Costo de No Actuar" en rojo/ámbar.

## 7. Preparación para "Lector IA de Extractos" (futuro)

- `FormularioDatos` expone un prop `onPrefill(data)` y un slot `<UploadExtractoIA />` placeholder con tooltip "Próximamente".
- Esquema de datos del formulario tipado en `src/lib/proyeccionFinanciera.ts` con un `ProyeccionFinancieraInput` que la IA podrá rellenar.

## 8. Navegación / sidebar

- Añadir item "Proyección Financiera" en el sidebar visible solo a roles autorizados (verificar el archivo del sidebar existente).
- Desde un expediente: botón "Abrir en Proyección Financiera" que navega a `/proyeccion-financiera?expedienteId={id}`.

## 9. Detalles técnicos clave

- Recálculo derivado con `useMemo` (no se persiste en cada tecla; se guarda al pulsar "Guardar escenario").
- Persistencia opcional: el módulo funciona 100% en cliente; guardar es opcional para historial.
- Validaciones con `zod`.
- Reutiliza `formatCOP`, `parseCurrency`, hooks `useUserRole`, `useAuth`.

## 10. Entregables

1. Migración SQL (2 tablas + RLS + GRANTS).
2. `src/lib/proyeccionFinanciera.ts` (motor + tipos).
3. Componentes en `src/components/proyeccion-financiera/`.
4. Ruta `src/routes/_authenticated/proyeccion-financiera.tsx`.
5. Entrada en sidebar.
6. Exportadores PDF y Excel.

---

**Confirma para construir.** Si quieres ajustar el alcance (p. ej. omitir persistencia en BD en esta primera versión, o reducir gráficas), dímelo y replanteo antes de implementar.
