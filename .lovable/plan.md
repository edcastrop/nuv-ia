## Centro de Seguridad y Gestión de Accesos NUVEX

Implementar flujo de aprobación de cuentas, 2FA obligatorio, gestión de roles/permisos y auditoría completa.

### 1. Base de datos (migración)

**Modificar `profiles`** — agregar:
- `estado_acceso` enum: `pendiente | aprobado | rechazado | bloqueado` (default `pendiente`)
- `rol_solicitado` text (rol que el usuario pidió al registrarse)
- `telefono_registro` text
- `ciudad_registro` text, `equipo_registro` text
- `aprobado_por` uuid, `aprobado_at` timestamptz, `rechazado_motivo` text
- `ultimo_login_at` timestamptz
- `intentos_fallidos` int default 0
- `mfa_requerido` bool default true
- `mfa_metodo` enum: `email | totp | ninguno` (default `ninguno`)
- `mfa_secret` text (cifrado, para TOTP)
- `mfa_verificado_at` timestamptz

**Nueva tabla `acceso_auditoria`**:
- `id, user_id, actor_id, accion` (creado, aprobado, rechazado, bloqueado, activado, login_ok, login_fail, mfa_activado, mfa_verificado, cambio_rol)
- `detalle jsonb, ip text, user_agent text, created_at`

**Nueva tabla `mfa_codigos_email`** (códigos OTP de 6 dígitos enviados por correo):
- `id, user_id, codigo_hash, expira_at, usado bool, created_at`

**Trigger `handle_new_user`** — modificar para que nuevos signups queden en `estado_acceso='pendiente'` y registrar metadatos (rol_solicitado, telefono, ciudad, equipo) desde `raw_user_meta_data`.

**RLS**: solo super_admin/admin/gerencia ven y modifican estos campos; usuario solo lee su propio estado.

**GRANTS** correspondientes.

### 2. Server functions (`src/lib/seguridad.functions.ts`)

- `listUsuariosAcceso({ estado })` — lista perfiles filtrados por estado (admin only).
- `aprobarUsuario({ userId, rolesAsignar })` — cambia estado a `aprobado`, inserta `user_roles`, registra auditoría, dispara notificación.
- `rechazarUsuario({ userId, motivo })` — estado `rechazado`, auditoría.
- `bloquearUsuario({ userId })` / `activarUsuario({ userId })` — toggle.
- `enviarCodigoMfaEmail({ })` — genera código, lo guarda (hash), envía email vía Resend.
- `verificarCodigoMfaEmail({ codigo })` — valida y marca `mfa_verificado_at`.
- `setupTotp()` / `verifyTotp({ codigo })` — usa `otplib` para TOTP.
- `listAuditoriaAcceso({ userId? })` — historial.

### 3. Frontend

**`/login` (modificar)**:
- Tras `signInWithPassword`, comprobar `profiles.estado_acceso`. Si ≠ `aprobado` → cerrar sesión y mostrar mensaje.
- Si aprobado pero `mfa_verificado_at` es null o expirado (>30 días) → redirigir a `/mfa-verificar`.

**`/registro` (nueva ruta pública)**:
- Form: nombre, correo, teléfono, ciudad, equipo, rol solicitado.
- Llama `supabase.auth.signUp` con metadata.
- Muestra pantalla "Cuenta pendiente de aprobación".

**`/mfa-verificar` (nueva ruta semi-pública, requiere session)**:
- Selección: email o app autenticadora.
- Si email: botón "Enviar código" → input 6 dígitos.
- Si TOTP: pantalla setup con QR (primera vez) o input código.

**`/super-admin/accesos` (nueva ruta admin)** — "Gestión de Accesos":
- Tabs: Pendientes | Aprobados | Rechazados | Bloqueados | Todos.
- Tarjeta por usuario con foto, datos, rol solicitado, botones Aprobar/Rechazar/Bloquear/Activar.
- Modal de aprobación: selección de roles a asignar.
- Panel lateral con historial de auditoría del usuario.

**Sidebar** (`_authenticated.tsx`):
- Agregar item "Accesos" (Shield icon) bajo sección Gestión, visible para super_admin.

### 4. Estilo
Paleta `#242424`, `#445DA3`, `#84B98F`. Cards minimalistas, badges de estado con colores semánticos (ámbar pendiente, verde aprobado, rojo rechazado/bloqueado, gris inactivo).

### 5. Notas técnicas
- TOTP: instalar `otplib` y `qrcode`.
- Email OTP: usar Resend (ya configurado) vía server function.
- Permisos por perfil ya existen via `rol_permisos`/`has_permission`; expondré editor básico en la pantalla de aprobación para asignar roles, dejando los permisos finos al módulo existente de Super Admin.

### Validación
- Crear cuenta nueva → queda pendiente → no puede entrar.
- Admin aprueba → usuario puede iniciar sesión.
- Primer login pide MFA → bloquea hasta verificar.
- Auditoría registra todos los eventos.
