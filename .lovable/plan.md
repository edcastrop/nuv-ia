## ONBOARDING V1 NUVEX — Plan de implementación

Aprovechamos la infraestructura existente (`profiles.estado_acceso`, `rol_solicitado`, `aprobado_por`, registro público, bandeja en `/super-admin/accesos`) y construimos encima el flujo guiado de 14 fases, **sin bloquear acceso por academia**.

---

### 1. Base de datos (migración única)

Añadir a `public.profiles`:
- `onboarding_estado` text default `'pendiente'` — valores: `pendiente | en_progreso | completado`
- `onboarding_paso` int default `0` (0–4: bienvenida, perfil, tour, academia, checklist)
- `onboarding_started_at`, `onboarding_completed_at` timestamptz
- `bienvenida_vista`, `perfil_completo`, `tour_completo`, `academia_asignada`, `checklist_completo` booleans
- `pais` ya existe ✓

Nueva tabla `onboarding_config` (singleton, edita Super Admin):
- `video_bienvenida_url`, `mensaje_bienvenida`, `descripcion_empresa`

Nueva tabla `onboarding_auditoria`:
- `user_id`, `evento` (registro/aprobacion/rechazo/inicio/fin/asignacion_academia/activacion_permisos), `actor_id`, `detalle jsonb`, `created_at`

Trigger `on_profile_approved`: cuando `estado_acceso` cambia a `activo`, inserta auditoría + marca `academia_asignada=true` (la asignación real ya es por rol via `academia_cursos.rol_destino`).

GRANTs y RLS:
- `profiles`: ya tiene políticas; añadir UPDATE propio para campos onboarding.
- `onboarding_config`: SELECT authenticated, ALL super_admin.
- `onboarding_auditoria`: INSERT authenticated (self o admin), SELECT super_admin/gerencia.

### 2. Restringir roles solicitables en `/registro`

Editar `src/routes/registro.tsx`:
- Quitar `super_admin` de `ROLES_SOLICITABLES`.
- Lista final: Licenciado, Operaciones, Jurídica, Contabilidad, Director Financiero QA, Apoderado.
- Añadir campos: `pais` (default Colombia), foto de perfil opcional (upload a bucket `avatars`).
- Insertar en `onboarding_auditoria` evento `registro`.

### 3. Pantalla "Pendiente aprobación"

Hoy `_authenticated.tsx` solo verifica sesión. Añadir gate:
- Leer `profiles.estado_acceso` del usuario.
- Si `pendiente` → redirigir a `/pendiente-aprobacion` (nueva ruta pública con sesión, fuera del layout principal).
- Si `rechazado` → pantalla con motivo + botón cerrar sesión.

### 4. Bandeja Super Admin de pendientes

Reutilizar `/super-admin/accesos` (ya existe). Verificar/extender para mostrar nuevos campos (país, celular, ciudad, rol solicitado, fecha registro) y acciones: Aprobar, Rechazar, Solicitar info, Cambiar rol. Al aprobar:
- `estado_acceso='activo'`, asigna rol via `user_roles`, inicia onboarding (`onboarding_estado='en_progreso'`), inserta auditoría.

### 5. Wizard de Onboarding `/onboarding`

Nueva ruta `_authenticated/onboarding.tsx` con 5 pasos:
1. **Bienvenida** — Logo, mensaje, video (de `onboarding_config`), botón "Comenzar".
2. **Perfil** — validar nombre, celular, ciudad, país, avatar; usar componentes existentes de `mi-perfil`.
3. **Tour** — overlay interactivo (componente propio con tooltips) explicando Dashboard, Casos, Expedientes, Simulador, Colaboración, Academia, NUVEX GPT, Perfil, Notificaciones. Skippable.
4. **Academia** — muestra automáticamente el curso asignado por rol (consulta `academia_cursos` por `rol_destino`), botón "Ver mi academia" (no bloqueante).
5. **Checklist** — resumen visual de los 6 ítems; botón "Finalizar onboarding" → marca `onboarding_estado='completado'`.

Gate en `_authenticated.tsx`: si `estado_acceso='activo'` y `onboarding_estado!='completado'` y la ruta actual no es `/onboarding` ni `/mi-perfil`, redirige a `/onboarding`. Permitir saltar paso individual; el wizard guarda progreso parcial.

### 6. Banner académico no bloqueante

Componente `<AcademiaBanner />` en layout autenticado: si hay módulos pendientes o certificación incompleta, muestra barra superior "📚 Capacitación en progreso · X% completado · Continuar". No interrumpe operación.

### 7. Notificaciones (recordatorios)

Insertar en `colab_notificaciones` (tabla existente) recordatorios:
- A los 3/7 días si `perfil_completo=false`
- A los 7 días si `onboarding_estado='en_progreso'`
- Semanalmente si academia <50%

V1: insert al cargar `_authenticated` con dedupe por día (no requiere cron).

### 8. Panel Super Admin `/super-admin/onboarding`

Nueva ruta con KPIs (counts sobre `profiles`):
- Pendientes / Aprobados / Rechazados
- Onboarding completado / en progreso
- Usuarios activos
- Tabla de últimos registros con su estado y % avance.

### 9. Auditoría

Wrapper `logOnboarding(evento, detalle)` que inserta en `onboarding_auditoria`. Llamarlo en: registro, aprobación, rechazo, inicio/fin onboarding, asignación academia, activación permisos.

---

### Archivos a crear
- `supabase/migrations/{ts}_onboarding_v1.sql`
- `src/routes/pendiente-aprobacion.tsx`
- `src/routes/_authenticated/onboarding.tsx`
- `src/routes/_authenticated/super-admin.onboarding.tsx`
- `src/components/onboarding/StepBienvenida.tsx`
- `src/components/onboarding/StepPerfil.tsx`
- `src/components/onboarding/StepTour.tsx`
- `src/components/onboarding/StepAcademia.tsx`
- `src/components/onboarding/StepChecklist.tsx`
- `src/components/onboarding/AcademiaBanner.tsx`
- `src/lib/onboarding.ts` (helpers + auditoría)

### Archivos a editar
- `src/routes/registro.tsx` — roles permitidos + país + avatar opcional
- `src/routes/_authenticated.tsx` — gate de estado_acceso y onboarding
- `src/routes/_authenticated/super-admin.accesos.tsx` — refrescar UI de aprobación (si necesario)

### Lo que NO se toca
- Roles, permisos, simuladores, expedientes, cartera, jurídica, contabilidad, academia (contenido).
- La academia sigue siendo **opcional**: no bloquea CRM, solo banner de seguimiento.

---

¿Aprueba el plan para implementarlo?
