# Integración de entrega documental por banco

Sub-flujo dentro de la etapa **Radicación** que aplica reglas diferentes según el banco del expediente, con días hábiles, gate duro en Bogotá y PDF consolidado imprimible.

## Matriz de reglas por banco

| Banco | Al radicar | Documentación financiera | Disparador |
|---|---|---|---|
| Davivienda | Solo poder | Por correo a Jurídica del banco | Inmediato (botón) |
| Banco de Bogotá | Poder + cédulas + checklist completo | Física, en el mismo acto | **Gate duro**: no permite radicar si falta algo |
| Davibank | Solo poder | Física | Tarea programada **T+4 días hábiles** |
| AV Villas | Solo poder | Física | Tarea programada **T+8 días hábiles** |

## Componentes a construir

### 1. Tabla `expediente_entrega_documental`
Sub-estado por expediente para la entrega de documentación financiera.
- `expediente_id`, `banco`, `modalidad` (correo | fisica), `estado` (pendiente | programada | enviada_correo | entregada_fisica), `fecha_programada` (hábil), `fecha_completada`, `notas`.
- RLS: asesor del caso + roles operativos. GRANT estándar.

### 2. Helper `src/lib/diasHabiles.ts`
- `sumarDiasHabiles(fecha, n)` — excluye sábado/domingo y festivos Colombia (lista estática de festivos 2026 ya cubre V1).

### 3. Reglas por banco `src/lib/reglasEntregaBanco.ts`
- `getReglaEntrega(banco)` → `{ modalidad, diasHabiles, requiereChecklistCompleto, requierePoderFirmado }`.

### 4. Gate Banco de Bogotá
Extender `src/lib/validacionRadicacion.ts`:
- Si `banco === "Banco de Bogotá"`, exigir checklist 100% completo antes de permitir `radicado_banco` (bloqueo, no warning).
- Mensaje claro listando lo que falta.

### 5. Trigger al marcar `radicado_banco`
En `src/hooks/useEstadoSugerido.ts` (post-confirmación), si la acción es radicación:
- Lee la regla del banco.
- Crea fila en `expediente_entrega_documental` con la fecha programada (T+N hábiles) o `pendiente` inmediato (Davivienda/Bogotá).
- Bogotá queda `entregada_fisica` automática (se entregó en el mismo acto).

### 6. Bloque UI `EntregaDocumentalBlock`
`src/components/expediente/EntregaDocumentalBlock.tsx` dentro de la pestaña de Radicación del caso. Muestra:
- Banco, modalidad y fecha programada/vencida (badge rojo si pasó).
- **Davivienda**: botón "Enviar documentación a Jurídica del banco" → abre modal que reutiliza `enviarSolicitudPlazoBanco` y adjunta poder + cédulas + financieros + cuerpo Ley 546.
- **Bogotá**: estado "Entregada con el poder" (auto).
- **Davibank / AV Villas**: contador "Faltan X días hábiles para entrega física" + botón "Generar paquete imprimible" + botón "Marcar entregada".

### 7. PDF consolidado imprimible
`src/lib/paqueteDocumentalPdf.ts` (cliente, usa `pdf-lib` que ya existe en proyecto):
- Carátula con datos del caso + banco + checklist de lo que va dentro.
- Concatena: poder, cédula apoderado, cédulas titular(es) y codeudor, documentos financieros del análisis de capacidad.
- Descarga `Paquete_<cliente>_<banco>.pdf`.

### 8. Alertas en pipeline
Insertar fila en `caso_alertas` cuando la fecha programada sea hoy o esté vencida (lo recoge `AlertasEstancamientoPanel` existente).

## Lo que NO cambia

- Estados oficiales del pipeline (`radicado_banco` sigue igual).
- Motor de capacidad de pago.
- Motor de envío de correo (solo se reutiliza desde el nuevo botón Davivienda).

## Orden de implementación

1. Migración tabla + RLS + GRANT.
2. Helpers (`diasHabiles`, `reglasEntregaBanco`).
3. Extender `validacionRadicacion.ts` con gate Bogotá.
4. Trigger en `useEstadoSugerido`.
5. Bloque UI + integración en pestaña Radicación.
6. PDF consolidado.
7. Notificación de vencimiento.

¿Procedo así o ajustamos algo antes de construir?
