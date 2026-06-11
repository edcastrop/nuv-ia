# Motor de Honorarios NUVEX

Módulo nuevo de pricing engine que calcula, controla y audita los honorarios de cada caso de optimización, eliminando la negociación arbitraria y protegiendo el margen de NUVEX.

## 1. Acceso y navegación

- Nueva entrada en el menú lateral: **Motor de Honorarios** (icono `DollarSign`).
- Nueva ruta: `/_authenticated/honorarios-motor` (vista principal) + `/_authenticated/honorarios-motor/$id` (detalle/oferta de un cálculo).
- Roles con acceso:
  - **Analista / Licenciado / Director Financiero**: calcular, simular, solicitar aprobación.
  - **Dirección Comercial / Gerencia / Super Admin**: aprobar / rechazar / contraofertar + ver reportes ejecutivos.
  - Resto: sin acceso.

## 2. Motor de cálculo (`src/lib/motorHonorarios.ts`)

Función pura, testeable, sin dependencias de UI:

- **Inputs**: `ahorroIntereses`, `ahorroSeguros`, `tipoCredito` ("pesos" | "uvr"), `plazoOriginalMeses`, opcionalmente `saldoCapital`, `banco`, `cliente`.
- **Clasificación automática**:
  - UVR + plazo 360 → `uvr_360` (3%)
  - Ahorro ≤ 100M → `estandar` (6%)
  - 100M < ahorro ≤ 200M → `intermedio` (5%)
  - 200M < ahorro ≤ 400M → `premium` (4%)
  - > 400M → `corporativo` (3.5%)
- **Honorario teórico** = `ahorroTotal × %`
- **Reglas de tope**: piso $2.000.000, techo $14.000.000 (con flag `alertaTope` cuando se topa).
- **Matriz de descuento máximo**:
  - 2M–5M → 10%
  - 5M–10M → 20%
  - >10M → 30%
- **Generador de ofertas**: base + Pronta firma 10/20/30%.
- **Semáforo de autorización** sobre un descuento propuesto: verde / amarillo (≥80% del límite) / rojo (excede).
- **Índice de rentabilidad** = `vendido / recomendado × 100` con semáforo (≥90 verde, 80–89 amarillo, <80 rojo).

## 3. Base de datos (Lovable Cloud)

### `honorarios_calculos`
Cada cálculo guardado desde una simulación.
- `expediente_id` (FK, nullable), `simulacion_id`, `cliente_nombre`, `banco`, `tipo_credito`, `plazo_original`, `saldo_capital`
- `ahorro_intereses`, `ahorro_seguros`, `ahorro_total`
- `clasificacion` (enum), `porcentaje_aplicado`, `honorario_teorico`, `honorario_topado`, `alerta_tope`
- `honorario_ofertado`, `descuento_aplicado_pct`, `rentabilidad_pct`
- `estado` (enum: `borrador` | `ofertado` | `pendiente_aprobacion` | `aprobado` | `rechazado` | `contraofertado` | `cerrado`)
- `created_by`, `created_at`, `updated_at`

### `honorarios_aprobaciones`
- `calculo_id` FK, `solicitado_por`, `aprobado_por`, `decision` (`aprobado`|`rechazado`|`contraofertado`)
- `honorario_solicitado`, `honorario_contraoferta`, `motivo_solicitud`, `comentarios_aprobador`
- timestamps

### `honorarios_auditoria` (append-only)
- `calculo_id`, `user_id`, `accion`, `valor_anterior` jsonb, `valor_nuevo` jsonb, `created_at`
- Sin DELETE permitido (RLS bloquea).

RLS + GRANT estándar. Trigger de auditoría en INSERT/UPDATE de `honorarios_calculos`.

## 4. UI — Vista principal `/honorarios-motor`

Layout estética premium NUVEX (#242424, #445DA3, #84B98F), tarjetas tipo Stripe/Revolut.

### Pestañas
1. **Calculadora** — selector de simulación existente (autocompleta desde `proyecciones_financieras` / casos) o entrada manual. Al calcular muestra el **Dashboard de Honorarios**:
   - Tarjetas: Ahorro Total · Honorario Teórico · % Aplicado · Honorario Comercial · Clasificación · Descuento Máx · Rentabilidad Esperada
   - Bloque **Generador de Ofertas** (4 tarjetas: Base, P.F. 10/20/30%)
   - Slider/Input de "Honorario a ofertar" con semáforo en vivo
   - Si rojo → botón **Solicitar Aprobación** abre modal (Cliente, Ahorro Total, Recomendado, Solicitado, Motivo, Comentarios)
2. **Mis cálculos** — tabla con filtros por estado, banco, clasificación, fecha.
3. **Aprobaciones** (solo Dirección Comercial / Gerencia) — bandeja de solicitudes con botones Aprobar / Rechazar / Contraofertar.
4. **Reportes** (solo gerencia) — dashboard ejecutivo: honorarios vendidos por mes, % descuento promedio, top analistas, tasa de aprobación, rentabilidad promedio. Recharts.

## 5. Integración con simulaciones existentes

Sin tocar la lógica de simulación. Solo añadir un botón **"Calcular honorarios NUVEX"** en `PropuestasComerciales.tsx` que abre la calculadora prellenada con los ahorros del caso actual. No se rompe ningún flujo existente.

## 6. Auditoría

Cada acción (cálculo, oferta enviada, descuento aplicado, solicitud, decisión) genera fila en `honorarios_auditoria` con snapshot antes/después. RLS impide `DELETE`. Visualización en pestaña interna del detalle del cálculo.

## 7. Orden de implementación

1. Migración (3 tablas + RLS + GRANT + trigger auditoría).
2. Motor puro `src/lib/motorHonorarios.ts` + tipos.
3. Capa de datos `src/lib/honorariosMotor.functions.ts` (serverFn con `requireSupabaseAuth`).
4. Vista principal + 4 pestañas, componentes de tarjetas y generador de ofertas.
5. Bandeja de aprobaciones + modal de solicitud.
6. Reportes con Recharts.
7. Botón de integración en `PropuestasComerciales.tsx`.
8. Entrada de menú lateral.

## Lo que NO cambia

- Lógica de simuladores (Pesos / UVR).
- Honorarios pactados en `expedientes` (este motor es la fuente recomendada; la sincronización al expediente queda como acción explícita "Aplicar al caso", no automática, para no romper recálculos a éxito ya existentes).
- Cartera, comisiones, wallet.

¿Apruebo y construyo así, o ajustamos algo (por ejemplo: queremos que al aprobar se escriba automáticamente en `expedientes.honorarios_base` / `honorarios_final`)?
