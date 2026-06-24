---
name: BdB cuotaConInteresSinSeguros vs INTERESES CORRIENTES
description: Trampa del parser BdB hipotecario con FRECH — INTERESES CORRIENTES es bruto antes del subsidio
type: feature
---
En el extracto del Banco de Bogotá hipotecario (plantilla "Extracto Crédito de Vivienda",
encabezado "Nro. ...CH..."):

- La fila "+ INTERESES CORRIENTES" es el interés BRUTO antes de aplicar el FRECH.
- "= VALOR TOTAL" es la cuota SIN subsidio CON seguros (cuotaSinSubsidio).
- "- VALOR BENEFICIO" es el FRECH mensual (valorBeneficioMensual).
- "= TOTAL A PAGAR" es la cuota CON subsidio que paga hoy el cliente (cuotaConSubsidio).
- En seguros, sumar vida + incendio/terremoto + seguro(s) voluntario(s) cuando la fila exista; caso real 16.748,52 + 19.206,82 + 40.570,69 = 76.526,03.

**Regla** para alimentar `cuotaConInteresSinSeguros` (campo que NUVIA suma con beneficio + seguros
para reconstruir la cuota base de simulación):

cuotaConInteresSinSeguros = cuotaConSubsidio − seguros = TOTAL A PAGAR − seguros

**Nunca** usar INTERESES CORRIENTES como cuotaConInteresSinSeguros: al sumarle de nuevo el
beneficio en `cuotaBase.ts` se DUPLICA el FRECH y la cuota base sale inflada por exactamente
el valor del subsidio (caso real: 1.634.671 + 494.319 + 71.272 = 2.200.263, cuando la base
correcta es 1.705.943).

Validación obligatoria del parser:
- cuotaConSubsidio + valorBeneficioMensual ≈ cuotaSinSubsidio
- cuotaConInteresSinSeguros + valorBeneficioMensual + seguros ≈ cuotaSinSubsidio

cuotaActual = "= VALOR TOTAL" (cuota sin subsidio con seguros). saldoCapital = "SALDO TOTAL A
LA FECHA DE CORTE" (no el "DESPUÉS DE EFECTUAR ESTE PAGO"). tasaEA = "TASA COBRADA E.A."
(8.37 en el caso), no "TASA PACTADA E.A." (12.68 contractual sin subsidio).

Campos críticos de la tabla "DATOS GENERALES DEL CRÉDITO":
- "MONTO APROBADO" → valorDesembolsado.
- "PLAZO INICAL/INICIAL" → plazoInicial.
- "CUOTA A PAGAR" → cuotasPagadas / cuotaActualNumero (número de cuota facturada, no monto).
- "CUOTAS PENDIENTES" → cuotasPendientes literal del extracto; para Banco de Bogotá no recalcular como plazoInicial - cuotasPagadas, porque en casos reales 240, 27 y 214 cuadran con tolerancia por calendario bancario.
- En OCR, la fila de tasas puede salir como `14 16 8 76 5.00...`; debe reconstruirse como tasa pactada 14.16, tasa cobrada 8.76 y tasa cobertura 5.00.
