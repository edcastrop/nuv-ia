
# Corrección urgente — Envío a Contratación

## 1. Constraint real de `envios_contratacion.estado_envio`

Verificado contra la base:

- Columna `text NOT NULL DEFAULT 'enviado'`.
- **No existe CHECK ni ENUM.** Cualquier string es válido.
- Los únicos valores usados hoy son `'enviado'` y `'error'`.

Por tanto puedo introducir un tercer valor `'preparando'` sin migración. **No se creará migración.**

Estados finales a usar:

- `preparando` — fila creada al inicio, antes de validar/enviar.
- `enviado` — Resend confirmó éxito.
- `error` — cualquier fallo antes o durante el envío.
- `enviado_trazabilidad_parcial` — Resend confirmó éxito pero falló el UPDATE del expediente o el INSERT en `expediente_historial` (conserva `proveedor_message_id`).

## 2. Orden actual del flujo (server: `enviarContratacion`)

1. Verifica expediente accesible.
2. Verifica `LOVABLE_API_KEY` + `RESEND_API_KEY`.
3. Lee asesor.
4. `ensureStoredSupport("cedula")` y `ensureStoredSupport("extracto")` — completa adjuntos desde storage si faltan.
5. Valida por nombre de archivo que existan cédula y extracto → si falla: `throw` **sin dejar rastro**.
6. Llama a Resend.
7. Si Resend falla: inserta fila `error` y `throw`.
8. Si Resend OK: inserta fila `enviado`, actualiza `expedientes.estado` y crea `expediente_historial`.

**Bug raíz:** los `throw` de los pasos 1–5 no dejan fila en `envios_contratacion`. El analista no ve error persistente y el sistema no registra el intento.

## 3. Punto exacto de la fila inicial

En `contratacion.functions.ts`, dentro de `.handler(...)`, **como primera operación después de resolver `userId`** y **antes** de verificar expediente/keys/adjuntos:

```ts
const { data: intento, error: intentoErr } = await supabase
  .from("envios_contratacion")
  .insert({
    expediente_id: data.expedienteId,
    user_id: userId,
    destinatarios: data.destinatarios,
    asunto: data.asunto,
    documentos: data.attachments.map(a => ({ name: a.filename, type: a.contentType, size: Math.floor(a.contentBase64.length*3/4) })),
    estado_envio: "preparando",
  })
  .select("id")
  .single();
if (intentoErr || !intento) throw new Error("No se pudo registrar el intento de envío.");
const intentoId = intento.id;
```

Todas las rutas de error posteriores hacen `UPDATE ... WHERE id = intentoId`.

## 4. Archivos a modificar

Exactamente tres:

1. `src/lib/contratacion.functions.ts` — fila inicial, wrapping try/catch por fase, validación completa del paquete, manejo de errores Supabase, respuesta enriquecida.
2. `src/components/expediente-maestro/EnviarContratacion.tsx` — `contabilidad@nuvex.com.co` obligatorio, no cerrar modal en error, mensajes claros, botón "Reintentar envío" tras error.
3. `src/lib/contratacion.ts` — (solo si es necesario) añadir tipos para el nuevo shape de respuesta del server.

**No se tocan** otros archivos. No se tocan buckets, RLS, triggers, `cliente_id`, QA, simuladores, honorarios, pipeline, matemática, motor financiero, extractos históricos, ni Validación de Identidad.

## 5. Validación del paquete (server-side, tras `ensureStoredSupport`)

Sobre `allowedAttachments` (paquete final antes de Resend):

```
requeridos = {
  poder: /^poder|_poder|poderesp/i,
  ficha: /ficha|datos_contrato|contrato/i,
  cedula: /(cedula|cédula|identidad)/i,
  extracto: /extracto/i,
}
```

Faltantes se acumulan en un array `faltantes: string[]`. Si `faltantes.length > 0` → UPDATE fila `preparando` → `error` con `error: "Faltan: " + faltantes.join(", ")` y `throw` con mensaje accionable.

**Cotitular:** el flujo genera un poder por cada `poderDocs` (ya incluye cotitular). La cédula del cotitular llega via `expediente_soportes.subcategoria = cedula_cotitular_*`. No añado un requisito rígido de "poder cotitular separado" porque no siempre aplica contractualmente; sí validaré que si el expediente tiene cotitulares activos (leyendo `apoderados_nuvex` con `expediente_id`), viaje al menos una cédula extra. Si no la trae, se agrega a `faltantes`.

