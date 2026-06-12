---
name: KPI / monto sobre fondo oscuro
description: Valores numéricos (montos, %) en cards/botones oscuros deben ir en blanco; el color "accent" va sólo en borde/icono/label
type: design
---
En módulos NUVIA dark, los KPI cards y los botones del Generador de Ofertas (Motor Honorarios) DEBEN renderizar el valor numérico en `#FFFFFF` (o `var(--nuvia-text-primary)`).
- Nunca usar el color de acento (#445DA3, #D97706, #7C3AED, etc.) como `color:` del texto principal sobre `rgba(255,255,255,0.03)` — queda ilegible.
- El acento se aplica como: barra lateral 3px, icono pequeño, o borde de la card highlight.
- Aplica a `Kpi`, `Mini`, botones de ofertas y cualquier tarjeta nueva sobre `COLORS.panel`.

**How to apply:** revisar todo `style={{ color: accent }}` en value text → cambiarlo a `"#FFFFFF"` y mover el accent a un span lateral o al icono.
