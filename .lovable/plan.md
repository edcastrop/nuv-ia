# NUVEX GPT — Copiloto Operativo Corporativo

Asistente corporativo inteligente con base de conocimiento editable, respuestas contextuales por rol/módulo, escalamiento a tickets y dashboard de aprendizaje continuo.

## Arquitectura

- **Backend AI**: Edge function `nuvex-gpt-chat` usando Lovable AI Gateway (`google/gemini-3-flash-preview` por defecto, streaming SSE). El system prompt se construye en el servidor combinando: rol del usuario, módulo actual, y categorías de conocimiento relevantes (RAG simple por keyword/categoría + opcional embeddings).
- **Base de conocimiento**: tabla `gpt_kb_categorias` (30 categorías iniciales editables) + `gpt_kb_articulos` (título, contenido markdown, categoría, roles permitidos, tags, activo).
- **Conversaciones**: `gpt_conversaciones` + `gpt_mensajes` para historial por usuario.
- **Tickets de escalamiento**: `gpt_tickets` (área destino: jurídica/operaciones/contabilidad/qa/soporte, estado, prioridad).
- **Analítica**: `gpt_consultas_log` con pregunta, categoría detectada, módulo origen, respondida (bool), feedback. Vista agregada para Super Admin.

## Base de datos (migración)

```text
gpt_kb_categorias(id, nombre, descripcion, orden, activo)
gpt_kb_articulos(id, categoria_id, titulo, contenido, tags[], roles_permitidos[], activo, created_by, updated_at)
gpt_conversaciones(id, user_id, titulo, modulo_contexto, created_at, updated_at)
gpt_mensajes(id, conversacion_id, role[user|assistant|system], content, created_at, metadata jsonb)
gpt_tickets(id, user_id, conversacion_id, area, asunto, descripcion, estado, prioridad, asignado_a, resuelto_at, created_at)
gpt_consultas_log(id, user_id, rol, modulo, pregunta, categoria_detectada, respondida, feedback, created_at)
```

RLS:
- KB categorías/artículos: SELECT autenticados (filtrado por `roles_permitidos`), gestión super_admin/gerencia.
- Conversaciones/mensajes: owner-only + super_admin lectura.
- Tickets: owner crea/lee los suyos; área destino y managers leen los suyos; super_admin todo.
- Log: insert authenticated; select super_admin/gerencia.

Seed: 30 categorías + ~40 artículos base (Ley 546 art. 17, Fresh, simulación, cuenta de cobro, comisión financiada, devolución banco, poderes, cambio de estado, reajuste honorarios, TEA, leasing habitacional, etc.).

## Backend

**Edge function `supabase/functions/nuvex-gpt-chat/index.ts`**
- Recibe: `messages`, `conversacion_id` (opcional), `modulo_contexto`.
- Resuelve `user_id` desde JWT, lee rol vía `has_role`/`user_roles`.
- Recupera artículos KB relevantes: filtra por roles_permitidos del usuario, luego selección top-K por keyword match contra última pregunta (Postgres `ilike` sobre titulo+tags+contenido, con boost por `categoria` que coincida con `modulo_contexto`).
- Construye system prompt con: identidad ("NUVEX GPT"), reglas (no inventar, restricción por rol, formato paso-a-paso para "cómo hago…", formato académico cuando aplica, frase de escalamiento), contexto del rol y módulo, y los artículos KB recuperados.
- Llama Lovable AI Gateway con streaming. Maneja 429/402.
- Persiste mensajes usuario+asistente al cerrar stream (vía registro post-stream o segunda llamada cliente→`/gpt-save-message`). MVP: cliente envía mensaje user y al terminar el stream envía assistant final → función `gpt-save-message`.
- Registra `gpt_consultas_log` con pregunta + módulo + rol.

**Edge function `nuvex-gpt-ticket`**: crea ticket de escalamiento.

## Frontend

- **`<NuvexGptButton />`**: botón flotante fijo bottom-right, visible en todas las rutas autenticadas (montado en `_authenticated.tsx`). Oculto en `/login`, `/auth`.
- **`<NuvexGptPanel />`**: Sheet/Drawer lateral derecho ancho 420px con:
  - Header "NUVEX GPT — Copiloto Operativo Corporativo".
  - Chips de preguntas sugeridas (8 predefinidas).
  - Lista de mensajes con `react-markdown`.
  - Input con envío + indicador de streaming token-por-token.
  - Detección automática del módulo desde `location.pathname` → mapeo (`/cartera/*` → "cartera", `/simulador/*` → "simulador", etc.).
  - Botón "Escalar a ticket" en cada respuesta del asistente → modal con selección de área.
  - Historial de conversaciones (lista lateral).
- **`/super-admin/nuvex-gpt`**:
  - Pestaña **Base de Conocimiento**: CRUD categorías y artículos con editor markdown.
  - Pestaña **Tickets**: tabla de tickets con filtros por área/estado.
  - Pestaña **Analítica**: top preguntas, preguntas sin respuesta, categorías más consultadas, consultas por rol/módulo (gráficos con recharts).
- **Sidebar**: ítem "NUVEX GPT" en sección Super Admin para gestión.

## Reglas de respuesta (en system prompt)

1. Operativa ("¿Cómo hago…?") → "Paso 1 / Paso 2 / Paso 3 / Paso 4" adaptado al módulo.
2. Académica → Resumen + Concepto + Ejemplo práctico + enlace `/academia/...`.
3. Restringida → "Esta información está restringida para tu perfil de acceso."
4. Sin información → "No tengo información suficiente para responder con seguridad. Te recomiendo escalar esta consulta." + botón escalar.
5. Nunca inventar artículos de ley; citar solo lo que está en KB.

## Validación final (checklist post-deploy)

Probar: pregunta jurídica (Ley 546 art. 17), comercial (objeción), financiera (TEA), sistema (¿cómo subo extracto?), académica (¿qué es Fresh?), restricción (licenciado pregunta info de contabilidad), escalamiento a jurídica, historial visible.

## Archivos a crear/editar

- Migración SQL (tablas + RLS + seed categorías y ~40 artículos)
- `supabase/functions/nuvex-gpt-chat/index.ts`
- `supabase/functions/nuvex-gpt-ticket/index.ts`
- `supabase/functions/gpt-save-message/index.ts`
- `supabase/config.toml` (registrar funciones, `verify_jwt = true`)
- `src/lib/nuvex-gpt.ts` (cliente: streamChat, saveMessage, createTicket, getConversaciones)
- `src/components/nuvex-gpt/NuvexGptButton.tsx`
- `src/components/nuvex-gpt/NuvexGptPanel.tsx`
- `src/components/nuvex-gpt/EscalarTicketDialog.tsx`
- `src/routes/_authenticated.tsx` (montar botón flotante)
- `src/routes/_authenticated/super-admin/nuvex-gpt.tsx` (gestión KB + tickets + analítica)
- Sidebar: enlace nuevo

## Notas

- Lovable AI ya provisiona `LOVABLE_API_KEY`; no requiere acción del usuario.
- Costo controlado: modelo flash por defecto, top-K=6 artículos en contexto, máx 4000 tokens entrada.
