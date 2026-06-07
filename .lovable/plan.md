# NUVEX Financial Audit Engine™ + Licencia de Autonomía

Este es un módulo grande (6 fases de auditoría + sistema de autonomía con 3 niveles + tablero gerencial + aprendizaje histórico). Para entregarlo bien necesito construirlo por etapas, validando cada una antes de pasar a la siguiente. Te propongo el siguiente plan.

---

## Arquitectura general

**Nuevos archivos clave**
- `src/lib/auditEngine.ts` — motor puro de validación (sin UI). Funciones: `validarExtractoVsAnalista`, `validarConsistenciaMatematica`, `validarPropuesta`, `calcularConfidenceScore`, `clasificarRiesgo`.
- `src/lib/autonomia.ts` — cálculo de nivel (1/2/3) por analista según métricas históricas.
- `src/components/nuvex/AuditBadge.tsx` — semáforo 🟢🟡🔴 + score + tooltip con detalle.
- `src/components/nuvex/AuditPanel.tsx` — panel desplegable con la tabla "Campo · Extracto · Analista · Resultado" y lista de inconsistencias.
- `src/routes/_authenticated/auditoria-financiera.tsx` — tablero gerencial (ranking, niveles de autonomía, precisión).

**Nuevas tablas (Lovable Cloud)**
- `audit_simulaciones` — snapshot de cada simulación: datos extracto, datos analista, score, nivel riesgo, decisión (apto/revisar/escalar).
- `audit_respuestas_banco` — cuota/plazo/cuotas aprobadas por el banco vs propuestas → precisión.
- `analista_metricas` (vista materializada o tabla calculada) — score promedio, simulaciones, precisión, nivel de autonomía vigente.
- `audit_alertas` — cambios de nivel, escalamientos, devoluciones.

Todas con RLS: analista ve lo suyo, gerencia/director_financiero_qa/super_admin ven todo.

**Integraciones existentes a tocar**
- `PesosSimulator.tsx` / `UVRSimulator.tsx` → ejecutan auditoría tras cargar extracto y antes de "Exportar propuesta comercial".
- `PropuestasComerciales.tsx` → muestran badge de score por escenario; bloquean PDF si score < umbral según nivel de autonomía del usuario.
- `useUserRole.ts` → añadir `nivelAutonomia` derivado de `analista_metricas`.

---

## Entregables por fase

### Etapa A — Fundación de datos (1 migración)
- Crear las 4 tablas + GRANTs + RLS + policies.
- Función `public.calcular_metricas_analista(user_id)` y vista `v_ranking_analistas`.
- Sin UI todavía.

### Etapa B — Motor de auditoría (puro, sin UI)
- `auditEngine.ts` con todas las reglas de Fase 1, 2, 3, 5.
- Tests rápidos de fórmulas (cuotas pagadas+pendientes=plazo, seguros<cuota, ahorro>0, etc.).
- `calcularConfidenceScore` con la distribución 40/30/20/10 que pediste.

### Etapa C — Integración en Simuladores (Fase 1, 2, 3, 5)
- Tras OCR/lector IA: comparar extracto vs digitado → tabla de diferencias.
- Validaciones matemáticas en vivo.
- `AuditBadge` visible en la cabecera de cada simulación.
- Bloqueo de "Exportar propuesta comercial" si score < umbral.

### Etapa D — Casos de alto riesgo (Fase 4)
- Clasificador: UVR complejo, diff>3%, fresh inconsistente, tasa atípica, score<85.
- Marca "REQUIERE REVISIÓN DIRECCIÓN FINANCIERA" y bloquea presentación al cliente.
- Notificación al director financiero (usa `notificaciones_usuario` existente).

### Etapa E — Aprendizaje histórico (Fase 6)
- Formulario en el expediente para registrar respuesta del banco (cuota/plazo/cuotas aprobadas).
- Cálculo de precisión por analista/banco/producto/tipo de crédito.

### Etapa F — Licencia de Autonomía
- Cálculo de nivel 1/2/3 según reglas exactas que diste.
- Badge en perfil del analista.
- Reglas de bloqueo según nivel + score de la simulación.
- Recalc automático nocturno (cron job en `/api/public/hooks/`).
- Alertas de subida/bajada de nivel.

### Etapa G — Tablero gerencial
- Nueva ruta `auditoria-financiera`.
- Ranking nacional, niveles, score promedio, precisión, % devoluciones, % aprobación bancaria.
- Filtros por banco, producto, periodo.

---

## Lo que NO se va a romper

- Cálculos financieros existentes (`finance.ts`, `proyeccionFinanciera.ts`) — no se tocan.
- PDFs comerciales — solo se les añade un gate (no se modifica el contenido).
- Honorarios, simulador Pesos, simulador UVR, propuesta recomendada — intactos.

---

## Pregunta antes de empezar

Este alcance es de varios días de trabajo. **¿Quieres que arranque por la Etapa A + B + C (lo que ya impacta al analista en pantalla) y dejamos D-G para iteraciones siguientes, o prefieres otro orden?**

También necesito confirmar dos cosas operativas:
1. ¿El umbral para bloquear PDF en Nivel 1 es score < 95, en Nivel 2 < 95, en Nivel 3 sin bloqueo salvo UVR/alto riesgo? (Es lo que infiero del brief.)
2. ¿La "respuesta del banco" la registra el mismo analista en el expediente, o el director financiero?
