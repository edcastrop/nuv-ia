---
name: Roles analistas NUVIA
description: Analistas comerciales NUVIA usan rol asesor; no normalizar ni crear como licenciado
type: feature
---

Los analistas comerciales NUVIA deben manejarse con rol `asesor`, no `licenciado`.

Reglas:
- No crear analistas comerciales nuevos como `licenciado`.
- Si una cuenta tiene `asesor` + `licenciado` por datos históricos, la app debe resolverla como `asesor`.
- No usar `licenciado` como sinónimo visual/operativo de analista comercial.
- Antes de eliminar `licenciado` en cuentas existentes que solo tengan ese rol, confirmar si son realmente analistas comerciales o si ese rol representa otro perfil operativo.