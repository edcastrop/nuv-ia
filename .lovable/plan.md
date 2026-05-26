# Academia NUVEX — Infraestructura

Construir solo la **infraestructura** del módulo Academia. Sin contenido real todavía: los cursos se cargarán después desde el panel Super Admin.

## 1. Modelo de datos (migración Supabase)

Nuevo enum `academia_rol` mapeado a `app_role`:
- `licenciado`, `operaciones` (= `auxiliar_operativo`), `juridica`, `contabilidad`, `director_financiero_qa`, `gerencia`, `super_admin`

Tablas (con RLS):

- **academia_cursos**: `id`, `rol_destino academia_rol`, `titulo`, `descripcion`, `orden`, `activo`, `created_at`, `updated_at`, `created_by`. Curso = "Academia Licenciado" etc., uno por rol inicial (seed).
- **academia_modulos**: `id`, `curso_id`, `titulo`, `descripcion`, `orden`, `activo`.
- **academia_lecciones**: `id`, `modulo_id`, `titulo`, `tipo` (`texto|pdf|video|imagen|checklist|enlace|faq`), `contenido jsonb` (cuerpo / url / items), `orden`, `duracion_min`, `activo`.
- **academia_recursos**: `id`, `leccion_id` (nullable), `modulo_id` (nullable), `titulo`, `tipo`, `url`, `orden`.
- **academia_evaluaciones**: `id`, `modulo_id`, `titulo`, `nota_minima` (default 80), `intentos_permitidos` (default 3), `activo`.
- **academia_preguntas**: `id`, `evaluacion_id`, `enunciado`, `tipo` (`unica|multiple|verdadero_falso`), `opciones jsonb`, `respuesta_correcta jsonb`, `puntos`, `orden`.
- **academia_intentos**: `id`, `evaluacion_id`, `user_id`, `respuestas jsonb`, `nota`, `porcentaje`, `aprobado bool`, `created_at`. (lectura propia + super_admin/gerencia).
- **academia_progreso_lecciones**: `user_id`, `leccion_id`, `completada bool`, `completada_at`. PK compuesta.
- **academia_certificaciones**: `id`, `user_id`, `curso_id`, `emitida_at`, `nota_final`, `codigo` (slug único). Emisión automática vía función SQL `emitir_certificado(user, curso)` cuando promedio de evaluaciones aprobadas ≥ 80 y todas las lecciones completadas.
- **modulo_ayuda**: `modulo_sistema text` (clave: 'casos','cartera','expediente', etc.), `tipo` (`guia|video|faq|checklist`), `titulo`, `contenido jsonb`, `orden`. Para el Centro de Ayuda contextual.

RLS:
- Lectura cursos/modulos/lecciones/recursos/evaluaciones/preguntas: cualquier autenticado cuyo `rol_destino` esté entre sus roles, o super_admin/gerencia (ven todo).
- Escritura: solo super_admin.
- Intentos/progreso/certificaciones: dueño + super_admin/gerencia.
- modulo_ayuda: lectura autenticada, escritura super_admin.

Función `mapear_rol_to_academia(app_role) → academia_rol` y `academia_rol_del_usuario(uid) → academia_rol` (prioridad: super_admin > gerencia > director_financiero_qa > contabilidad > juridica > operaciones (auxiliar_operativo) > licenciado).

Seed: insertar un curso vacío por cada uno de los 7 roles.

## 2. Frontend — rutas y vistas

Reemplazar la ruta actual `/_authenticated/academia.tsx` (placeholder) con una **academia dinámica por rol**:

- `/academia` — **Dashboard Academia** del usuario:
  - Detecta rol → muestra el curso correspondiente (`rol_destino = academia_rol_del_usuario`).
  - Tarjetas: Progreso %, Cursos completados, Pendientes, Evaluaciones aprobadas, Certificaciones obtenidas.
  - Listado de módulos con barra de avance por módulo.
