
## Plan: Centro de Cartera NUVEX

Módulo nuevo y aislado para gestión de honorarios. NO toca simuladores, OCR, Expediente Maestro, Poderes, Datos Contrato, Resultado Final, Cuenta de Cobro, Paz y Salvo. Solo agrega.

---

### 1. Base de datos (1 migración)

**Estados del caso** — agregar al enum `caso_estado`:
- `documentos_banco_firmados`
- `condiciones_aplicadas`

Actualizar `CASO_ESTADOS` en `src/lib/casoEstados.ts` para insertar los dos nuevos estados en el orden correcto (entre `aprobado` y `resultado_final_generado`).

**Tabla `cartera`** (1 fila por expediente, nace solo cuando estado_caso = `condiciones_aplicadas` o `resultado_final_generado`):
- `id`, `expediente_id` (unique), `responsable_id` (uuid → profiles)
- `estado_cartera` (enum nuevo)
- `forma_pago` ('contado' | 'financiado')
- `fecha_aplicacion_banco`, `fecha_resultado_final`, `fecha_cuenta_cobro`, `fecha_vencimiento` (calculada = aplicación + 5 días)
- `honorarios_totales` (snapshot), `pagado`, `saldo` (generated)
- `created_at`, `updated_at`

**Enum `cartera_estado`**: pendiente_cobro, cuenta_cobro_generada, cuenta_cobro_enviada, pago_parcial, pago_total, vencido, acuerdo_pago, en_seguimiento, prejuridico, cerrado.

**Tabla `cartera_cuotas`** (para financiado): cartera_id, numero, valor, fecha_vencimiento, estado, pagado.

**Tabla `cartera_pagos`**: cartera_id, fecha, valor, metodo, banco_receptor, comprobante_num, comprobante_url, observaciones, user_id.

**Tabla `cartera_acuerdos`**: cartera_id, valor_total, numero_cuotas, fecha_inicio, fecha_fin, estado, observaciones, user_id.

**Tabla `cartera_comunicaciones`** (correos + whatsapp manual): cartera_id, tipo ('email_cuenta_cobro'|'email_recordatorio'|'email_vencimiento'|'email_mora_7'|'email_mora_15'|'email_prejuridico'|'whatsapp_*'), canal ('email'|'whatsapp'), estado ('enviado'|'copiado'|'marcado'), asunto, destinatario, body, proveedor_msg_id, user_id, created_at.

**Tabla `cartera_auditoria`**: cartera_id, user_id, accion, observacion, canal, created_at.

**Bucket storage**: `cartera-comprobantes` (privado).

**RLS**: 
- super_admin ve todo
- cartera (rol nuevo si no existe ya — sí existe) gestiona todo
- juridica ve `estado_cartera = 'prejuridico'`
- licenciado (asesor del expediente) solo SELECT, sin INSERT/UPDATE de pagos
- Trigger en `cartera_pagos` insert → recalcula `cartera.pagado`/saldo; si saldo=0 → estado_cartera='pago_total' y estado_caso='honorarios_pagados'.
- Trigger insert `cartera_comunicaciones` y `cartera_pagos` → `cartera_auditoria`.

---

### 2. Server functions

`src/lib/cartera.functions.ts`:
- `crearCartera({expedienteId, fechaAplicacion, formaPago, responsableId})` — valida estado, calcula vencimiento.
- `registrarPago({carteraId, ...})` — upload comprobante a storage, insert pago, recalcula via trigger.
- `crearAcuerdo({carteraId, ...})`.
- `enviarPrejuridico(carteraId)` — cambia estado_cartera + estado_caso, registra auditoría.
- `enviarCorreoCartera({carteraId, tipo})` — Resend con adjuntos PDF generados desde expediente (reutiliza helpers existentes de cuenta de cobro / resultado final si están; si no, genera básico). Tipos 1–6 según módulo 9.
- `programarRecordatoriosCron` — server route `/api/public/hooks/cartera-recordatorios` ejecutado por pg_cron diariamente, escanea carteras por fecha y dispara correos automáticos según ventanas (día 3, vencimiento, +7, +15, +30).

