# Auditoría Funcional Total por Roles — NUVEX

Este trabajo es **muy amplio** (8 roles × 10 dimensiones). Para no consumir créditos innecesarios ni romper lo que ya funciona, propongo ejecutarlo en **fases independientes y aprobables**, no todo en un mismo turno.

---

## Fase 0 — Acuerdo de alcance (antes de tocar código)

Confirmar contigo:
1. ¿Tengo usuarios de prueba ya creados para cada rol (Gerencia, Contabilidad, Jurídica, Operaciones, Director QA, Apoderado)? Si no, los creo en el primer paso.
2. ¿Quieres que el reporte de auditoría se genere como **archivo descargable** (Markdown/PDF en `/mnt/documents`) o como mensaje en chat?
3. ¿"Cliente" existe como rol activo hoy? (no lo veo en `app_role`).

---

## Fase 1 — Reporte de diagnóstico (SIN tocar código)

Entrega: `auditoria-nuvex-fase1.md` en `/mnt/documents`.

Por cada rol reviso de forma estática (código + RLS + rutas):

| Dimensión | Qué reviso |
|---|---|
| Login / estados | `login.tsx`, `pendiente-aprobacion.tsx`, `mfa-verificar.tsx`, hooks de auth |
| Perfil + avatar | `mi-perfil.tsx`, `UserAvatar`, render en topbar / directorio / colab / DM |
| Menú/rutas permitidas | `_authenticated.tsx`, sidebar, guardas por rol en cada route file |
| Acceso por URL directa | guardas en cada `_authenticated/*.tsx` vs matriz de permisos pedida |
| Notificaciones | `NotificationBell`, `notificaciones.tsx`, `useNotificaciones` |
| DM | `colaboracion.dm.*`, RLS de `colab_*` |
| Colaboración | `MensajeriaView`, canales, menciones |
| Academia | `academia_rol_del_usuario`, RLS `academia_*` |
| NUVEX GPT/IA | `nuvex-gpt.tsx`, permisos del panel |
| Módulo Apoderados | acceso restringido a Super Admin (+ Gerencia con flag) |

Salida estructurada por rol:
```
ROL: Contabilidad
✅ Funciona: [...]
❌ Falla: ruta X, permiso Y, botón Z
🔧 Causa raíz probable: [...]
```

**No se modifica código en esta fase.** Tú lees, priorizas y apruebas qué correcciones aplico en Fase 2.

---

## Fase 2 — Correcciones transversales (en lotes pequeños)

Una vez aprobado el reporte, agrupo los hallazgos en **lotes temáticos** y los aplico **uno por turno** (no todo junto):

1. **Lote A — Guardas de ruta y menú** (matriz de permisos uniforme por rol)
2. **Lote B — Perfil + avatar** (consistencia en todos los puntos de render)
3. **Lote C — Notificaciones** (clicks muertos, badges fantasma, detalle)
4. **Lote D — DM + Colaboración** (404s, RLS, contadores)
5. **Lote E — Estados de usuario** (PENDIENTE, BLOQUEADO, DESVINCULADO)
6. **Lote F — Academia + NUVEX GPT** (acceso por rol)

Cada lote: causa raíz → fix → archivos tocados → cómo probarlo.

**Restricciones que respeto:** no toco lógica financiera, simuladores, OCR, cálculos, PDFs, documentos jurídicos, ni creo módulos nuevos.

---

## Fase 3 — Validación

Por cada lote corregido entrego:
- Lista de rutas/archivos modificados
- Checklist de prueba que tú ejecutas con cada usuario real
- Reporte final consolidado en `/mnt/documents/auditoria-nuvex-final.md`

---

## ¿Por qué fases y no "todo de una"?

- Hacer las ~80 verificaciones + correcciones en un único turno es inviable: rompería cosas funcionando, consumiría muchos créditos y sería imposible de revisar.
- Con fases, **tú apruebas qué se corrige** y validamos cada lote antes de seguir.

---

## Mi propuesta concreta para el siguiente turno

Si apruebas este plan, **arranco con Fase 1**: genero el reporte de diagnóstico completo (sin modificar código) y te lo dejo como archivo descargable. A partir de ahí decides qué lote de Fase 2 ejecuto primero.
