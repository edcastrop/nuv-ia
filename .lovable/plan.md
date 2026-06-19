## Cambios solicitados

### 1. Eliminar el paso de "Aprobación por Contratación"
La confirmación del analista pasa a ser la aprobación final. Contratación ya no aprueba datos — los **consume**.

**Flujo nuevo:**
1. Analista sube cédula + extracto → Nuvia llena datos.
2. Analista revisa, edita si hace falta y marca el checkbox de confirmación.
3. Analista pulsa **"Enviar a Contratación"** → el expediente pasa **directo** a estado `datos_validados` (con `validacion_aprobado_por = analista`).
4. Contratación abre el expediente y ya puede generar contrato / poder / solicitud — sin botón "Aprobar".

**Cambios técnicos:**
- `src/lib/validacionIdentidad.ts` → `enviarAValidacion()` ahora marca `validacion_estado='datos_validados'`, registra al analista como aprobador, salta `en_revision_contratacion`. Se mantiene el estado en el tipo (para historiales viejos), pero el flujo nuevo no lo usa.
- `src/components/expediente/ValidacionIdentidadBlock.tsx`:
  - Botón renombrado a **"Enviar a Contratación"**.
  - Se elimina el bloque "Aprobar datos" para Contratación.
  - Se conserva **"Devolver"** y **"Bloquear"** como vías de escape (si Contratación detecta un error grueso o fraude, igual puede frenar). Estos botones se muestran ahora cuando el estado es `datos_validados`.
  - El texto descriptivo cambia: "El analista es responsable de la veracidad de los datos. Contratación los consume directamente."

### 2. Que la cédula y el extracto "viajen" con el expediente
Hoy esos archivos los procesa la IA en memoria y se descartan. Vamos a persistirlos al subirlos.

**Cambios técnicos:**
- `CedulaReader` recibe `expedienteId?: string`. Al aplicar (después de extraer), sube los archivos originales del `queue` al bucket existente `soportes-banco` con `categoria='identidad'`, `subcategoria='cedula_titular'` (o `cedula_cotitular` según `targetIdx`).
- `ExtractoReader` recibe `expedienteId?: string`. Al aplicar el extracto, sube el archivo al bucket `extractos` con `categoria='extracto_banco'`, `subcategoria='<banco>_<producto>'`.
- Si no hay `expedienteId` (simulador nuevo, antes de crear caso), no sube — sin error, no rompe el flujo actual.
- `IntervinientesFields`, `PesosSimulator`, `UVRSimulator`, `ProyeccionFinancieraView`: pasan `expedienteId` al reader.
- `ValidacionIdentidadBlock` añade una sección **"Documentos adjuntos para Contratación"** que lista los soportes (`identidad` + `extracto_banco`) del expediente con nombre, fecha y botón de descarga firmada. Así Contratación los tiene a la vista al lado de los datos.

### 3. Pequeño detalle de UX
- Mientras el expediente esté en `datos_validados`, el checkbox de confirmación queda visible pero deshabilitado (como "ya confirmado").
- El historial sigue registrando `enviar` con snapshot, igual que hoy.

## Lo que NO toco
- Lógica de simulación, motor de honorarios, contratos, poder, solicitud.
- RLS de tablas (`expediente_soportes` y storage ya tienen las políticas necesarias).
- Estados / etapas globales del expediente fuera de validación de identidad.

## Pregunta única antes de implementar
Voy a mantener **Devolver** y **Bloquear** disponibles para Contratación incluso después de `datos_validados`, como red de seguridad (fraude, error grueso). Si prefieres que el envío sea irreversible y Contratación no pueda devolver, dímelo y los quito.

¿Procedo?