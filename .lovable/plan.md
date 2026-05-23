## Plan: Super Admin + Estados Inteligentes del Caso

Módulo grande con cambios en BD, roles, estados, panel admin, confirmaciones y auditoría. NO toca simuladores, OCR, PDFs, plantillas ni cálculos.

---

### 1. Base de datos (migración)

**Roles** (extender enum `app_role`):
- Agregar: `super_admin`, `juridica`, `operaciones`, `cartera`
- Mantener: `admin`, `gerencia`, `asesor`, `licenciado`
- `super_admin` se trata como super-usuario (alias funcional de admin con capacidades extra de gestión de usuarios).

**Estados del caso** (nuevo enum `caso_estado_v2`):
- 19 estados solicitados (Lead creado → Proceso cerrado).
- Mantener enum viejo `expediente_estado` por compatibilidad con simuladores/aprobado_data.
- Agregar columna `expedientes.estado_caso` (text/enum nuevo, default `'lead_creado'`).
- NO eliminar `expedientes.estado` (lo usan simuladores, dashboard antiguo, badges).

**Auditoría** (extender `expediente_historial`):
- Agregar columnas: `accion_origen` (text), `observacion` (text), `estado_caso_anterior`, `estado_caso_nuevo`.
- Los cambios del enum viejo siguen guardándose en `estado_anterior/nuevo`.

**Gestión de usuarios** (Super Admin):
- Agregar columna `profiles.activo` (bool, default true).
- RLS: super_admin puede ver/editar todos los profiles y user_roles.

---

### 2. Hook de roles

`src/hooks/useUserRole.ts`:
- Agregar tipo `AppRole` extendido.
- Helpers: `isSuperAdmin`, `isLicenciado`, `canManageGlobal`.

---

### 3. Estados inteligentes

`src/lib/casoEstados.ts` (nuevo):
- Constante `CASO_ESTADOS` (19 estados con label, color, orden).
- Mapa `ACCION_A_ESTADO`: `extracto_subido` → `extracto_recibido`, `simulacion_generada` → `simulacion_realizada`, etc.
- Función `sugerirEstado(expedienteId, accion, userId)` → server fn que NO cambia estado, solo retorna sugerencia.
- Función `confirmarEstado(expedienteId, nuevoEstado, accionOrigen, observacion?)` → cambia estado + guarda historial.

**Componente** `ConfirmEstadoModal.tsx`:
- Diálogo reusable: "¿Confirmas que deseas cambiar el estado del caso a: [X]?" con Confirmar / Cancelar + textarea opcional observación.

**Hook** `useEstadoSugerido(expedienteId)`:
- API: `sugerir(accion)` abre modal; al confirmar dispara update y refresca expediente.

**Integración en puntos existentes** (sin tocar lógica):
- `ExtractoReader` → al subir: `sugerir('extracto_subido')`.
- `PesosSimulator`/`UVRSimulator` → tras `upsertExpediente` exitoso: `sugerir('simulacion_generada')`.
- `RecommendedResult`/export propuesta PDF → `sugerir('propuesta_generada')`.
- `EnviarContratacion` (server fn) → al enviar exitoso: marcar `enviado_contratacion` (auto, ya existe).
- `DocumentosLegales` → botones nuevos pequeños: "Contrato firmado", "Poder firmado", "Radicado banco" → sugieren estado.
- `ResultadoFinal` → `sugerir('resultado_final_generado')`.
- `PazYSalvo` → `sugerir('paz_y_salvo_generado')`.
- En detalle de caso (`casos.$id.tsx`): bloque "Estado del caso" con selector manual (solo super_admin/admin) + timeline historial.

---

### 4. Panel Super Admin

Nuevo route `/_authenticated/super-admin/`:
- `super-admin.index.tsx` → dashboard con métricas:
  - Total expedientes, por estado, por licenciado, aprobados, honorarios proyectados/cobrados.
  - Casos en mora (>30d sin avance), pendientes contratación, pendientes radicación.
- `super-admin.usuarios.tsx` → CRUD usuarios: listar profiles, activar/desactivar, asignar roles, crear (invite by email vía signUp admin → en este stack usamos signup self-service + asignación manual de rol).
- `super-admin.expedientes.tsx` → tabla global con filtros: licenciado, banco, estado, fechas, producto, ciudad, honorarios.

Guard: `beforeLoad` redirige si no es super_admin/admin.

Link en sidebar/nav solo visible si `isSuperAdmin || isAdmin`.

---

### 5. Filtros expedientes

Extender `casos.index.tsx` y `super-admin.expedientes.tsx` con dropdowns adicionales (licenciado/ciudad/producto/honorarios min-max/fecha aprobación).

---

### 6. Historial visible

En `casos.$id.tsx` agregar componente `HistorialCaso` que liste `expediente_historial` con: estado anterior → nuevo, usuario (join profiles), fecha/hora, acción origen, observación.

---

### 7. Validaciones / RLS

- `expedientes` SELECT: licenciado solo ve `asesor_id = auth.uid()`; super_admin/admin/gerencia ven todo (ya existe, verificar).
- `profiles` UPDATE: super_admin puede actualizar cualquiera.
- `user_roles` ALL: super_admin además de admin.

---

### Archivos a crear
- `supabase/migrations/<ts>_super_admin_estados.sql`
- `src/lib/casoEstados.ts`
- `src/lib/casoEstados.functions.ts`
- `src/components/expediente/ConfirmEstadoModal.tsx`
- `src/components/expediente/HistorialCaso.tsx`
- `src/hooks/useEstadoSugerido.ts`
- `src/routes/_authenticated/super-admin.index.tsx`
- `src/routes/_authenticated/super-admin.usuarios.tsx`
- `src/routes/_authenticated/super-admin.expedientes.tsx`

### Archivos a editar (cambios mínimos, solo wiring)
- `src/hooks/useUserRole.ts` (roles nuevos)
- `src/routes/_authenticated/casos.$id.tsx` (bloque estado + historial)
- `src/routes/_authenticated/casos.index.tsx` (filtros extra)
- `src/components/nuvex/ExtractoReader.tsx` (sugerir tras subir)
- `src/components/nuvex/PesosSimulator.tsx` y `UVRSimulator.tsx` (sugerir tras guardar)
- `src/components/expediente-maestro/DocumentosLegales.tsx` (botones contrato/poder/radicado firmados)
- Nav/sidebar para link Super Admin

---

### Notas

- "Crear usuarios" desde super_admin: en este stack no hay admin API expuesta al cliente. Implementaré "invitar" enviando email con link de signup + pre-asignación de rol pendiente; o más simple: el super_admin crea el rol después que el usuario se registra. Recomiendo opción simple: pantalla lista usuarios registrados + asignación de roles + activar/desactivar. Si se requiere invitación por email, lo hago como server fn con `supabaseAdmin.auth.admin.inviteUserByEmail`.

- Estado dual: dejo `estado` (enum antiguo del workflow simulador) y `estado_caso` (nuevo de 19 estados). El dashboard antiguo sigue funcionando; el nuevo panel usa `estado_caso`.

¿Procedo?