## 6. Manejo de errores

Para cada fase, wrap con try/catch que **actualiza `envios_contratacion` a estado `error`** con `error: "[fase] mensaje"` truncado a 2000 chars (sin JWT, sin base64, sin PII completa — sólo código, fase, nombre de archivo, cantidad y expediente_id).

- **Antes de Resend** (validación, storage, base64, credenciales, payload): UPDATE fila a `error` → `throw` con mensaje accionable. Expediente **no** se toca. Historial **no** se crea.
- **Error de Resend**: UPDATE fila a `error` con status HTTP + body resumido. Sin update de expediente. Sin historial.
- **Resend OK pero falla el UPDATE de `expedientes` o el INSERT de `historial`**: UPDATE fila a `enviado_trazabilidad_parcial`, **conserva `proveedor_message_id`**. Devuelve al cliente `{ ok: true, messageId, warning: "trazabilidad_parcial" }`. `console.error` seguro con `intentoId` y `messageId`. **No** se duplica correo.

Todos los `.insert()` y `.update()` de Supabase revisan `{ error }` explícitamente.

## 7. Destinatario obligatorio (UI)

- Al cargar `listDestinatarios()`, forzar que `contabilidad@nuvex.com.co` esté en `selected` (aunque el analista lo intente desmarcar → se vuelve a marcar con toast: "El correo operativo de contratación no puede desmarcarse").
- Si no aparece en la tabla (o está inactivo), botón "Enviar" bloqueado con mensaje: "Falta el destinatario operativo obligatorio. Contacta a Admin."
- **No se modifica** `contratacion_destinatarios`. Solo lectura.
- No se usa `contratacion@nuvex.com.co` hardcoded en ninguna parte.

## 8. Reintento mínimo

Cuando `error` está seteado y no `done`:

- Se muestra botón "Reintentar envío" (junto al "Cerrar").
- Reintento = mismo `handleSend()` (no reutiliza base64 anterior; regenera poderes + ficha + relee soportes).
- Server crea una **nueva fila** en `envios_contratacion` cada vez (no se introduce `intento_numero` porque la columna no existe y el objetivo es no migrar).
- El modal **no se cierra automáticamente** en error. Solo se cierra en éxito confirmado por Resend.
- No se crea expediente nuevo. Estado del expediente solo cambia a `ENVIADO_CONTRATACION` en éxito Resend.

## 9. Límite de adjuntos

**Evidencia real** (query sobre `envios_contratacion` exitosos):

| max_docs | avg_docs | envíos > 10 | total |
|---|---|---|---|
| 9 | 4 | 0 | 33 |

**Ningún paquete histórico superó 10 adjuntos.** Por tanto **mantengo `max(10)`** y mejoro el mensaje del validador Zod a:

> "Este paquete supera el límite permitido de 10 adjuntos. Reduce o consolida los archivos antes de enviar."

## 10. Mensajes visibles al analista

- ÉXITO: `"Paquete enviado correctamente a Contratación. Destinatario principal: contabilidad@nuvex.com.co. ID del envío: {messageId}"`.
- ÉXITO parcial (trazabilidad): `"Correo enviado (ID: {messageId}), pero falló el registro interno. Contacta a soporte con este ID; no reenvíes."`.
- ERROR documentos: `"No fue posible enviar el paquete. Faltan: {lista}. Carga los documentos pendientes y vuelve a intentarlo."`.
- ERROR técnico: `"No fue posible completar el envío. El intento quedó registrado. Puedes volver a intentarlo sin crear un nuevo expediente."`.

## 11. Resultado esperado en los dos casos reales

- **NUV_2026_MG_000046**: sin cédula ni extracto → al pulsar Enviar, el server registra fila `error` con `"Faltan: cedula, extracto"` y la UI muestra el mensaje de documentos faltantes. El expediente no cambia de estado.
- **NUV_2026_EC_000201**: cédulas + extracto presentes → reintento tras el fix debe completar y dejar fila `enviado` con `proveedor_message_id`.

## 12. Fuera de alcance (confirmado)

QA, simuladores, honorarios, pipeline, RLS, triggers, buckets, `cliente_id`, matemática financiera, documentos originales, migraciones OCR, migración de históricos, columna `intento_numero`, módulo complejo de reenvíos.

---

**Pendiente tu aprobación para implementar.**