`src/lib/cartera.ts` — helpers cliente (list, get, queries).

---

### 3. UI

**Nuevo bloque en `casos.$id.tsx`** (solo si estado_caso ∈ {condiciones_aplicadas, resultado_final_generado, ...posteriores}):
- Si no existe cartera → botón "Crear cartera" → modal con fecha aplicación banco + forma pago + responsable.
- Si existe → resumen + link a `/cartera/$id`.

**Nueva ruta `/_authenticated/cartera/index.tsx`** — Dashboard:
- Indicadores: Causados, Recaudados, Pendientes, Vencidos, Acuerdos, Prejurídicos, Recaudo mes/año, por licenciado, por banco.
- Tabla "Clientes por cobrar" con filtros (estado cartera, responsable, banco, mora >X días).

**Ruta `/_authenticated/cartera/$id.tsx`** — Detalle:
- Datos automáticos del expediente (cliente, cédula, banco, producto, etc.)
- Fechas importantes (editable solo cartera/admin).
- Selector responsable.
- Forma de pago + cuotas si financiado (CRUD cuotas, valida suma).
- Sección "Registrar pago" (form + upload comprobante).
- Lista pagos con saldo en vivo.
- Sección Acuerdos de Pago (CRUD).
- Sección Comunicaciones: tabla + botones "Enviar correo X", "Copiar mensaje WhatsApp", "Marcar como enviado".
- Botón "Enviar a prejurídico" (rojo).
- Si saldo=0 → botón "Generar paz y salvo" (link a módulo existente).
- Auditoría (timeline).

**Sidebar/nav**: link "Cartera" visible para super_admin, admin, gerencia, cartera, juridica (juridica solo prejurídicos).

**Hook**: `useCarteraPermissions()` para gating (licenciado readonly).

**Integración estado_caso**: cuando se marca `condiciones_aplicadas` desde `EstadoCasoBlock`, mostrar toast "Listo para crear cartera".

---

### 4. Correos (Resend ya conectado)

Reutilizar patrón de `contratacion.functions.ts`. Plantillas inline HTML (sencillas, branded). Adjuntos PDF: cuenta de cobro y resultado final generados con helpers existentes (`legalDocsExport` / `pdfExport`).

Cron job pg_cron diario 09:00 COL → POST `/api/public/hooks/cartera-recordatorios` con apikey anon, route escanea carteras activas y envía correos pendientes según reglas + registra en `cartera_comunicaciones`.

---

### 5. Archivos

**Crear:**
- `supabase/migrations/<ts>_cartera.sql`
- `src/lib/cartera.ts`, `src/lib/cartera.functions.ts`
- `src/components/cartera/CrearCarteraModal.tsx`
- `src/components/cartera/RegistrarPagoForm.tsx`
- `src/components/cartera/CuotasFinanciadas.tsx`
- `src/components/cartera/ComunicacionesPanel.tsx`
- `src/components/cartera/AcuerdosPanel.tsx`
- `src/components/cartera/CarteraBlockExpediente.tsx`
- `src/routes/_authenticated/cartera.index.tsx`
- `src/routes/_authenticated/cartera.$id.tsx`
- `src/routes/api/public/hooks/cartera-recordatorios.ts`

**Editar (mínimo):**
- `src/lib/casoEstados.ts` (2 estados nuevos)
- `src/routes/_authenticated/casos.$id.tsx` (montar `CarteraBlockExpediente`)
- `src/routes/_authenticated.tsx` (link nav)

---

### Notas

- NO se toca cuenta de cobro, paz y salvo, resultado final — solo se consumen como PDFs adjuntos.
- Cartera nace de forma explícita (botón) tras `condiciones_aplicadas`, no automáticamente, para que el usuario confirme la fecha real de aplicación.
- Trigger DB asegura consistencia saldo/estado aún si se inserta pago vía otra ruta.
- Cron de recordatorios es idempotente (no reenvía si ya hay comunicación con mismo tipo en la ventana).

¿Procedo con la implementación?
