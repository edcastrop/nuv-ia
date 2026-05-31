# Auditoría Maestra NUVEX + Pipeline Operativo + E2E

Lo que pides es **enorme** (rediseño del módulo central + renombrado global de rol + auditoría E2E con casos simulados). Hacerlo en un solo turno garantiza romper cosas que hoy funcionan y consumir muchos créditos. Lo divido en fases cortas, **cada una aprobable por separado**, antes de tocar código.

---

## Fase R — Renombrado del rol `licenciado` → `Analista Financiero Comercial` (AFC)

**Decisión clave que necesito de ti antes de tocar BD:**

- **Opción A (recomendada, segura):** mantener `app_role.licenciado` en la base de datos (no toco enum, RLS, triggers, comisiones, ni `academia_rol_del_usuario`). Cambio **solo etiquetas visibles**: menús, sidebar, dashboard, directorio, academia, comisiones, reportes, casos, expedientes, notificaciones, colaboración, DM.
- **Opción B (riesgosa):** renombrar el valor del enum a `analista_financiero_comercial`. Requiere migración de enum + reescribir ~25 funciones SECURITY DEFINER (`has_role`, `auto_liquidar_comision`, `academia_rol_del_usuario`, `can_use_*`, etc.), políticas RLS y todos los `.from("user_roles").eq("role","licenciado")` del frontend. Alto riesgo de romper comisiones y RLS.

**Mi recomendación:** Opción A. "Licenciado" desaparece de la UI; en BD sigue siendo `licenciado` (invisible para el usuario final).

Entregable: una sola PR de strings + helper `roleLabel(role)` centralizado en `src/lib/roleLabels.ts`. Sin migración.

---

## Fase P — Rediseño Expediente → **Pipeline Maestro NUVEX** (14 etapas)

El expediente actual es un editor largo (`MaestroEditor.tsx`). Lo convierto en un **pipeline visual con 14 etapas** sin tirar lo existente: cada etapa muestra el subcomponente actual (proyección, contratación, validación QA, etc.) ya construido.

Sub-lotes (uno por turno):

| Sub-lote | Alcance | BD nueva |
|---|---|---|
| **P1** | Shell del Pipeline: stepper 14 etapas + estado calculado + guardas por rol | columna `etapa_pipeline` (computada o materializada) |
| **P2** | Etapas 1–3 (Lead, Extracto, Proyección) — atar a componentes existentes | reusar `proyeccion_financiera`, `extractos_ocr` |
| **P3** | Etapa 3 + QA: regla "no se presenta sin QA aprobado" | flag `proyeccion_qa_estado` (ya existe `validaciones_qa`) |
| **P4** | Etapas 4–7 (Presentación, Cierre, Contratación, Radicación) | estados nuevos en `expedientes.estado_caso` |
| **P5** | Etapa 8 + **flujo Banco → Jurídica → Dirección Fra → AFC** (bloquea comunicación directa al cliente) | tabla `respuesta_banco_validaciones` |
| **P6** | **Recálculo automático** de honorarios cuando cuotas aprobadas ≠ contratadas (ya existe `aplicar_recalculo_honorarios`, lo extiendo) | extender trigger |
| **P7** | **Otrosí automático** + **aceptación obligatoria del cliente** + bloqueo de cuenta de cobro/paz y salvo/comisión hasta evidencia cargada | nueva tabla `otrosi_aceptaciones` (estado, evidencia, fecha) + columna bloqueo en `expedientes` |
| **P8** | Etapas 9–13 (Informe Final, Cuenta de Cobro, Pago, Comisión, Paz y Salvo) — atar a flujos existentes + notificaciones cruzadas al AFC | sin BD nueva (ya existe) |
| **P9** | Etapa 14 (Caso Finalizado) con métricas: tiempo total, ahorro, honorarios cobrados, comisión pagada | view `vw_caso_resumen_final` |

---

## Fase A — Auditoría E2E con caso simulado

Antes de "marcar como finalizado":

1. **A1** — Script de seed (`/mnt/documents/seed-caso-prueba.sql` via insert tool): crea 1 caso ficticio (cliente "DEMO QA", banco Bancolombia, extracto fake), 1 usuario por rol si no existen.
2. **A2** — Recorrer el pipeline rol por rol y dejar un **checklist marcado** (no inventado). Por cada paso: rol, ruta visitada, acción, resultado, evidencia (capturas en `/mnt/documents/e2e/`).
3. **A3** — Auditoría transversal: LOGIN, perfil, notificaciones, DM, colaboración, academia, NUVEX IA, bloqueo por URL (esto ya quedó parcialmente cubierto en lotes A–F de la auditoría anterior; solo re-verifico).
4. **A4** — Reporte final `/mnt/documents/auditoria-nuvex-pipeline-e2e.md` con: errores encontrados, correcciones, pruebas ejecutadas, resultado por rol.

---

## Lo que **no** voy a hacer en este plan (para evitar romper cosas)

- No reescribir lógica financiera, OCR, cálculos de UVR, simuladores, PDFs jurídicos.
- No tocar el enum `app_role` (a menos que elijas Opción B en Fase R).
- No "validar todo en un solo turno". Cada sub-lote se entrega y aprueba.

---

## Lo que necesito de ti antes de tocar código

1. **¿Opción A o B en Fase R?** (recomendado A).
2. **¿Empiezo por R (renombrado, bajo riesgo, ~1 turno) o por P1 (shell del Pipeline, define la columna vertebral)?**
3. **¿Tengo permiso para crear el caso DEMO QA en producción de Cloud para la Fase A**, o lo dejas tú con datos reales no destructivos?

Una vez confirmes (1)(2)(3), arranco con el primer sub-lote y nada más. Cada turno = un sub-lote + validación.