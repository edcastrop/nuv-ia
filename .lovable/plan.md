# Checklist Inteligente de Documentos

Submódulo nuevo dentro del Módulo Jurídico del Expediente Maestro, llamado **Documentos Requeridos**, que genera automáticamente el listado de documentos que se le deben pedir al cliente para radicar la representación ante el banco.

## 1. Alcance de esta primera entrega

Voy a entregar la **matriz documental + UI + envío de correo + trazabilidad** completa y funcional. La matriz por banco se entrega cableada en código (editable luego desde Super Admin en una segunda iteración), porque hoy no existe tabla de "matriz documental editable" y crearla con UI de edición sin código entra en alcance de un segundo sprint.

Confirma antes de implementar:

1. **Persistencia**: ¿guardamos el estado del checklist (documentos, estados, fechas, archivos cargados) en una tabla nueva `expediente_documentos_requeridos` ligada al expediente? Recomiendo que sí.
2. **Carga de archivos del cliente**: ¿el cliente sube archivos a un link público de NUVEX, o por ahora basta con que **el licenciado** marque "Recibido" y adjunte el archivo desde el expediente? Recomiendo la segunda opción para esta entrega (más rápido, sin portal externo).
3. **Correo institucional NUVEX**: ¿usamos el sistema de correos ya existente del proyecto (Lovable Emails / dominio configurado), o solo generamos el PDF + cuerpo del correo y lo abrimos en el cliente de correo del licenciado (`mailto:`)? Recomiendo iniciar con envío real vía Lovable Emails si el dominio ya está activo; si no, fallback a `mailto:`.
4. **Configuración Super Admin editable**: ¿lo dejamos para una segunda fase? La matriz funciona hardcoded por banco/perfil en esta entrega.

## 2. Matriz documental (cableada)

Archivo nuevo: `src/lib/checklistDocumental.ts`

- `DocRequerido` con campos: `id`, `nombre`, `obligatorio`, `vigenciaDias?`, `observacion?`, `perfil: "ambos"|"empleado"|"independiente"`, `condicion?` (función contra el expediente).
- `MATRIZ_DOCUMENTAL: Record<BancoKey, DocRequerido[]>` con:
  - Generales (cédula cliente, cédula apoderado, poder, Solicitud Cambio de Plazos).
  - Bancolombia, Davivienda, Davibank/Scotiabank Colpatria, Banco de Bogotá, Banco de Occidente, AV Villas, Banco Popular.
- `buildChecklist(expediente, perfil, flags)` que:
  - Combina generales + banco.
  - Si `perfil = "ambos"`: une empleado + independiente sin duplicar por `id`.
  - Aplica condiciones: declara renta sí/no, pago mensual/quincenal (3 vs 6 desprendibles), billeteras virtuales sí/no.
  - Marca `vigenciaDias` (Certificado Tradición y Libertad = 15 días) y devuelve alertas.

## 3. Persistencia (migración Supabase)

Tabla nueva `expediente_documentos_requeridos`:

- `id`, `expediente_id`, `documento_id` (string de la matriz), `documento_nombre`, `obligatorio`, `estado` (`pendiente|solicitado|recibido|en_revision|aprobado|rechazado|vencido|no_aplica`), `vigencia_dias`, `fecha_solicitado`, `fecha_recibido`, `fecha_vencimiento`, `archivo_url`, `observaciones`, `created_by`, `updated_at`.

Tabla nueva `expediente_checklist_envios`:

- `id`, `expediente_id`, `enviado_a_email`, `cc_licenciado_email`, `asunto`, `cuerpo`, `pdf_url`, `enviado_por`, `enviado_at`.

RLS: lectura para roles `super_admin, admin, gerencia, licenciado, operaciones, juridica`. Inserción/actualización para los mismos roles excepto `contabilidad` (solo lectura). Borrado solo `super_admin`.

## 4. UI nueva

Archivo nuevo: `src/components/expediente-maestro/ChecklistDocumental.tsx`

- Header con banco detectado y badges del perfil seleccionado.
- Selector de perfil: Empleado / Independiente / Ambos.
- Flags condicionales: ¿Declara renta? · ¿Pago mensual o quincenal? · ¿Billeteras virtuales?
- Lista de documentos con:
  - Nombre, obligatoriedad, observación legal.
  - Selector de estado (los 8 estados).
  - Subida de archivo (Supabase Storage bucket `expedientes`).
  - Alerta visual si CTL pasa 15 días.
- Acciones:
  - **Regenerar checklist** (recalcula desde matriz, conserva estados ya cargados).
  - **Descargar PDF** del checklist (usa `legalDocsExport` adaptado o nuevo `checklistPdf.ts`).
  - **Enviar al cliente** (modal con email del cliente, CC = correo del licenciado, asunto y cuerpo editables; usa la plantilla pedida).
  - Estado global: badge "Listo para radicación" cuando todos los obligatorios están `aprobado`.

Punto de entrada: nueva pestaña/sección dentro de `ModuloJuridico.tsx` arriba de los documentos jurídicos, titulada **"Documentos Requeridos"**.

## 5. Envío de correo

Server function `src/lib/checklistDocumental.functions.ts`:

- `enviarChecklistAlCliente({ expedienteId, to, cc, asunto, cuerpo, pdfBase64 })` con `requireSupabaseAuth`.
- Si el proyecto tiene Lovable Emails activo: envío real con plantilla transaccional + adjunto = link al PDF (no soportamos attachments nativos → subimos PDF a Storage y mandamos link de descarga, como dicta la guía).
- Si no: la función devuelve `{ mailtoUrl }` y la UI abre el correo del licenciado prellenado.
- Registra en `expediente_checklist_envios`.

## 6. Alertas y trazabilidad

- Al guardar estados, se registra en `expediente_eventos` (o tabla equivalente ya existente) con `tipo = "checklist_documental"`.
- Hook ya existente de alertas (`finanzas-cron` / `casos-alertas`) recibe una nueva regla: documentos pendientes > X días → notificación al licenciado.
- Badge global "Expediente listo para radicación" disponible para que Operaciones lo accione.

## 7. Permisos

Usando `useUserRole` ya existente:

- `licenciado`: ver/editar checklist de sus casos, enviar correo, marcar recibido, cargar archivos.
- `operaciones`: cambiar estados, marcar listo para radicación.
- `juridica`: validar Poder y Solicitud Cambio de Plazos.
- `super_admin / admin`: todo.
- `contabilidad`: solo lectura.

## 8. Detalles técnicos

- Mapa de banco → key normalizada reutilizando el helper que ya usa `legalDocs.ts` (`detectGrupoCalculoPlazo`). Lo extraigo a `bancoUtils.ts` si hace falta.
- Storage: bucket `expedientes`, ruta `expediente/{id}/documentos-requeridos/{docId}/{filename}`.
- PDF del checklist generado con el mismo `pdfKit` ya usado en otros documentos.

## 9. Fuera de alcance (segunda fase)

- UI Super Admin para editar la matriz sin código (la matriz vive en `checklistDocumental.ts` y es trivialmente editable por desarrollador).
- Portal público para que el cliente suba archivos directamente.
- Integración bidireccional con buzón del licenciado para parsear respuestas.

Si confirmas las 4 preguntas del punto 1, procedo a implementar exactamente esto.
