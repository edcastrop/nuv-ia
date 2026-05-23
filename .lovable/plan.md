## Expediente Maestro NUVEX — Nuevo módulo

Crear un módulo independiente que centraliza toda la información maestra del cliente. **Cero cambios** en simuladores, OCR, PDFs, Resultado Final, Cuenta de Cobro y Paz y Salvo.

### Alcance

Un único registro maestro por `cedula` (o por cliente) que almacena:

1. **Datos Cliente** — nombre, cédula, expedida en, fecha nacimiento, estado civil, profesión, teléfono, email, dirección, ciudad.
2. **Datos Cotitular** — mismos campos + parentesco/relación + activo (sí/no).
3. **Datos Crédito** — banco, número de crédito, tipo de producto (pesos/UVR), fecha desembolso, plazo original, saldo capital, cuota actual, tasa, cuotas pagadas, cuotas pendientes.
4. **Datos Fresh / Cobertura** — tipoBeneficio, valorMensual, tasa, cuotasTotales (default 84), cuotasPagadas, cuotasPendientes, beneficioRecibido, beneficioRestante, detectadoOCR, fuente, ultimaSincronizacion. Reutiliza `src/lib/cobertura.ts` (sin tocarlo).
5. **Datos Asesor** — nombre, cédula, teléfono, email, código asesor.
6. **Datos Licenciado** — nombre, cédula profesional, teléfono, email.
7. **Datos Apoderado** — nombre, cédula, teléfono, email, dirección, ciudad, número de poder, fecha poder.

### Persistencia

Tabla nueva `expediente_maestro` (independiente de `expedientes`):

```text
expediente_maestro
├── id uuid PK
├── asesor_id uuid (RLS owner)
├── cedula_cliente text (búsqueda)
├── nombre_cliente text
├── cliente jsonb
├── cotitular jsonb
├── credito jsonb
├── fresh jsonb
├── asesor jsonb
├── licenciado jsonb
├── apoderado jsonb
├── created_at / updated_at
```

RLS idéntica al patrón de `expedientes` (owner + admin + gerencia). Trigger `update_updated_at_column` reutilizado.

### UI

Ruta nueva `/_authenticated/expediente-maestro` + `/_authenticated/expediente-maestro.$id`:

- **Listado** con búsqueda por cédula/nombre y botón "Nuevo expediente maestro".
- **Editor** con 7 secciones colapsables (acordeón estilo NUVEX) usando los tokens existentes (`#445DA3`, `#84B98F`, `#242424`). Cada sección con su botón "Guardar sección" + un "Guardar todo" general.
- Enlace en el sidebar / navegación principal junto a "Casos".

Componentes nuevos (todos en `src/components/expediente-maestro/`, **sin tocar** `src/components/nuvex/*`):

- `MaestroLayout.tsx` (acordeón + header)
- `ClienteSection.tsx`
- `CotitularSection.tsx`
- `CreditoSection.tsx`
- `FreshSection.tsx` (usa `withFreshDerivados` de `src/lib/cobertura.ts`)
- `AsesorSection.tsx`
- `LicenciadoSection.tsx`
- `ApoderadoSection.tsx`

Hook + lib nuevos:

- `src/lib/expedienteMaestro.ts` — tipos + `listMaestros`, `getMaestro`, `upsertMaestro`, `deleteMaestro`.
- `src/hooks/useExpedienteMaestro.ts` — carga y guardado.

Rutas nuevas:

- `src/routes/_authenticated/expediente-maestro.index.tsx`
- `src/routes/_authenticated/expediente-maestro.$id.tsx`

### Migración SQL

```sql
create table public.expediente_maestro (
  id uuid primary key default gen_random_uuid(),
  asesor_id uuid not null,
  cedula_cliente text,
  nombre_cliente text not null default 'Sin nombre',
  cliente jsonb not null default '{}'::jsonb,
  cotitular jsonb not null default '{}'::jsonb,
  credito jsonb not null default '{}'::jsonb,
  fresh jsonb not null default '{}'::jsonb,
  asesor jsonb not null default '{}'::jsonb,
  licenciado jsonb not null default '{}'::jsonb,
  apoderado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.expediente_maestro (asesor_id);
create index on public.expediente_maestro (cedula_cliente);

alter table public.expediente_maestro enable row level security;

create policy "Maestro select por owner" on public.expediente_maestro
  for select using (auth.uid() = asesor_id or has_role(auth.uid(),'admin') or has_role(auth.uid(),'gerencia'));
create policy "Maestro insert por owner" on public.expediente_maestro
  for insert with check (auth.uid() = asesor_id);
create policy "Maestro update por owner" on public.expediente_maestro
  for update using (auth.uid() = asesor_id or has_role(auth.uid(),'admin') or has_role(auth.uid(),'gerencia'));
create policy "Maestro delete por owner" on public.expediente_maestro
  for delete using (auth.uid() = asesor_id or has_role(auth.uid(),'admin') or has_role(auth.uid(),'gerencia'));

create trigger trg_maestro_updated
  before update on public.expediente_maestro
  for each row execute function public.update_updated_at_column();
```

### Reglas de seguridad

- Cero `import` desde simuladores, PDFs, Resultado Final, Cuenta de Cobro o Paz y Salvo.
- Cero edición en `src/components/nuvex/*`, `src/lib/proyeccion.ts`, `src/lib/pdfExport.ts`, `src/lib/cobertura.ts` (sólo lectura).
- Cero cambio en RLS de tablas existentes.
- Sólo se agrega un enlace de navegación al menú; no se reemplaza ningún flujo actual.

### Entregables

1. Migración SQL (tabla + RLS + trigger).
2. Lib + hook + 8 componentes nuevos + 2 rutas nuevas.
3. Enlace de navegación al nuevo módulo.

Tras tu aprobación ejecuto la migración y luego escribo el código.