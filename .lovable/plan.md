## Objetivo

Agregar soporte para **Leasing Habitacional en pesos con opción de compra** dentro del simulador en pesos actual, conservando 100% intacta la lógica de crédito hipotecario. Un solo simulador, dos motores matemáticos según el tipo de producto.

## Alcance (qué SÍ / qué NO)

**SÍ:**
- Selector "Tipo de producto" (Crédito hipotecario | Leasing habitacional) en el simulador en pesos.
- Nuevo motor `proyectarLeasing` con Sistema Francés + valor residual (opción de compra).
- Campos adicionales visibles solo en modo leasing: número de leasing, valor del leasing, canon actual, valor opción de compra, sistema de amortización, fecha de corte, cánones pagados/pendientes.
- Extracción automática desde extracto PDF (Banco de Bogotá primero, arquitectura extensible).
- Escenarios de optimización con canon extra (50k / 100k / 150k / 200k / manual).
- Switch "¿Incluir opción de compra en la proyección de pago final?" (no / sí).
- Alertas QA específicas de leasing.
- Persistencia (`expediente_maestro`, `proyecciones_financieras`) con flag `tipo_producto` y `valor_residual`.

**NO:**
- No se toca la ruta ni el motor UVR.
- No se modifica ningún cálculo actual de hipotecario en pesos (`proyectarPesos` queda igual).
- No se rediseña la UI: se reutiliza estilo NUVIA existente (NCard, tone dark según memoria).
- No se crea página nueva; todo vive dentro de `PesosSimulator.tsx`.

## Cambios técnicos

### 1. Motor matemático — `src/lib/proyeccion.ts`
Se agrega, sin modificar `proyectarPesos`:

```ts
export interface LeasingInput extends ProyeccionInputBase {
  valorResidual: number;              // opción de compra
  incluirOpcionCompra: boolean;       // switch UI
  sistemaAmortizacion?: "frances" | "aleman" | "cuota_fija";
}

export function proyectarLeasing(input: LeasingInput): ProyeccionResultado & {
  valorResidual: number;
  saldoFinalConvergeAlResidual: boolean;
};
```

Fórmula del canon financiero (Francés con FV):
```
PMT = (PV − FV / (1+i)^n) · i / (1 − (1+i)^-n)
```
- Cada mes: interés = saldo·i; capital = PMT − interés; saldoFinal = saldo − capital.
- Se detiene cuando `saldo ≤ valorResidual + tolerancia` (no llega a 0).
- Si `incluirOpcionCompra=true`, agrega una cuota final = valorResidual y saldo llega a 0.

### 2. Persistencia
Migración: agregar a `expediente_maestro` y `proyecciones_financieras`
- `tipo_producto text default 'hipotecario'` (`'hipotecario' | 'leasing_habitacional'`)
- `valor_residual numeric`
- `incluir_opcion_compra boolean default false`
- `sistema_amortizacion text`

RLS existente se preserva (columnas nuevas heredan policies).

### 3. UI — `PesosSimulator.tsx`
- Nuevo `ModalidadProducto` (radio o segment) arriba del bloque "Datos del crédito".
- Cuando es leasing: renombrar labels ("Cuota" → "Canon", "Cuotas pendientes" → "Cánones pendientes"), mostrar campos "Valor opción de compra", "Sistema de amortización", "Fecha de corte".
- Switch avanzado dentro del bloque de optimización.
- Botones de canon extra: 50k / 100k / 150k / 200k / manual (reutiliza el patrón actual de "aporte extra").
- KPIs adicionales: valor residual, opción de compra, costo total, intereses totales, veces pagado.

### 4. Parser de extractos — `src/lib/motorExtractos/`
- Nuevo `bancoBogotaLeasingParser.ts` (basado en el hipotecario existente) que detecta encabezado "LEASING HABITACIONAL" y extrae: valor del leasing, plazo inicial, cánones pagados/pendientes, canon actual, seguros, TEA, valor opción de compra, sistema, fecha de corte.
- Registrar en `bankProfiles.ts` como producto adicional del Banco de Bogotá.

### 5. QA — extensión de `simuladorAutoQA.ts`
Nuevas reglas activas solo cuando `tipo_producto === 'leasing_habitacional'`:
- Canon banco vs canon reconstruido (Δ > 1%).
- Saldo final no converge al residual (Δ > 0.5%).
- Opción de compra fuera del rango esperado (7–15% del valor del leasing) — alerta soft.
- Capital 0 en cuota donde debería existir amortización.
- TEA pactada vs cobrada.
- Seguros mezclados en canon financiero.

## Diseño

- Mismo estilo NUVIA (dark tokens, NCard, NSelect según memoria).
- Los nuevos campos aparecen inline en los bloques existentes; no se crean pestañas ni pantallas nuevas.
- Copys en español consistentes con el resto ("Canon", "Opción de compra", "Valor residual").

## Entregables

1. Motor `proyectarLeasing` + tests unitarios rápidos (script node en /tmp para validar contra el ejemplo Banco de Bogotá: PV=325.990.284, residual=32.599.028, n=224, TEA=10.29%, seguros=82.802).
2. Migración de columnas nuevas + regeneración de tipos.
3. `PesosSimulator.tsx` con selector, campos condicionales, KPIs, escenarios y switch.
4. Parser leasing Banco de Bogotá + registro en `bankProfiles`.
5. Reglas QA leasing.
6. Verificación: cargar el ejemplo del Banco de Bogotá, comprobar que el canon reconstruido ≈ 3.150.355 y saldo final ≈ 32.599.028.

## Confirmaciones antes de implementar

1. ¿La opción de compra debe quedar registrada como **saldo residual proyectado** dentro de `proyecciones_financieras` o como campo separado en `expediente_maestro` (o ambos)?
2. Para el parser: además de Banco de Bogotá, ¿hay otros bancos con leasing habitacional que quieras dejar preparados en este mismo cambio (Davivienda, Bancolombia), o los agregamos después?
3. ¿El módulo de **honorarios** debe reconocer leasing habitacional como producto y calcular sobre "cánones eliminados + intereses evitados", o mantiene la lógica actual sin cambios en esta iteración?
