# Auditoría y corrección global PDF NUVEX

**Principio**: NO rediseñar. Solo corregir datos, validar y ajustar jerarquía visual.

## 1. Fuente única de datos (refactor previo)

Crear `src/lib/pdfDataSource.ts`:
- `buildPdfContext(expedienteId)`: única función que lee del **Expediente Maestro** (`expediente_maestro` + `expedienteToMaestroLike` cuando el caso aún no tiene maestro vinculado) y arma un objeto normalizado consumido por los 6 PDFs:
  ```
  { cliente, cotitular, credito, cobertura, honorarios, titular, apoderado, fechas }
  ```
- Cada generador (Paz y Salvo, Cuenta de Cobro, Resultado Final, Propuesta, Poder, Datos Contrato) recibirá `PdfContext` en vez de leer campos sueltos.

## 2. Validador global

`src/lib/pdfValidator.ts` (extender):
- `validatePdfContext(ctx, requiredFields[])`: retorna `{ ok, missing[], inconsistencies[] }`.
- Verifica obligatorios: nombre, cédula, banco, número crédito, producto, cobertura, honorarios, titular, apoderado.
- Verifica consistencia matemática (ver §5).
- Si falla → `toast.error` con campos faltantes y **bloquear export**.
- Wrap en `exportPdfSafely`.

## 3. Paz y Salvo
- Reemplazar cédula hardcodeada por `ctx.cliente.cedula` (auditar línea por línea).
- Eliminar cualquier literal de cédula/nombre.
- Compactar a **1 página**: reducir paddings, fusionar bloques de firma y declaración, eliminar separadores redundantes.

## 4. Cuenta de Cobro
- Si `ctx.titular` no existe (titular === cliente o vacío) → ocultar bloque Titular completo (no renderizar "CC —" ni "Titular —").
- Si `ctx.cobertura.tasa` no existe → mostrar **"No aplica"** (nunca "—").
- Logo NUVEX: aumentar **2.5×** (de 64px a 160px en header).

## 5. Datos para Contrato
- Validar fórmula:
  ```
  cuotaSinCobertura + valorCobertura === cuotaConCobertura  (tolerancia ±1 COP)
  ```
- Si falla → mostrar error en UI y **no generar PDF**.
- Aplicar `PdfBrandHeader variant="operational"` (mismo chrome corporativo NUVEX).

## 6. Resultado Final
- Mantener diseño actual.
- Ribbon **ANTES → DESPUÉS**: aumentar tipografía y padding **+35%**.
- **Ahorro Total**: convertir en hero visual #1 (tamaño +60%, color verde NUVEX, peso 900, separador superior/inferior).
- Logo NUVEX header: 2.5×.

## 7. Poder Especial
- Header NUVEX (logo grande) arriba del texto jurídico.
- Bloque metadata: `Código interno | Fecha generación | Consecutivo NUVEX-PE-YYYY-NNNN`.
- Conservar todo el texto jurídico actual sin cambios.
- Consecutivo: nueva columna `consecutivo` en `expedientes.aprobado_data` o derivado de `created_at` + secuencial.

## 8. Propuesta Financiera
- Misma migración a `PdfContext`.
- Sin cambios visuales (ya está actualizada).

## 9. Validación final pre-export
`exportPdfSafely` ya valida overflow/logo. Añadir:
- Verificar márgenes (top/bottom > 30px).
- Verificar logo cargado (`img.complete && naturalWidth > 0`).
- Verificar saltos de página (no cortar `.pdf-block`).
- Si falla → toast con mensaje específico.

## Diagrama de flujo

```text
[Botón Generar PDF]
        │
        ▼
buildPdfContext(expId) ──► lee SOLO Expediente Maestro
        │
        ▼
validatePdfContext(ctx, required)
        │
   ┌────┴────┐
  fail       ok
   │          │
   ▼          ▼
toast    render PDF (diseño actual)
bloquea       │
              ▼
       exportPdfSafely
              │
        validación visual
              │
              ▼
           descarga
```

## Orden de ejecución
1. `pdfDataSource.ts` + `pdfValidator.ts` (base)
2. Paz y Salvo (cédula + 1 página)
3. Cuenta de Cobro (titular condicional + logo 2.5×)
4. Datos Contrato (fórmula + header NUVEX)
5. Resultado Final (jerarquía ahorro + ANTES/DESPUÉS +35%)
6. Poder Especial (header + consecutivo)
7. QA visual de los 6 PDFs

## Preguntas

1. **Consecutivo del Poder**: ¿formato `NUVEX-PE-2026-0001` (anual) o `NUVEX-PE-0001` (global)? ¿Persistir en BD o derivar de `created_at`?
2. **"Titular no existe" en Cuenta de Cobro**: ¿se refiere a cuando *no hay cotitular* (solo titular único), o a cuando el campo Titular del Maestro está vacío?
3. **Alcance**: ¿implemento los 7 pasos en este turno, o prefieres validar §1+§2 (base) antes de avanzar con los 6 documentos?
