# Auditoría funcional — Equipo de analistas

## Objetivo
Recorrer cada herramienta que un analista usa para producir un caso, detectar bugs que rompen flujo y corregirlos sin tocar lógica que ya validamos juntos (poderes PDF, propuesta comercial, parsers Davivienda/Davibank/Bogotá/Caja Social, honorarios, capacidad de pago, proyección UVR, reasignación).

## Roles en producción
`asesor` (2), `licenciado` (6), `director_financiero_qa` (3), `gerencia` (2), `contabilidad` (1), `super_admin` (1). La auditoría se enfoca en **asesor + licenciado** (analistas) y verifica que `director_financiero_qa` y `gerencia` no pierdan visibilidad.

## Alcance — herramientas del analista
1. **Casos / Pipeline** (`/casos`, `/pipeline`, `/pipeline-v2`) — listado, filtros "Mis casos", avatar doble analista, reasignación.
2. **Expediente** (`/casos/$id`, `/expediente-maestro/$id`, `/expediente-v2/$id`) — stepper 13 pasos, bitácora, checklist, validaciones, soportes, historial.
3. **Motor de Extractos** (`MotorExtractosNUVEX`, parsers banco) — lectura, modal moneda, override, agregados de seguros.
4. **Simuladores Pesos / UVR** y **Propuestas comerciales** — evento `nuvex:recomendada-change`, persistencia.
5. **Análisis de Capacidad de Pago** — sincronía con cuota viva (ya corregido — verificar regresiones).
6. **Motor de Honorarios** — tiers nuevos (6/4/3/2.5/UVR 3%).
7. **Proyección financiera** (`/proyeccion`, `/proyeccion-financiera`, `/herramientas/proyeccion`) — UVR + inflación, export PDF.
8. **Propuesta comercial PDF** (`PrintDocument`) — colores, seguros pagados/pendientes, IPC por moneda/producto.
9. **Poderes / Documentos jurídicos** — header/footer negro, justificado, negrillas, cédulas con puntos.
10. **NUVIA IA / KB** (`/nuvex-ia`) — rate limit, Zod, similarity, audiencias.
11. **Colaboración, mensajería, notificaciones** — acceso por rol.
12. **Gestión de usuarios** (`/gestion-usuarios`) — reasignación de casos.

## Método
Por cada módulo:
- **Estático**: revisar route + componentes para imports rotos, `useEffect` con dependencias incorrectas, props no propagadas, RLS implícita (`asesor_id === user.id`).
- **Datos**: consultar Supabase para detectar filas huérfanas, FKs rotas, casos sin `asesor_id`, propuestas desincronizadas con `analisis_capacidad_pago`.
- **Build/Types**: typecheck dirigido a archivos tocados.
- **Runtime**: logs del worker filtrados por endpoint del módulo cuando aplique.

## Entregable
1. **Informe en chat** agrupado por módulo: severidad (bloqueante / alto / medio), causa raíz, archivo:línea.
2. **Fixes aplicados en la misma tanda** para todo lo bloqueante y alto. Lo medio queda listado para que tú decidas.
3. **Verificación**: build limpio + spot-check con Playwright en `/casos`, `/casos/$id` y un simulador para confirmar que nada de lo ya validado se rompió.

## Reglas que respeto
- No re-diseño UI ya aprobada (PDF poder, propuesta comercial, header dark NUVIA).
- No toco `client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts`.
- Cualquier cambio de RLS o GRANT pasa por migración con bloque completo.
- Si un hallazgo cambia comportamiento de negocio (ej. fórmula, % endeudamiento, regla bancaria), te pregunto antes de tocarlo.

## Detalles técnicos (referencia)
- `casos.index.tsx`: filtro "Mis casos" usa `asesor_id === user.id`; verificar que `licenciado` también pueda filtrar por sus casos asignados.
- `expediente-maestro.$id.tsx`: estado `asesor`/`licenciado` viene de `expediente.asesor`/`.licenciado` (jsonb), no de `user_roles` — confirmar que no se sobreescriben al recargar.
- `AnalisisCapacidadPagoBlock`: cuota viva ya escucha `nuvex:recomendada-change` — validar que el evento se dispara también desde `expediente-v2`.
- `motorExtractos.functions.ts`: validar que el normalizador Davibank no genere falsos positivos para Davivienda real.
- Honorarios: confirmar que los tiers nuevos se usan en propuesta comercial y en cuentas de cobro.

## Lo que NO está en este alcance
- Rediseño visual.
- Cambios a Finanzas / Treasury / Wallet / Contabilidad (no son herramientas del analista).
- Auditoría de seguridad / RLS profunda (esa es la opción "Ambas" — la pediste aparte si quieres).
