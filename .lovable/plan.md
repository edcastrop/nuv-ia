# Ficha Única de Usuario NUVEX

Implementación completa de la ficha única de perfil aplicable a **todos los roles** (Super Admin, Gerencia, Director Financiero QA, Director Jurídico, Analista Jurídico, Contabilidad, Licenciado, Auxiliar Operativo, Apoderado).

---

## 1. Migración de Base de Datos

### 1.1 Ampliar tabla `profiles`
Agregar columnas (todas nullable salvo lo ya existente):

**Datos personales**
- `tipo_documento` text (CC, CE, PA, NIT)
- `numero_documento` text
- `pais` text default 'Colombia'
- `departamento` text
- `ciudad` text
- `direccion` text

**Contacto**
- `celular` text
- `whatsapp` text
- `correo_corporativo` text
- (email ya existe → correo personal)

**Foto**
- `avatar_url` text
- `avatar_path` text  (path en bucket para poder reemplazar/borrar)

**Organizacional**
- `fecha_ingreso` date
- `coordinador_id` uuid (FK a profiles.id, nullable)
- `equipo` text
- `sede` text

**Financiero (sensible)**
- `porcentaje_comision` numeric
- `banco` text
- `tipo_cuenta` text  (ahorros/corriente)
- `numero_cuenta` text
- `titular_cuenta` text

### 1.2 Vista pública (sin financiero)
Crear vista `profiles_public` que excluya columnas financieras + función `can_view_profile_finanzas(uuid)` (super_admin o contabilidad). Las columnas financieras se ocultan mediante una política RLS adicional: leer columnas financieras solo si dueño, super_admin o contabilidad.

Como Postgres RLS es row-level (no column-level), usamos **dos vistas**:
- `profiles_basico` → todos los datos no financieros, visible a autenticados.
- `profiles_financiero` → solo financiero, restringido por RLS a (dueño OR super_admin OR contabilidad).

### 1.3 Storage bucket `avatars`
- `public = true` (avatars son URLs públicas).
- Policy upload/update/delete: solo el dueño (`auth.uid()::text = (storage.foldername(name))[1]`).
- Tamaño máx 5 MB validado en cliente; tipos JPG/PNG/WEBP.

### 1.4 Tabla `profile_auditoria`
```
id uuid pk
profile_id uuid not null
actor_id uuid (quien hizo el cambio)
accion text  -- 'creado','cambio_foto','cambio_correo','cambio_celular','cambio_rol','update'
valor_anterior jsonb
valor_nuevo jsonb
created_at timestamptz default now()
```
RLS: SELECT solo super_admin/gerencia o el propio dueño. INSERT por authenticated.

### 1.5 Triggers de auditoría
- Trigger `AFTER UPDATE` en `profiles` que inserta en `profile_auditoria` si cambia `avatar_url`, `email`, `correo_corporativo`, `celular`, `whatsapp`.
- Trigger `AFTER INSERT/DELETE` en `user_roles` que registra `cambio_rol`.
- Trigger `AFTER INSERT` en `profiles` registra `creado`.

---

## 2. Frontend

### 2.1 Helper `src/lib/profile.ts`
- `getMyProfile()`, `updateMyProfile(payload)`, `uploadAvatar(file)`, `deleteAvatar()`.
- `getProfileAuditoria(profileId)`.
- Validación zod (límites de longitud + formato celular).

### 2.2 Componente `<UserAvatar />` reutilizable
- Lee `avatar_url` + iniciales fallback.
- Tamaños: sm/md/lg.
- Usar en: Sidebar header (reemplaza iniciales actuales en `_authenticated.tsx`), Dashboard, lista de Casos (asesor), Expedientes, Academia, Super Admin → Usuarios.

### 2.3 Nueva ruta `/mi-perfil`  → `src/routes/_authenticated/mi-perfil.tsx`
Layout en pestañas/secciones:
1. **Foto de perfil** — preview circular, botones Subir / Reemplazar / Eliminar (drag & drop, valida 5 MB y mime).
2. **Datos personales** — formulario editable.
3. **Contacto** — celular, whatsapp, correo personal, correo corporativo.
4. **Información organizacional** — solo lectura para el propio usuario (rol, estado, fecha ingreso, coordinador, equipo, sede). Editable solo por Super Admin/Gerencia desde `/super-admin/usuarios`.
5. **Información financiera** — visible solo si dueño es Super Admin/Contabilidad **o** el dueño consulta su propia ficha. Editable por Super Admin/Contabilidad.
6. **Información académica** — consulta a `academia_cursos` + `academia_progreso_lecciones` + `academia_certificaciones` del usuario: cursos asignados (por rol), % avance, certificaciones, último acceso (max(`completada_at`)).
7. **Auditoría** — tabla de últimos 50 eventos del propio perfil.

Diseño coherente con NUVEX (paleta `#445DA3` / `#84B98F`, cards `src/components/nuvex/ui.tsx`).

### 2.4 Menú lateral
En `src/routes/_authenticated.tsx`:
- Agregar item **"Mi Perfil"** (icon `UserCircle`) en una nueva sección "Cuenta" al final, visible para todos los roles (incluido apoderado).
- Hacer clic en el bloque de avatar del header también enlaza a `/mi-perfil`.

### 2.5 Ampliar `/super-admin/usuarios`
Extender la tabla existente para permitir editar:
- Datos organizacionales (fecha ingreso, coordinador, equipo, sede).
- Datos financieros (solo super_admin/contabilidad).
- Ver auditoría completa del usuario seleccionado (drawer/modal).

---

## 3. Detalles técnicos

```text
profiles (ampliada)
    ├─ avatar en bucket public "avatars/{user_id}/avatar.{ext}"
    ├─ trigger AFTER UPDATE → profile_auditoria
    └─ vista profiles_financiero (RLS dueño/super_admin/contabilidad)

user_roles
    └─ trigger AFTER INSERT/DELETE → profile_auditoria (cambio_rol)

rutas nuevas
    /mi-perfil              (todos)
    /super-admin/usuarios   (ampliada: edición + auditoría)
```

### Validaciones zod (cliente + server)
- nombre 1-120
- celular/whatsapp regex `^\+?\d{7,15}$`
- correo electrónico válido, máx 255
- numero_documento 4-20, alfanumérico
- foto: mime ∈ {image/jpeg, image/png, image/webp}, ≤ 5 MB

### Compatibilidad
- Todos los avatares actuales (header sidebar) se reemplazan por `<UserAvatar />`.
- Roles existentes no se modifican; solo se agregan columnas y políticas.

---

## 4. Orden de ejecución
1. Migración SQL (tablas, vistas, bucket, triggers, RLS).
2. `src/lib/profile.ts` + componente `<UserAvatar />`.
3. Ruta `/mi-perfil`.
4. Sidebar: ítem "Mi Perfil" + avatar real en header.
5. Reemplazo de iniciales en Casos / Expedientes / Academia / Dashboard.
6. Ampliación de `/super-admin/usuarios`.
7. Verificación final con todos los roles.

¿Apruebas para proceder con la migración y la implementación?
