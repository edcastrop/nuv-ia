# Ajustes: Intervinientes, Cobertura, Cuenta de Cobro y Tasa Cobrada

Cambios solo aditivos. No se tocan fórmulas financieras ni el diseño base.

## 1. Modelo de datos compartido

Crear `src/components/nuvex/intervinientes.ts`:
- Tipo `Interviniente { rol, nombreCompleto, cedula, lugarExpedicionCedula, direccion }`.
- Helpers: `isLeasing(producto)`, `rolTitular(producto)`, `rolCotitular(producto)` (devuelven "Titular"/"Cotitular" o "Locatario"/"Colocatario").
- `defaultIntervinientes()` con 1 titular vacío.
- Tipo `Cobertura { activo, valorCobertura, tasaCobertura }` + `tieneCobertura(producto)`.

## 2. Componente UI

Crear `src/components/nuvex/IntervinientesFields.tsx`:
- Sección "DATOS DE LOS INTERVINIENTES" (renombrada dinámicamente si es leasing).
- Bloque Titular/Locatario (siempre 1).
- Lista de cotitulares/colocatarios con botón "+ Agregar cotitular/colocatario" y botón eliminar por fila.
- Checkbox por cotitular "La dirección es la misma del titular" → copia dirección.
- Campos: Nombre, Cédula, Lugar de expedición, Dirección.

Crear `src/components/nuvex/CoberturaFields.tsx`:
- Mostrado solo si `tieneCobertura(producto)`.
- Campos opcionales: Valor de cobertura, Tasa de cobertura.

## 3. Simuladores (Pesos y UVR)

En `PesosSimulator.tsx` y `UVRSimulator.tsx`:
- Añadir state `intervinientes` y `cobertura`.
- Renderizar `<IntervinientesFields>` y `<CoberturaFields>` debajo de `ClientFields`.
- Hidratar desde `initialExpediente.cliente_data.intervinientes` y `.cobertura` al cargar.
- Incluir ambos en el payload guardado (cliente_data).
- Pasar a `PrintDocument` y `ResultadoFinal`.

## 4. Persistencia

Sin migración: ambos viven dentro de `cliente_data` jsonb (ya existente). `expedientes.ts` no requiere cambios de schema; solo asegurar que `cliente_data` se serializa tal cual.

## 5. PrintDocument (propuesta PDF)

Agregar sección "DATOS DE LOS INTERVINIENTES" con etiquetas dinámicas (Titular/Locatario, Cotitular/Colocatario) listando los campos. Si `cobertura.activo`, agregar bloque "BENEFICIO DE COBERTURA" con valor y tasa.

## 6. ResultadoFinal

Mostrar mismos bloques en la vista del resultado y en el certificado.

## 7. Cuenta de cobro

Buscar el componente/sección de cuenta de cobro (probablemente en `ResultadoFinal.tsx` o `PrintDocument.tsx`). Reemplazar el concepto por:

> "Servicio Tecnológico Financiero prestado por NUVEX Finanzas Inteligentes, asociado al análisis, proyección, gestión tecnológica y acompañamiento financiero del proceso de optimización del crédito hipotecario o leasing habitacional."

Título corto: "SERVICIO TECNOLÓGICO FINANCIERO".

## 8. Lectura de extractos — tasa cobrada vs pactada

En `src/lib/extracto.functions.ts`:
- Añadir al schema: `teaCobrada`, `teaPactada` (ambas con confianza).
- Mantener `tea` como tasa oficial pero asignarla solo si existe `teaCobrada`.
- Actualizar `SYSTEM_PROMPT`: "Identifica explícitamente 'tasa de interés cobrada' y 'tasa de interés pactada'. NUNCA uses la pactada como `tea`. Si solo aparece pactada, deja `tea` vacío."

En `ExtractoReader.tsx`:
- Mostrar ambas tasas detectadas y la tasa usada.
- Etiqueta: "Se usa la tasa de interés cobrada para la proyección."
- Si solo hay pactada: alerta "No se detectó tasa de interés cobrada. Verifique manualmente antes de simular." y no auto-llenar `tea`.

## 9. Detalles técnicos

- Persistencia: `cliente_data.intervinientes` y `cliente_data.cobertura` (jsonb existente, sin migración).
- Etiquetas dinámicas vía helper `rolTitular(producto)` reutilizado en todos los lugares.
- No cambiar fórmulas: cobertura es solo display+storage.
- Mantener compat hacia atrás: si `intervinientes` no existe en expedientes viejos, derivar uno desde `cliente.nombre`/`cliente.cedula`.

## Archivos a tocar

- Crear: `intervinientes.ts`, `IntervinientesFields.tsx`, `CoberturaFields.tsx`
- Editar: `PesosSimulator.tsx`, `UVRSimulator.tsx`, `PrintDocument.tsx`, `ResultadoFinal.tsx`, `extracto.functions.ts`, `ExtractoReader.tsx`
