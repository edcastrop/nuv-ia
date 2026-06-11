# FASE 7.6.1D-1 — Arquitectura técnica

Objetivo: persistir lo mínimo necesario para que el Expediente Maestro V2 funcione como sistema operativo real. **No** se toca la capa visual del preview todavía. **No** se incluyen promotores, recompra, embajadores, cross-sell, customer success ni E18–E20.

---

## 1. Hallazgo previo — Cliente Maestro ya existe

La tabla `public.clientes` **ya está creada** en la base de datos y `expedientes.cliente_id` ya tiene FK hacia ella (`ON DELETE SET NULL`, con índice). Estructura actual:

- `id, cedula (UNIQUE), nombre_completo, email, telefono, ciudad, fecha_primer_caso, fecha_ultimo_caso, total_expedientes, total_ahorro_generado, total_honorarios_pagados, nps_ultimo, es_promotor, metadata, created_at, updated_at`
- RLS: lectura para todo `authenticated`, escritura sólo `super_admin / admin / gerencia`.

**Decisión:** no se recrea la tabla. La fase D-1 sobre Cliente Maestro se reduce a **backfill + sincronización**, no a un `CREATE TABLE`. Los campos pedidos (`cedula, nombre, email, telefono`) ya existen (`nombre_completo` cumple el rol de `nombre`).

Si prefieres una tabla nueva `clientes_maestro` separada de la actual, indícalo y lo agregamos al plan; lo recomendado es reutilizar.

---

## 2. Modelo entidad-relación (sólo lo nuevo)

```text
clientes (ya existe)
  └── 1:N ──> expedientes (vía cliente_id, ya existe)
                  ├── 1:N ──> expediente_tareas      (NUEVA)
                  └── 1:N ──> expediente_bitacora    (NUEVA)

profiles (auth)
  ├── responsable_id ──> expediente_tareas
  └── usuario_id     ──> expediente_bitacora
```

Sólo se crean dos tablas. Ninguna otra relación se modifica en D-1.

---

## 3. Migración SQL propuesta (una sola migración)

### 3.1 `expediente_tareas`

```sql
CREATE TYPE public.tarea_prioridad AS ENUM ('baja','media','alta','critica');
CREATE TYPE public.tarea_estado    AS ENUM ('pendiente','en_progreso','completada','cancelada');

CREATE TABLE public.expediente_tareas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  responsable_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descripcion     text,
  prioridad       public.tarea_prioridad NOT NULL DEFAULT 'media',
  fecha_objetivo  date,
  estado          public.tarea_estado   NOT NULL DEFAULT 'pendiente',
  completada_at   timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tareas_expediente ON public.expediente_tareas(expediente_id);
CREATE INDEX idx_tareas_responsable ON public.expediente_tareas(responsable_id) WHERE estado IN ('pendiente','en_progreso');
```

### 3.2 `expediente_bitacora`

```sql
CREATE TYPE public.bitacora_tipo AS ENUM ('comentario','evidencia','llamada','email','whatsapp','sistema');

CREATE TABLE public.expediente_bitacora (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
  usuario_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comentario    text NOT NULL,
  tipo          public.bitacora_tipo NOT NULL DEFAULT 'comentario',
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bitacora_expediente_created
  ON public.expediente_bitacora(expediente_id, created_at DESC);
```

### 3.3 GRANTS + triggers

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_tareas    TO authenticated;
GRANT SELECT, INSERT                  ON public.expediente_bitacora TO authenticated;
GRANT ALL ON public.expediente_tareas, public.expediente_bitacora TO service_role;

CREATE TRIGGER tg_tareas_updated BEFORE UPDATE ON public.expediente_tareas
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
```

Bitácora es **append-only** (no se otorga UPDATE/DELETE a `authenticated`). Sólo `service_role` puede corregir errores.

---

## 4. RLS

Patrón: alineado con `expedientes` — el dueño del caso (`asesor_id`), el responsable de la tarea, y los roles de gestión pueden ver/escribir.

```sql
ALTER TABLE public.expediente_tareas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_bitacora  ENABLE ROW LEVEL SECURITY;

-- Función helper reutilizable
CREATE OR REPLACE FUNCTION public.can_access_expediente(_uid uuid, _exp uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT has_role(_uid,'super_admin') OR has_role(_uid,'admin')
      OR has_role(_uid,'gerencia')    OR has_role(_uid,'director_financiero_qa')
      OR has_role(_uid,'director_juridico') OR has_role(_uid,'operaciones')
      OR has_role(_uid,'juridica')
      OR EXISTS (SELECT 1 FROM public.expedientes e
                  WHERE e.id = _exp AND e.asesor_id = _uid);
$$;

-- Tareas: lectura/escritura para quien accede al expediente o es el responsable
CREATE POLICY tareas_read  ON public.expediente_tareas FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id)
      OR responsable_id = auth.uid());
CREATE POLICY tareas_write ON public.expediente_tareas FOR ALL TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id))
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id));

-- Bitácora: lectura amplia (auditoría), inserción sólo si accede al expediente
CREATE POLICY bitacora_read   ON public.expediente_bitacora FOR SELECT TO authenticated
  USING (public.can_access_expediente(auth.uid(), expediente_id));
