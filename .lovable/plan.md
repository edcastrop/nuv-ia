## Plan — Comisiones liberadas según recaudo real

### Objetivo
Las comisiones de licenciados deben liberarse proporcionalmente al dinero efectivamente recaudado por NUVEX, no sobre el total contratado.

---

### 1. Cambios de base de datos (migración)

**Tabla `comisiones` — nuevas columnas:**
- `honorarios_contratados numeric` — snapshot de honorarios finales
- `recaudado numeric default 0` — total recaudado del expediente
- `comision_potencial numeric` — = honorarios_contratados × porcentaje / 100
- `comision_liberada numeric default 0` — = recaudado × porcentaje / 100
- `comision_pagada numeric default 0` — suma de cuentas de cobro pagadas
- Nuevo estado: `'liberada_parcial'` además de los existentes

**Función `liberar_comisiones_por_recaudo(expediente_id)`:**
- Calcula total recaudado en `cartera_pagos` (vía `cartera.expediente_id`)
- Actualiza `comisiones.recaudado` y `comision_liberada` para el expediente
- Asegura comisión existe (la crea si recaudo > 0 y aún no fue auto‑creada)
- Inserta evento en `finanzas_auditoria` (`accion='comision_liberada'`)
- Inserta alerta en `finanzas_alertas` cuando hay nuevo saldo liberable

**Trigger sobre `cartera_pagos` AFTER INSERT/UPDATE/DELETE:**
- Llama `liberar_comisiones_por_recaudo()` para el expediente del pago

**Función `comision_disponible_para_cc(comision_id)`:**
- Devuelve `comision_liberada - comision_pagada - (suma en CC activas no rechazadas)`

**Ajuste a `auto_liquidar_comision()`:**
- Ya no crea comisión sólo en estado `honorarios_pagados`. Crear/asegurar comisión cuando exista cartera con recaudo > 0 o cuando se apruebe el caso. Mantener `estado='generada'` hasta haber liberación.

**Backfill:** recorrer expedientes existentes y recalcular `recaudado` y `comision_liberada`.

---

### 2. Backend (server functions)

**`src/lib/comisiones.functions.ts` (nuevo):**
- `crearCuentaCobroLiberada({ comisionIds, porcentajeComision })` — valida vía `comision_disponible_para_cc` que cada comisión tenga saldo liberado; el monto de la CC se calcula como min(disponible, todavía no incluido). Bloquea si alguna comisión no tiene saldo (Regla 6 y 7).
- Al aprobar/marcar pagada cuenta de cobro → actualizar `comision_pagada += valor` (en trigger `recalc_cuenta_cobro_total` o nuevo trigger sobre `cuentas_cobro`).

**`src/lib/comisiones.ts`:**
- Actualizar tipo `Comision` con nuevos campos.
- Helper `getResumenComisiones(userId)` para dashboard.

---

### 3. UI

**`/comisiones` (Mis Comisiones) — `src/routes/_authenticated/comisiones.index.tsx`:**
- Nuevas columnas: Honorarios contratados, Honorarios recaudados, Comisión potencial, Comisión liberada, Comisión pagada, Saldo pendiente de pago.
- Al crear CC: sólo permitir seleccionar comisiones con `liberada - pagada - en_cc > 0` y limitar el monto incluido.
- Banner de notificación cuando hay comisión disponible para cuenta de cobro con desglose (cliente, banco, recaudado, liberada, saldo por recaudar).
- Aviso cuando hay CC `devuelta_correccion`.

**Dashboard licenciado — `src/routes/_authenticated/dashboard.tsx`:**
- Tarjetas: Comisión potencial / liberada / pagada / pendiente / casos pendientes de recaudo.

**Vista finanzas `/finanzas/comisiones`:**
- Añadir totales liberada/pagada/pendiente al panel de stats.

---

### 4. Auditoría (Regla 10)
Ya existe `finanzas_auditoria`. Cada `liberar_comisiones_por_recaudo` inserta registro con: expediente_id, valor recaudo, user que validó pago, comision_liberada nueva, CC asociada (si aplica).

---

### Validación final (replicar casos)
- Caso 1: honorarios 3M, pago 1.5M, 50% → liberada 750k.
- Caso 2: pago adicional 1.5M → liberada total 1.5M.
- Caso 3: CC pagada 750k → pagada 750k, pendiente 750k.

---

### Lo que NO se toca
- OCR, simuladores, jurídica, PDFs, motor de cálculo, mapeo casos↔expedientes.
- Cartera UI ni lógica de pagos (sólo se engancha trigger).
- Reglas de roles y RLS existentes.

¿Apruebas para implementar?