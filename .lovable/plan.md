## Sistema PDF NUVEX 2026

Construir un **sistema unificado** del que hereden los 6 documentos, en vez de rediseñar uno por uno. Dos familias visuales, una misma infraestructura.

---

### 1. Núcleo del sistema (`src/lib/pdf/`)

Nuevo módulo central:

- **`PdfShell.tsx`** — componente React reutilizable con slots: `<PdfShell variant="commercial|operational" header={...} watermark>{children}</PdfShell>`. Gestiona página A4, márgenes seguros (40/50/40/40), paginación, footer institucional.
- **`PdfHeader.tsx`** — Header Premium: logo NUVEX × 2.5, "NUVEX Finanzas Inteligentes", "Bogotá | Bucaramanga", fecha, nombre cliente. Variante comercial (banda azul + acento verde) y operativa (sobria, azul institucional).
- **`PdfWatermark.tsx`** — logo NUVEX al 5% opacidad, centrado, rotado, detrás del contenido.
- **`pdfTheme.ts`** — tokens (azul `#445DA3`, verde `#84B98F`, negro `#242424`), tipografía display vs body, escalas comerciales vs operativas.
- **`pdfValidator.ts`** — endurece el `validatePdfLayout` actual: bloquea exportación si hay overflow, logo ausente, gráficos cortados, márgenes rotos. Reporta issues al usuario con toast antes de descargar.

### 2. Familia Comercial (Wealth Management feel)

#### Propuesta Financiera (nuevo `src/components/nuvex/PropuestaFinanciera.tsx`)

```text
PÁG 1 — HERO
┌──────────────────────────────────┐
│  RECUPERA                        │
│  [ X ] AÑOS                      │ ← display ~120pt
│  DE TU VIDA FINANCIERA           │
│                                  │
│  Ahorro Total │ Nueva Cuota │ Cuotas Eliminadas
│                                  │
│  Línea de tiempo ANTES → DESPUÉS │
└──────────────────────────────────┘

PÁG 2 — HOY vs CON NUVEX (3 tarjetas: cuota, tiempo, total)
PÁG 3 — Composición del ahorro (donut: intereses / seguros / total)
PÁG 4 — Inversión por éxito (honorarios como inversión + disclaimer)
```

#### Resultado Final (rediseño de `ResultadoFinal.tsx`)

Formato **certificación premium**: ANTES → DESPUÉS (fechas), años eliminados, ahorro, nueva cuota, acertividad, gráfico de cumplimiento (barra/medidor).

### 3. Familia Operativa (corporativo sobrio)

Aplicar `PdfShell variant="operational"` con header institucional + watermark al 5% a:

- Cuenta de Cobro (en `legalDocsExport`)
- Paz y Salvo (`PazYSalvo.tsx`)
- Poder (`poderTemplates` → render)
- Datos para Contrato

**No** se cambia la lógica de negocio ni los campos; solo el chrome visual (header, tipografía, jerarquía, azul NUVEX más presente, logo más grande).

### 4. Validación obligatoria pre-export

`exportElementToPdf` se envuelve en `exportPdfSafely(id, filename)`:

1. Ejecuta `pdfValidator` → si hay issues bloqueantes, muestra toast con la lista y **cancela**.
2. Verifica que el `<img>` del logo cargó (`naturalWidth > 0`).
3. Espera a que canvases/gráficos terminen de pintar.
4. Solo entonces renderiza con html2canvas.

### 5. Orden de entrega sugerido

1. Núcleo (`PdfShell`, `PdfHeader`, `PdfWatermark`, `pdfTheme`, validador endurecido).
2. Propuesta Financiera (nueva).
3. Resultado Final (rediseño con shell comercial).
4. Migrar los 4 operativos al `PdfShell` operativo.
5. QA visual de los 6 PDFs (export real + revisión página por página).

---

### Detalles técnicos

- Sigue usando `html2canvas-pro` + `jspdf` (ya funcionan en el stack).
- Donut chart con SVG inline (sin dependencias nuevas).
- Tipografía: mantener system stack actual; los "display" se logran con `font-weight: 800` + `letter-spacing: -0.04em` + tamaños 96–120pt.
- Watermark: `<img>` con `position:absolute; inset:0; opacity:0.05; transform:rotate(-30deg); object-fit:contain;` dentro de cada `.nuvex-print-page`.
- No se tocan: simuladores, OCR, Expediente Maestro (lógica), Cartera, roles, automatizaciones — solo la capa de presentación PDF.

### Preguntas antes de empezar

1. **Alcance de este turno**: ¿implemento el plan completo (5 pasos) o prefieres que entregue primero el **núcleo + Propuesta Financiera** y revisamos antes de seguir? Recomiendo lo segundo: la Propuesta es la pieza que más mueve cierres y conviene validarla visualmente antes de propagar el sistema.

2. **Datos de la Propuesta**: los campos "años recuperados", "ahorro total", "cuotas eliminadas", "fecha estimada antes/después" — ¿ya están todos calculados en el simulador actual o necesito derivar alguno nuevo?