CREATE POLICY bitacora_insert ON public.expediente_bitacora FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expediente(auth.uid(), expediente_id)
              AND usuario_id = auth.uid());
```

---

## 5. ServerFns nuevas (`src/lib/expedienteOperativo.functions.ts`)

Todas con `requireSupabaseAuth`. RLS hace la seguridad real; las server fns sólo validan input con Zod y normalizan.

| Función | Método | Propósito |
|---|---|---|
| `listTareas({expediente_id})` | GET | Lista tareas del expediente ordenadas por prioridad + fecha. |
| `crearTarea(input)` | POST | Inserta tarea (valida título 1–200, prioridad enum, fecha_objetivo opcional). |
| `actualizarTareaEstado({id, estado})` | POST | Cambia estado; setea `completada_at` cuando pasa a `completada`. |
| `asignarTarea({id, responsable_id})` | POST | Reasigna responsable. |
| `listBitacora({expediente_id, limit, before})` | GET | Lectura paginada DESC. |
| `agregarBitacora({expediente_id, comentario, tipo})` | POST | Inserta con `usuario_id = auth.uid()`. |

No se crean rutas API públicas. No hay edge functions.

---

## 6. Impacto sobre Expediente Maestro V2

La capa visual **no se toca en D-1**. El preview `/expediente-v2/$id` seguirá funcionando con los placeholders actuales. En D-2 (siguiente fase) reemplazaremos:

- Sección **Plan de Tratamiento** → leerá `expediente_tareas` real.
- Sección **Bitácora Clínica** → leerá `expediente_bitacora` real + composer de comentarios.
- Hero seguirá leyendo `expedientes` + `clientes` vía join (ya disponible hoy).

Ningún componente NUVIA cambia. Ninguna ruta productiva (`/casos/$id`, `/expediente-maestro/$id`) se modifica.

---

## 7. Estrategia de migración de datos existentes

1. **Cliente Maestro:** ya hay `expedientes.cliente_id`. Se ejecutará un **backfill idempotente** dentro de la migración:
   ```sql
   -- Crear clientes faltantes a partir de expedientes sin cliente_id
   INSERT INTO public.clientes (cedula, nombre_completo, ...)
   SELECT DISTINCT ON (cedula) cedula, cliente_nombre, ...
     FROM public.expedientes
    WHERE cliente_id IS NULL AND cedula IS NOT NULL AND cedula <> ''
   ON CONFLICT (cedula) DO NOTHING;

   UPDATE public.expedientes e
      SET cliente_id = c.id
     FROM public.clientes c
    WHERE e.cliente_id IS NULL AND e.cedula = c.cedula;
   ```
2. **Tareas:** no hay datos preexistentes — tabla nace vacía.
3. **Bitácora:** se mantiene `expediente_historial` (sistema de auditoría de cambios de estado, automático). `expediente_bitacora` es **complementaria** (comentarios manuales del operador). En D-2 el timeline las une visualmente. **No se migran filas** entre ellas.

---

## 8. Riesgos detectados

| Riesgo | Mitigación |
|---|---|
| Duplicación conceptual entre `expediente_historial` (auditoría auto) y `expediente_bitacora` (comentarios manuales). | Documentar contrato: historial = sistema, bitácora = humano. Tipos disjuntos. |
| Expedientes con `cedula` vacía o malformada quedan sin `cliente_id` tras backfill. | Backfill es best-effort; reporte post-migración con conteo de huérfanos. No bloquea. |
| RLS de tareas requiere helper `can_access_expediente` nuevo — posible solape con políticas existentes. | Función `SECURITY DEFINER` aislada, sólo lectura, no recursiva (no consulta tareas/bitácora). |
| Cliente Maestro actual tiene campos agregados (`total_ahorro_generado`, etc.) no en el spec. | Se ignoran en D-1; se mantienen para no romper código existente (`caso_eventos`, `testimonios`, `casos_referidos` ya los referencian). |
| `expediente_tareas` con `ON DELETE CASCADE` borra tareas al borrar expediente. | Coherente con modelo operativo; bitácora idem. |
| Bitácora append-only: si un usuario sube un comentario erróneo, no puede borrarlo. | Aceptado por diseño (trazabilidad). Corrección vía nuevo comentario o `service_role`. |

---

## 9. Entregables de D-1 (al ejecutar)

1. Una migración SQL única (tablas + enums + grants + RLS + helper + triggers + backfill clientes).
2. Archivo `src/lib/expedienteOperativo.functions.ts` con las 6 server fns.
3. **Ningún cambio visual.** El preview V2 sigue idéntico.

---

## 10. Fuera de alcance (confirmado)

- Promotores, recompra, embajadores, cross-sell, customer success, programa de referidos avanzado.
- E18, E19, E20 del pipeline.
- Tabla `clientes_maestro` separada (se reutiliza `clientes`).
- Cambios visuales en Expediente V2 (se hacen en D-2).
- Migración del expediente productivo (`/expediente-maestro`).

---

**Esperando aprobación para ejecutar D-1.** Si quieres ajustes (ej. crear `clientes_maestro` aparte, agregar campos, cambiar RLS, otra estrategia de bitácora vs historial), indícalo y replanteo antes de tocar la base.
