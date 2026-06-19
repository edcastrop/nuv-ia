## Objetivo

Eliminar dos candados que están bloqueando al analista:

1. **Validación de datos para Contratación** — ya no exigir un paso de revisión externa cuando el analista subió cédula + extracto y NUVIA leyó los datos.
2. **Envío obligatorio a Auditoría QA** — cuando el motor NUVIA aprueba la simulación matemáticamente (sin críticas y con score apto para el nivel del analista), el caso pasa directo a Contratación. Solo se enruta a QA si NUVIA detecta discrepancias graves.

---

## Cambios

### 1. Auto-aprobación basada en el motor NUVIA

**`src/components/nuvex/SaveExpedienteButton.tsx`**
- Recibir `auditResult: AuditoriaResultado` y `nivelAutonomia: NivelAutonomia` como props.
- Al guardar, calcular `decidirPdf(nivel, auditResult)`:
  - `accion === "permitir"` → **NO** llamar `enviarAValidacionQA`. En su lugar:
    - `cambiarEstadoCaso(id, "proyeccion_aprobada_qa", "auto", "Aprobada automáticamente por motor NUVIA")`
    - Guardar `aprobado_data` (snapshot inmutable) replicando lo que hoy hace `aprobarQA()` — extraer a helper `snapshotPropuestaAprobada(expedienteId, validacionId=null)` en `validacionQA.ts`.
    - Mensaje: "Expediente aprobado por NUVIA · listo para Contratación".
  - `accion === "permitir_con_marca"` o `"bloquear"` → ruta actual: `enviarAValidacionQA` (queda como red de seguridad para casos con marca de advertencia o críticas).
- Etiqueta dinámica del botón:
  - permitir → "Crear y enviar a Contratación"
  - permitir_con_marca → "Crear y enviar a auditoría QA (advertencia)"
  - bloquear → "Crear y enviar a auditoría QA (revisión obligatoria)"

**`PesosSimulator.tsx` / `UVRSimulator.tsx`**
- Calcular `auditarSimulacion(input)` ya se hace dentro de `AuditPanel`. Sacar el cálculo al simulador (o levantar el resultado vía callback) y pasarlo + `metricasAutonomia.nivelAutonomia` al `SaveExpedienteButton`.

**`src/lib/validacionQA.ts`**
- Extraer la lógica de snapshot de `aprobarQA` a `snapshotPropuestaAprobada(expedienteId, validacionId | null)` reutilizable.
- `aprobarQA` sigue llamándolo internamente (sin cambios funcionales para el flujo manual de QA).

### 2. Texto de "Siguiente acción" sin forzar auditoría

**`src/lib/expedienteGuiado.ts`** — caso `etapa === "lead" || etapa === "proyeccion"`:
- Cambiar a:
  - título: "Avanza con la proyección financiera"
  - descripción: "Completa la simulación. Si NUVIA la aprueba, pasa directo a Contratación; solo se enruta a auditoría QA si NUVIA detecta inconsistencias."

### 3. Validación de datos — quitar el candado en "Qué falta"

**`src/lib/expedienteGuiado.ts`** — `getBloqueos`, etapa `documentacion_bancaria | radicacion`:
- Quitar la línea `"Validación de identidad firmada" → juridica`. El analista ya validó al confirmar la cédula (flujo anterior ya hace `validacion_estado = datos_validados` directamente).

### 4. Sin cambios

- Motor de auditoría (`auditEngine.ts`) y reglas de autonomía (`autonomia.ts`): intactos.
- `aprobarQA` / `devolverQA` manuales: intactos para casos que sí llegan a QA.
- Permisos / RLS / Stepper / Torre de Control: sin cambios — los estados (`proyeccion_aprobada_qa`, etc.) siguen siendo los mismos, solo cambia quién/cómo se llega a ellos.
- Componente `ValidacionIdentidadBlock`: ya está en su forma "Enviar a Contratación" desde la iteración previa; no se toca.

---

## Resultado esperado para el caso de ANDRES FELIPE MARTINEZ

1. Analista termina la simulación → motor NUVIA marca **Apto** (score ≥ umbral del nivel, sin críticas).
2. Click en "Crear y enviar a Contratación" → caso pasa a `proyeccion_aprobada_qa` automáticamente, con `aprobado_data` congelado.
3. "Tu siguiente acción" desaparece la mención a auditoría; Contratación ve el caso listo con cédula + extracto adjuntos.
4. Si en otro caso el motor encuentra una crítica (cuota mal, fresh mal, etc.), entonces sí va a QA — el control queda como red de seguridad, no como peaje.

¿Apruebas que ejecute estos cambios?
