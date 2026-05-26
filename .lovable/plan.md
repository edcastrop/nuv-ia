# Arquitectura definitiva — NUVEX IA (cerebro único)

Un único backend `consultarIA()` alimenta ambas interfaces (página completa NUVEX IA y botón flotante NUVEX GPT). Se reutiliza lo existente y se elimina duplicación.

## 1. Base de datos (migración única)

**Tabla nueva `nuvex_kb`** (base de conocimiento con 30 categorías iniciales)
- `id, categoria, pregunta, respuesta, tags[], estado ('activo'|'borrador'|'archivado'), creado_por, created_at, updated_at`
- Índice de búsqueda en `pregunta + respuesta + tags` (trigram / ilike)
- RLS: lectura para `authenticated`; escritura solo `super_admin`/`admin`/`gerencia`
- Seed con las 30 categorías base (sin preguntas; el equipo las irá llenando desde super-admin)

**Tabla nueva `nuvex_ia_log`** (auditoría única para las 3 interfaces)
- `id, usuario_id, nombre_usuario, rol, modulo, pregunta, respuesta, origen ('nuvex_ia'|'nuvex_gpt'|'cliente'), fuente ('kb'|'modelo'), tiempo_respuesta_ms, created_at`
- RLS: el usuario ve solo sus logs; `super_admin`/`gerencia` ven todo

Las tablas existentes `gpt_kb_articulos`, `gpt_kb_categorias`, `gpt_consultas_log` se mantienen por compatibilidad pero **dejan de usarse** para nuevas consultas (se migran lecturas a `nuvex_kb`/`nuvex_ia_log`). No se borran para no romper la pantalla de super-admin actual.

## 2. Backend unificado (`consultarIA`)

Refactorizar `src/lib/nuvex-ia.functions.ts`:
- Mover toda la lógica de chat de `/api/nuvex-gpt-chat` a un único server function `consultarIA({ pregunta, modulo, origen, historial? })` con `requireSupabaseAuth`.
- Pipeline interno:
  1. Resolver `userId + roles + rol_principal` (RLS aplica automáticamente).
  2. **Paso KB**: buscar en `nuvex_kb` por keywords (ilike sobre `pregunta`/`tags`/`respuesta`) + boost por `modulo`. Si hay match fuerte (score ≥ umbral), devolver respuesta directa con `fuente='kb'` (cero tokens).
  3. **Paso modelo**: si no hay match, llamar a Lovable AI (`google/gemini-3-flash-preview`) con system prompt que incluye:
     - rol + módulo actual
     - KB relevante (top 6)
     - reglas de restricción por rol (un licenciado no ve cartera global, un apoderado no ve honorarios, etc.)
     - instrucción de devolver `__ESCALAR__` cuando no haya información suficiente
  4. Detectar `__ESCALAR__` → marcar respuesta como escalable y sugerir áreas (jurídica / operaciones / contabilidad / director QA / soporte).
  5. Registrar SIEMPRE en `nuvex_ia_log` (origen, fuente, tiempo).
- Mantener variante con streaming SSE para el botón flotante (server route `/api/nuvex-ia-stream` que internamente llama a la misma lógica de KB + prompt builder).

## 3. Restricción por rol (capa de seguridad)

Helper `filtrosPorRol(roles)` que devuelve qué entidades puede leer la IA:
- `super_admin`/`admin`/`gerencia` → todo
- `director_financiero_qa` → QA + financiero
- `contabilidad` → finanzas, comisiones, cartera
- `juridica`/`director_juridico` → casos jurídicos
- `operaciones`/`auxiliar_operativo` → casos operativos
- `licenciado` → solo sus casos / sus comisiones (RLS ya lo aplica)
- `apoderado` → **bloqueado en la interfaz flotante por ahora**; preparado pero deshabilitado

El system prompt incluye las restricciones explícitas + RLS de Supabase como red de seguridad.

## 4. Contexto por módulo

Reutilizar `modulosDesdePath()` existente de `src/lib/nuvex-gpt.ts` para mandar `modulo` al backend. El backend lo usa para:
- Ordenar la KB (boost por categoría que coincide con módulo).
- Inyectar en el system prompt: "El usuario está en el módulo X, prioriza respuestas relevantes a ese contexto."

## 5. Interfaces

### Página completa NUVEX IA (`/_authenticated/nuvex-ia`)
- Ya existe. Cambiar para llamar a `consultarIA({ origen: 'nuvex_ia' })`.
- Métricas y alertas se mantienen igual.

### Botón flotante NUVEX GPT (`NuvexGptPanel`)
- Ya existe. Cambiar `streamNuvexGpt` para apuntar a `/api/nuvex-ia-stream` con `origen: 'nuvex_gpt'`.
- Conserva diálogo de escalamiento (`EscalarTicketDialog`) ya implementado.

### Admin de KB (`/_authenticated/super-admin/nuvex-ia-kb`)
- Pantalla nueva mínima: tabla CRUD sobre `nuvex_kb` (categoría, pregunta, respuesta, tags, estado).
- Solo `super_admin`/`admin`/`gerencia`.
- Permite poblar la base de conocimiento sin tocar código.

### Cliente / Apoderado (Fase 9)
- **No se habilita** en este turno. La función `consultarIA` ya acepta `origen: 'cliente'` y el filtro por rol lo bloqueará; no se monta UI todavía.

## 6. Escalamiento

Cuando el backend devuelve `escalable: true`, ambas interfaces muestran el botón "Crear ticket" → usa el flujo existente `EscalarTicketDialog` (tabla `gpt_tickets_escalados` ya existe).

## 7. Archivos

**Migración** (única):
- `nuvex_kb` + `nuvex_ia_log` con grants, RLS, índices, seed de 30 categorías.

**Crear / editar**:
- editar `src/lib/nuvex-ia.functions.ts` → agregar `consultarIA` unificado + helper `buscarEnKB` + `filtrosPorRol`.
- crear `src/routes/api/nuvex-ia-stream.ts` → server route SSE que reutiliza la lógica.
- editar `src/lib/nuvex-gpt.ts` → cambiar URL a `/api/nuvex-ia-stream`.
- editar `src/routes/_authenticated/nuvex-ia.tsx` → usar `consultarIA` y mostrar fuente (KB vs IA) + botón escalar.
- crear `src/routes/_authenticated/super-admin.nuvex-ia-kb.tsx` → CRUD de KB.
- editar `src/routes/_authenticated.tsx` → añadir item de menú en super-admin para "NUVEX IA · KB".

**No tocar**: tablas `gpt_*` antiguas, edge functions, otros módulos.

## Validación final

Antes de cerrar:
1. KB responde sin consumir tokens cuando hay match.
2. Modelo responde con contexto de rol + módulo cuando no hay match.
3. Cada consulta queda registrada en `nuvex_ia_log` con `origen` y `fuente`.
4. Licenciado no puede ver comisiones de otros (probar con query directa).
5. Botón flotante y página usan el mismo backend.
6. Mensaje de escalamiento aparece y crea ticket.

¿Apruebas el plan para empezar con la migración?
