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

cuotaActual = "= VALOR TOTAL" (cuota sin subsidio con seguros). saldoCapital = "SALDO
DE CAPITAL DESPUÉS DE EFECTUAR ESTE PAGO" (saldo real tras aplicar el pago; el "SALDO
TOTAL A LA FECHA DE CORTE" es PREVIO al pago y queda solo como fallback). tasaEA = "TASA
COBRADA E.A." (8.37 en el caso) para mostrar, pero `tea` de simulación usa "TASA PACTADA
E.A." cuando hay FRECH porque la cobrada ya está descontada y no reproduce la cuota base.
Seguros: sumar TODAS las filas mensuales de seguro: vida + incendio/terremoto + todos los
voluntarios/otros seguros/pólizas voluntarias. El parser debe tolerar OCR con puntos, comas,
espacios de miles, etiqueta en una línea y valor en la siguiente; un solo regex para
"VOLUNTARIO(S)" o tomar el primer valor deja casos en 35.955 cuando el voluntario real suma
40.570,69 y el total correcto auditado es 76.526,03.

Bug crítico ya identificado: aunque el parser calcule `seguros` completo, la normalización
posterior NO debe volver a pisarlo con `valorSeguroVida + valorSeguroIncendio + valorSeguroTerremoto`,
porque Banco de Bogotá no tiene un campo dedicado para voluntarios/otros seguros. Siempre preservar
el mayor entre el total agregado `seguros` y el subtotal detallado individual; si se pisa, la UI
muestra totales incompletos como 35.955/46.560 y descuadra la cuota.

Campos críticos de la tabla "DATOS GENERALES DEL CRÉDITO":
- "MONTO APROBADO" → valorDesembolsado.
- "PLAZO INICAL/INICIAL" → plazoInicial.
- "CUOTA A PAGAR" → cuotasPagadas / cuotaActualNumero (número de cuota facturada, no monto).
- "CUOTAS PENDIENTES" → cuotasPendientes literal del extracto; para Banco de Bogotá no recalcular como plazoInicial - cuotasPagadas, porque en casos reales 240, 27 y 214 cuadran con tolerancia por calendario bancario.
- En OCR, la fila de tasas puede salir como `14 16 8 76 5.00...`; debe reconstruirse como tasa pactada 14.16, tasa cobrada 8.76 y tasa cobertura 5.00.
