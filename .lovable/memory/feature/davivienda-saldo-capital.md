---
name: Davivienda — Saldo a capital por producto
description: Reglas de extracción del saldo a capital en extractos Davivienda Leasing Habitacional y Crédito Hipotecario (UVR y PESOS)
type: feature
---

Davivienda imprime el **saldo a capital** con layouts distintos según producto y moneda. Los parsers en `src/lib/motorExtractos/davivienda{Leasing,Hipotecario}Parser.ts` DEBEN respetar estas reglas — no unificarlas en un solo regex.

| Producto | Moneda | Línea de la que sale el saldo a capital |
|---|---|---|
| Leasing Habitacional | UVR | `Saldo a la Fecha de Corte: <fecha> <UVR> $ <pesos>` |
| Leasing Habitacional | PESOS | `Saldo a: <fecha> $ <pesos>` (bloque "Nuevo Saldo de su Contrato de Leasing") |
| Crédito Hipotecario | UVR | `Saldo a la Fecha de Corte: <fecha> <UVR> $ <pesos>` |
| Crédito Hipotecario | PESOS | `Saldo a la Fecha de Corte: <fecha> $ <pesos>` (sin columna UVR) |

⚠️ **Trampa crítica:** en **Leasing PESOS** la línea `Saldo a la Fecha de Corte` corresponde a la **Opción de Compra**, NO al capital. Nunca usar esa línea para saldo en leasing pesos — usar `Saldo a:`. En hipotecario pesos sí es el capital.

Seguros: usar `moneyFromLine` que toma el ÚLTIMO `$` de la línea (Davivienda pone la etiqueta a la derecha del valor en algunos layouts tabulares). El primer `$` suele ser otro concepto contaminante.
