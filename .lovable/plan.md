
# War Room NUVIA · Rediseño Colaboración

Alcance 100% **visual + realtime**. No se tocan: rutas, tablas, permisos, RLS, edge functions, eventos ni contratos de `src/lib/colaboracion.ts`. Todo el trabajo se concentra en `src/routes/_authenticated/colaboracion.index.tsx` y, si aplica, un pequeño hook realtime nuevo.

## Objetivo

Convertir la pantalla en un centro de operaciones estilo Palantir / Bloomberg / Linear, con densidad útil, realtime auténtico y microinteracciones sobrias.

## Cambios por zona

### 1. Sidebar global (izq)
Sin cambios. Se conserva tal cual.

### 2. Team Channels (col 1, ~220-260px)
- Reorganización visual: separadores por bloque (Áreas · Dirección · Privados).
- Se añaden los canales que faltan del brief: **Dirección Financiera, Dirección Jurídica, Talento Humano** (matcher por nombre; si no existe canal, quedan deshabilitados con hint "sin canal").
- Bloque inferior "Personas conectadas" con avatares + dot verde (usando `usePresenciaOnline` que ya existe).
- Hover con glow del accent, estado activo con barra lateral.

### 3. Casos activos (col 2, ~300px) — **Bloque QA dinámico**
Este es el mayor cambio funcional-visual:
- Tarjetas **agrupadas por etapa**: `SIMULADO → QA → RADICADO → APROBADO → FIRMA → FINALIZADO` con contadores por columna colapsable.
- Tarjetas más compactas (mostrar 8-10 visibles), con: iniciales cliente, banco, N° crédito, analista (avatar), SLA, prioridad, badges (📎 archivos, 💬 mensajes, 🤖 IA, ✅ QA), barra de progreso mini, dot "en edición" cuando otro user está activo.
- **Realtime**: suscripción a `postgres_changes` sobre `expedientes` (campos etapa/estado/qa_score) → la tarjeta cambia de grupo con animación slide+fade sin recargar. Hook nuevo `useExpedientesLive.ts`.
- Filtros existentes (search, prioridad) se mantienen; se agrega chip "solo míos".

### 4. Panel central — **Command Center**
- Header actual se conserva y se refina (más denso, chips SLA/prioridad/etapa con pulso solo si `sla<=2`).
- Se agregan **tabs internos** sobre el chat: `Conversación · Expediente · Extractos · Timeline · IA Analysis · Notas · Checklist`.
  - `Conversación` = `CanalChat` actual.
  - `Expediente / Extractos / Timeline / IA Analysis` = embed liviano (iframe/link con botón "abrir en módulo"). Como no se puede duplicar lógica, cada tab muestra un resumen + CTA al módulo real (mantiene lo que ya hacían los HeaderAction, pero ahora inline).
  - `Notas / Checklist` = placeholders visuales con CTA "próximamente" (para no crear tablas).
- Chat: separadores de fecha, agrupación por autor consecutivo, indicador "escribiendo…" (Realtime Presence en el canal — ya hay infra en `presencia.ts`).

### 5. Case Intelligence (col 4)
- Se refina: semáforo de salud, mini sparkline de actividad (últimos 7 días de mensajes del canal), probabilidad de éxito derivada de qa_score, chip "riesgo IA".
- Los eventos ahora son reales: últimos N mensajes del canal (ya suscritos) + últimas transiciones de expediente (si hay tabla `expediente_eventos`, si no se dejan los pseudo actuales).

## Realtime
- Nuevo hook `src/hooks/useExpedientesLive.ts`: suscribe a `postgres_changes` de `expedientes` (event `*`) y devuelve un map `{casoId: {etapa, qa_score, updated_at}}`.
- Se combina con `creditMap` existente para reubicar tarjetas por etapa.
- Animaciones: `framer-motion` (ya en package.json si existe; si no, CSS transitions `translate3d + opacity`).

## Microinteracciones
- Transiciones 200ms cubic-bezier(.2,.8,.2,1).
- Pulso verde en dot Live sólo cuando hay actividad en últimos 60s.
- Border glow accent en hover, sombra profunda en active.
- No spinners: skeletons oscuros glass.

## Fuera de alcance (explícito)
- Nuevas tablas / migraciones.
- Cambios en `colaboracion.ts`, `presencia.ts`, permisos, notifTriggers.
- Nuevas rutas TanStack.
- Reescritura de `CanalChat` (solo se le añade date-separator vía prop opcional si es trivial; si no, se deja igual).

## Archivos a tocar
- `src/routes/_authenticated/colaboracion.index.tsx` (refactor visual y agrupación por etapa).
- `src/hooks/useExpedientesLive.ts` (nuevo, ~40 líneas).
- Opcional: pequeño ajuste en `CanalChat.tsx` para separadores de fecha.

## Riesgos y mitigación
- El realtime sobre `expedientes` requiere que la tabla esté en `supabase_realtime` publication. Si no lo está, el hook cae en fallback silencioso (polling 30s) y no rompe nada.
- Los tabs internos del panel central no duplican lógica de otros módulos; sólo muestran resumen + CTA. Así no rompemos ningún permiso.

## Validación
- Typecheck completo.
- Verificar en preview con Playwright: cambio de canal, navegación de HeaderActions, agrupación por etapa visible, hover states, responsive md/lg/2xl.

¿Apruebas este alcance? Si prefieres que sea aún más agresivo (por ejemplo, reescribir `CanalChat` completo o crear tabla `expediente_eventos` para timeline real), dímelo antes de que arranque.
