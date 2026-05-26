## NUVEX IA OPERATIVA — Nuevo módulo

Voy a crear un módulo de IA conversacional que consulta datos reales de la plataforma respetando roles.

### Arquitectura

**Frontend** (`src/routes/_authenticated/nuvex-ia.tsx`):
- Hero con título "NUVEX IA OPERATIVA" + subtítulo
- Caja grande de consulta (textarea + botón enviar) con placeholder rotativo de ejemplos
- Grid de **Métricas IA** (6 KPIs: casos activos, aprobados, honorarios pendientes, facturación mes, comisiones pendientes, estancados)
- Panel **Alertas Inteligentes** (lista detectada por reglas SQL)
- Sugerencias rápidas (chips clickeables con preguntas frecuentes según el rol)
- Historial de la conversación con respuestas en markdown + tabla cuando aplique
- Estilo: glassmorphism + azul oscuro `#050814 / #0A1226`, gradientes azul→verde como el resto del sistema

**Backend** (`src/lib/nuvex-ia.functions.ts` con `requireSupabaseAuth`):
1. `getMetricasIA` — consultas SQL agregadas filtradas por rol
2. `getAlertasInteligentes` — reglas: sin movimiento 15d, expedientes incompletos, honorarios vencidos, cuentas cobro pendientes, aprobados sin factura, facturados sin pago
3. `consultarIA` — recibe la pregunta, clasifica intención con Lovable AI (Gemini), ejecuta query estructurada en Supabase con el cliente autenticado (RLS aplica), y devuelve respuesta + datos tabulares

**Flujo de la IA**:
- Paso 1: LLM clasifica la pregunta en un intent JSON (`{categoria: "casos"|"expedientes"|..., filtros: {...}}`) usando tool-calling (structured output).
- Paso 2: el server ejecuta la query Supabase correspondiente (RLS + filtros por rol asegura seguridad).
- Paso 3: LLM redacta respuesta natural con los datos reales (no inventa; si datos vacíos → "No encontré información suficiente…").

### Sidebar
Agregar entrada **"NUVEX IA"** con ícono `Sparkles` en la sección "Operación" de `_authenticated.tsx`, visible para todos los roles operativos (apoderado excluido).

### Seguridad
- Server function usa `requireSupabaseAuth` → RLS de Supabase aplica automáticamente al rol del usuario.
- Adicionalmente filtramos por `useUserRole`: licenciado solo ve sus casos/comisiones/cartera, contabilidad solo financiero, jurídico solo jurídico, gerencia/admin todo.
- Prompt del sistema instruye no inventar y solo usar datos provistos.

### Archivos
- **Crear**: `src/routes/_authenticated/nuvex-ia.tsx`, `src/lib/nuvex-ia.functions.ts`
- **Editar**: `src/routes/_authenticated.tsx` (agregar item de menú)

¿Apruebas el plan?
