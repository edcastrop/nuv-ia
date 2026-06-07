# Reestructuración Simulador NUVEX ↔ Expediente

## Principio
El **Simulador** es una herramienta rápida: leer extracto → simular → auditar → generar propuesta → enviar al expediente. Termina ahí.
Todo lo bancario, contractual, de cobro y cierre vive en el **Expediente**.

## 1. Simulador NUVEX (limpiar)

Reescribir `PesosSimulator.tsx` y `UVRSimulator.tsx` para que sólo contengan estas 6 etapas, en este orden:

```text
1. Datos del cliente      → ClientFields + CedulaReader
2. Datos del crédito      → SituacionActualBlock (banco, producto, saldo, cuota, seguros, TEA, plazo, pagadas, pendientes) + ExtractoReader
3. Beneficio Fresh        → FreshBlock (sólo si aplica)
4. Simulación             → PropuestasComerciales (crear/eliminar/editar/recomendada)
5. Auditoría NUVEX        → AuditPanel (score, semáforo, alertas, nivel autonomía, riesgos)
6. Generación de propuesta → Exportar PDF + Enviar propuesta al cliente + Crear / abrir expediente
```

Eliminar del render de ambos simuladores (los archivos pueden permanecer en disco, sólo se quitan los imports/usos):
- `ResultadoFinal`, `PazYSalvo`, `ComparativeTable`, `RecommendedResult` (queda recomendada como flag dentro de PropuestasComerciales), `DiscountModule`, `ProyeccionDetallada` cuando represente resultado bancario, bloques de honorarios recalculados, cuenta de cobro, otrosí, informe final, indicadores de precisión vs banco.

No se borran archivos legacy en este paso para evitar romper otras rutas que los importen (cartera, expediente). Sólo se desconectan del simulador.

## 2. Nuevo módulo Expediente: "Resultado Bancario"

Crear `src/components/expediente/ResultadoBancarioBlock.tsx` que reemplaza/extiende el actual `RespuestaBancoBlock` con UX completa de la nueva Etapa 9:

Campos:
- Fecha aprobación, Número de radicado, Banco, Nueva cuota aprobada, Nuevo plazo aprobado, Observaciones.
- Adjuntos: carta del banco, correo del banco, soportes de aprobación (reutiliza `expediente_soportes`).

Acciones automáticas al guardar:
- **Comparativo NUVEX vs Banco** (cuota, plazo, cuotas eliminadas, ahorro) usando `propuesta_data` recomendada del expediente.
- **Precisión histórica** (cuota, plazo, ahorro) → persistir en `analista_metricas` (precision_cuota, precision_plazo, precision_ahorro) para alimentar perfil de riesgo, licencia de autonomía y dashboard gerencial.
- **Reajuste honorarios** automático con `calcularRecalculoHonorarios` + `guardarRecalculoHonorarios` (ya existe).
- **Generación automática de Otrosí** cuando aprobado ≠ presentado: nuevo helper `src/lib/otrosiContrato.ts` que produce el DOCX/PDF mostrando condiciones presentadas, aprobadas y honorarios recalculados.

Vivirá en `src/routes/_authenticated/casos.$id.tsx` como bloque de la Etapa 9.

## 3. Pipeline: ampliar a 15 etapas

Actualizar `src/lib/pipelineEtapas.ts`:

```text
 9. Resultado Bancario   (director_financiero, apoderado)
10. Aceptación Cliente   (asesor / AFC) — obligatorio
11. Informe Final        (director_financiero, apoderado, auto)
12. Facturación          (contabilidad)
13. Pago Honorarios      (contabilidad)
14. Paz y Salvo          (contabilidad, auto)
15. Caso Cerrado         (gerencia)
```

Reasignar `CASO_ESTADO_A_ETAPA` para usar los nuevos ids. Mantener compatibilidad con estados existentes mapeándolos a la etapa correspondiente.

Crear bloques mínimos para etapas 10–15 dentro de `casos.$id.tsx`:
- Etapa 10: `AceptacionClienteBlock` (fecha, medio, observaciones, adjuntos WA/correo/carta).
- Etapas 11–14: tarjetas con CTA y estado; reutilizan helpers existentes (`cuentaCobroPdf`, `PazYSalvo`, etc.) movidos desde simulador.
- Etapa 15: panel "Caso cerrado" con indicadores finales (ahorro, honorarios, precisión, tiempo total).

## 4. Datos / backend

Migración nueva:
- `analista_metricas`: añadir `precision_cuota numeric`, `precision_plazo numeric`, `precision_ahorro numeric` (default 0).
- `expedientes`: añadir `aceptacion_cliente_at timestamptz`, `aceptacion_medio text`, `aceptacion_observaciones text` (sólo si no existen).
- Nuevo enum/valores `caso_estado`: `resultado_banco_registrado`, `aceptacion_cliente_recibida`, `caso_cerrado` (si faltan). GRANTs ya existentes.

## 5. Navegación / UX

- En el simulador, el botón final "Crear expediente" sigue funcionando vía `SaveExpedienteButton`, pero el copy cambia a "Enviar al expediente".
- En el expediente (`casos.$id`), nuevo timeline 1–15 con bloques colapsables; la Etapa 9 (Resultado Bancario) es la entrada principal del Director Financiero / Apoderado.
- Notificaciones automáticas al AFC cuando: banco responde, condiciones difieren, otrosí generado, informe enviado, cuenta de cobro emitida, pago registrado, paz y salvo emitido (reutilizar `notificaciones.ts`).

## Detalles técnicos

- No tocar `src/integrations/supabase/client.ts` ni `types.ts` manualmente — la migración regenera `types.ts`.
- Mantener `auditEngine.ts` y `autonomia.ts` intactos.
- `precision_*` se calcula como `1 - |nuvex-banco|/banco` clamp [0,1].
- Otrosí: generar con `docx` (ya usado en `solicitudCambioPlazosDocx.ts`).
- Mantener archivos legacy (`ResultadoFinal.tsx`, `PazYSalvo.tsx`, etc.) por ahora; sólo desconectarlos del simulador.

## Alcance fuera de este plan
- Rediseño visual profundo del expediente (mantenemos look actual).
- Borrado físico de componentes legacy (se hará en una pasada posterior una vez se confirme que el expediente cubre todo).