- `/academia/modulos/$moduloId` — vista del módulo con lecciones y evaluación.
- `/academia/lecciones/$leccionId` — render por tipo (`texto|pdf|video|imagen|checklist|enlace|faq`). Botón "Marcar como completada" → upsert en `academia_progreso_lecciones`.
- `/academia/evaluaciones/$evaluacionId` — flujo de evaluación: render preguntas → submit → muestra nota, %, aprobado/reprobado → guarda intento. Si aprobado y curso completo → dispara emisión de certificado.
- `/academia/certificados/$codigo` — vista imprimible del certificado interno NUVEX (logo, nombre, curso, fecha, código, firma estilizada).
- `/super-admin/academia` — **Administración** (solo super_admin):
  - Listado de cursos por rol, crear/editar/eliminar/activar/desactivar.
  - Editor de módulos, lecciones (por tipo de contenido), recursos, evaluaciones y preguntas.
  - Asignación implícita: cada curso ya está atado a su `rol_destino`; opción futura de asignar a usuarios específicos (se deja columna preparada, no UI todavía).

## 3. Centro de Ayuda contextual

- Componente `<HelpButton modulo="casos" />` reutilizable: botón flotante "?" que abre un drawer con `modulo_ayuda` filtrado (Guía rápida / Video / FAQ / Checklist). Se montará después en módulos del sistema; en este sprint solo se crea el componente + tabla.

## 4. Sidebar

El ítem **Academia** ya existe en la sección "Gestión" del sidebar (`src/routes/_authenticated.tsx`). No se cambia. Se añadirá un sub-ítem **Admin Academia** dentro de la sección Super Admin (visible solo si `isSuperAdmin`).

## 5. Archivos a crear / editar

Crear:
- `supabase/migrations/<ts>_academia.sql` (enum, tablas, RLS, funciones, seed)
- `src/lib/academia.ts` (queries + tipos + helpers de rol)
- `src/hooks/useAcademia.ts` (curso del usuario, progreso, certificaciones)
- `src/components/academia/AcademiaDashboard.tsx`
- `src/components/academia/LeccionRenderer.tsx` (switch por tipo)
- `src/components/academia/EvaluacionPlayer.tsx`
- `src/components/academia/CertificadoView.tsx`
- `src/components/ayuda/HelpButton.tsx` + `HelpDrawer.tsx`
- `src/routes/_authenticated/academia.index.tsx` (reemplaza `academia.tsx`)
- `src/routes/_authenticated/academia.modulos.$moduloId.tsx`
- `src/routes/_authenticated/academia.lecciones.$leccionId.tsx`
- `src/routes/_authenticated/academia.evaluaciones.$evaluacionId.tsx`
- `src/routes/_authenticated/academia.certificados.$codigo.tsx`
- `src/routes/_authenticated/super-admin.academia.tsx` (CRUD)

Editar:
- `src/routes/_authenticated.tsx` — añadir link "Admin Academia" en sección Gestión cuando `isSuperAdmin`.
- Borrar contenido del actual `src/routes/_authenticated/academia.tsx` (se renombra a `academia.index.tsx`).

## 6. Validación (criterios de cierre)

- Cada uno de los 7 roles ve **solo** su academia al entrar a `/academia`.
- Dashboard con Progreso %, completados, pendientes, evaluaciones aprobadas, certificaciones.
- Evaluaciones funcionando (3 tipos de pregunta, cálculo de %, aprobado/reprobado).
- Certificación interna emitida automáticamente con 80% o más + ruta pública `/academia/certificados/$codigo`.
- Super Admin puede crear/editar/eliminar/activar/desactivar cursos, módulos, lecciones y evaluaciones desde `/super-admin/academia`.

> Nota: este sprint deja todos los cursos **vacíos** (sin lecciones reales). El llenado de contenido se hará en una iteración posterior desde el panel Super Admin.
