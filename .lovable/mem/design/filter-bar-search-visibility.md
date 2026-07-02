---
name: Filter bar search visibility
description: En barras de filtros con múltiples selects, el input de búsqueda debe llevar basis + min-width y el contenedor flex-wrap para que no colapse a 0px
type: design
---
Regla NUVIA para toolbars con `<input search>` + varios `<select>`/GlassSelect en la misma fila:

- El contenedor debe ser `flex flex-wrap items-center gap-2` (nunca `md:flex-row` sin wrap cuando hay >3 controles con `min-w` fijo).
- El wrapper del input de búsqueda debe declarar `flex-1 basis-full md:basis-[280px] min-w-[240px]` — un `flex-1 min-w-0` colapsa a 0 cuando los selects hermanos tienen `min-w-[130px]` y el ancho total excede el contenedor (los selects ganan por min-content, el input se comprime a 0 y desaparece).
- El input debe tener borde propio (`border 1px BORDER`) para que sea visible cuando queda solo en la fila.

Aplica a `src/routes/_authenticated/casos.index.tsx` y cualquier futura barra de filtros del Command Center. Regresión reportada: analistas no podían usar el buscador porque el input colapsaba tras los 5 GlassSelects.
