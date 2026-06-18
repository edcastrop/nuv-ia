---
name: Bancolombia UVR saldo/valor
description: Bancolombia hipotecario UVR debe extraer saldoUVR y valorUVR; nunca dejarlos vacíos en moneda=UVR
type: feature
---
En extractos Bancolombia "Crédito Hipotecario en UVR" SIEMPRE se deben extraer:
- saldoUVR ← "Saldo UVR" / "Saldo en UVR" / "Saldo de capital en UVR" (4 decimales).
- valorUVR ← "Valor UVR del día" / "Valor de la UVR" / "Valor UVR a la fecha" (4 decimales).

Validación: saldoUVR × valorUVR ≈ saldoCapital pesos (±1%).

Si falta uno, derivar saldoUVR = saldoPesos / valorUVR (4 decimales) y marcar
`requiereVerificacionBeneficio` con error en `bancolombiaParser.ts`.

El profile en `bankProfiles.ts` declara este bloque "UVR (CRÍTICO — OBLIGATORIO)"
para que el extracto reader AI también los devuelva cuando el parser determinista no aplique.
