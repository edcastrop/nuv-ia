
# Gestión de Casos NUVEX

## 1. Backend (Lovable Cloud)

**Migración SQL:**

- `profiles` (id uuid PK = auth.users.id, nombre, email, created_at)
  - Trigger `on_auth_user_created` que inserta perfil al registrarse.
- `app_role` enum: `admin`, `asesor`
- `user_roles` (user_id, role) + función `has_role(uuid, app_role) security definer`
- `expediente_estado` enum: `SIMULADO`, `FIRMADO`, `RADICADO`, `APROBADO`, `FACTURADO`, `PAGADO`
- `expedientes`:
  - id uuid PK, asesor_id uuid (auth.users), modo ('pesos'|'uvr'),
  - cliente_nombre, cedula, banco, numero_credito, producto,
  - cliente_data jsonb (todos los campos de ClientData),
  - credito_data jsonb (inputs del simulador),
  - propuesta_data jsonb (recomendada efectiva: cuota, plazo, ahorros, honorarios, manual o auto),
  - honorarios_base numeric, honorarios_final numeric, descuento numeric,
  - estado expediente_estado default 'SIMULADO',
  - fecha_simulacion date default current_date,
  - aprobado_data jsonb null (datos del banco cuando se registra resultado final),
  - acertividad_global numeric null,
  - created_at, updated_at
- `expediente_historial` (id, expediente_id FK, estado_anterior, estado_nuevo, user_id, nota, created_at) — para auditoría.
- RLS: cada asesor solo ve sus expedientes (`asesor_id = auth.uid()`); admin ve todos vía `has_role`.

## 2. Autenticación

- Página `/login` (email+password + Google).
- Layout `_authenticated.tsx` que redirige a `/login` si no hay sesión.
- Hook `useAuth` con `onAuthStateChange` + `getSession`.
- Configurar Google OAuth con `configure_social_auth`.

## 3. UI / Rutas

```
/login                        público
/_authenticated
  /                           selector de modo (actual)
  /casos                      lista + buscador
  /casos/$id                  detalle: simulador precargado + estados + acciones
  /dashboard                  Dashboard gerencial
```

Buscador: nombre, cédula, # crédito, banco, estado (filtros combinables).

## 4. Integración con simuladores

- Botón **"Guardar expediente"** en `PesosSimulator` y `UVRSimulator` → crea/actualiza fila en `expedientes`.
- Al abrir `/casos/$id`, los simuladores se hidratan desde `cliente_data` + `credito_data` + `propuesta_data`.
- `ResultadoFinal` lee/escribe `aprobado_data` y `acertividad_global` directamente del expediente; ya no se reingresa nada.
- Selector de estado (botón con dropdown) actualiza `estado` y agrega fila en `expediente_historial`.

## 5. Dashboard Gerencial

KPIs (filtrables por rango de fecha y asesor si admin):
- Total expedientes por estado (funnel SIMULADO → PAGADO).
- Tasa de aprobación = APROBADO / RADICADO.
- Acertividad promedio (de los con aprobado_data).
- Honorarios facturados, pagados, pipeline.
- Top asesores (solo admin).

Gráficos con `recharts` (ya disponible).

## 6. Server Functions

`src/lib/expedientes.functions.ts` — todo protegido con `requireSupabaseAuth`:
- `listExpedientes({ search, estado })`
- `getExpediente({ id })`
- `upsertExpediente(payload)`
- `updateEstado({ id, estado, nota })`
- `setAprobado({ id, aprobado, acertividad })`
- `getDashboardMetrics({ from, to })`

Verificar `attachSupabaseAuth` en `src/start.ts`.

## 7. Archivos a crear

- `src/lib/expedientes.functions.ts`
- `src/lib/expedientes.types.ts`
- `src/hooks/useAuth.ts`
- `src/routes/login.tsx`
- `src/routes/_authenticated.tsx`
- `src/routes/_authenticated/index.tsx` (mover home actual)
- `src/routes/_authenticated/casos.tsx`
- `src/routes/_authenticated/casos.$id.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/nuvex/CasosList.tsx`
- `src/components/nuvex/CasoEstadoBadge.tsx`
- `src/components/nuvex/DashboardGerencial.tsx`
- `src/components/nuvex/SaveExpedienteButton.tsx`

## 8. Modificaciones

- `src/components/nuvex/PesosSimulator.tsx`, `UVRSimulator.tsx`: aceptar prop `initialExpediente`, agregar botón guardar.
- `src/components/nuvex/ResultadoFinal.tsx`: persistir aprobado en expediente cuando hay `expedienteId`.
- `src/routes/index.tsx`: eliminado/reducido — la home queda en `_authenticated/index.tsx`.
- `src/start.ts`: añadir `attachSupabaseAuth` a `functionMiddleware`.

## Detalles técnicos

- Cálculos financieros se mantienen en cliente; sólo persistimos resultado serializado.
- Honorarios mínimos ($2M base / $1.8M final) ya se aplican en `lib/finance.ts` y `DiscountModule`.
- PDF se regenera en cliente al abrir el expediente (no se almacena).
- Acertividad guardada como número 0–100; el desglose se recalcula desde `propuesta_data` vs `aprobado_data`.
