// Generadores de documentos jurídicos (Poder Especial y Contrato de Prestación
// de Servicios) a partir del Expediente Maestro. Cero dependencias en
// simuladores, OCR, PDFs comerciales ni módulos existentes.
//
// El modelo de bloques es agnóstico al renderizador: tanto el exportador PDF
// como el DOCX consumen el mismo árbol, garantizando que el documento siempre
// refleje el estado actual del expediente.

import type { ExpedienteMaestro } from "./expedienteMaestro";
import type { Expediente, PropuestaData } from "./expedientes";
import {
  detectPoderTemplate, renderPoderTemplate, validatePoderVariables, calidadFor,
  type PoderTemplateId, type PoderVariables, type CalidadCliente,
} from "./poderTemplates";

export type DocBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "spacer"; size?: number }
  | { type: "section"; text: string } // encabezado de tabla en Datos para Contrato
  | { type: "field"; label: string; value: string } // fila clave/valor
  | {
      type: "signature";
      columns: { label: string; name?: string; cc?: string }[];
    };

export interface LegalDoc {
  filename: string;
  title: string;
  blocks: DocBlock[];
  /** Issues de validación detectados (campos faltantes, inconsistencias matemáticas, etc.). */
  validationIssues?: string[];
  /** Consecutivo documental NUVEX para PDFs operativos (Poder, Datos Contrato). */
  consecutivo?: string;
}

const hoy = () =>
  new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const safe = (v?: string | null) => (v && v.trim() ? v.trim() : "_______________");

const fullName = (n?: string) => safe(n).toUpperCase();

const ciudadFmt = (c?: string) => (c && c.trim() ? c.trim() : "Bogotá D.C.");

const fmtCOP = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? Number(n.replace(/[^\d.-]/g, "")) : Number(n ?? 0);
  if (!isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
};

const fmtTxt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};


// ─────────────────────────────────────────────────────────────────────────────
// PODER ESPECIAL — basado en PLANTILLAS JURÍDICAS pre-aprobadas (sin IA).
// ─────────────────────────────────────────────────────────────────────────────

export interface ApoderadoSeleccionado {
  nombre: string;
  cedula: string;
  lugarExpedicion?: string | null;
  ciudad?: string | null;
  celular?: string | null;
}

/** Persona (titular o cotitular) que firma como poderdante. */
export interface PoderdanteInput {
  nombre: string;
  cedula: string;
  lugarExpedicion: string;
  ciudad: string;
  calidad: CalidadCliente; // Titular / Cotitular / Locatario / Colocatario
}

export interface BuildPoderInput {
  banco: string;
  producto: string;
  numeroCredito: string;
  poderdante: PoderdanteInput;
  apoderado: ApoderadoSeleccionado;
  templateOverride?: PoderTemplateId;
}

export interface PoderResult {
  doc: LegalDoc;
  templateId: PoderTemplateId;
  missing: string[]; // campos faltantes (vacío si OK)
}

function toVariables(i: BuildPoderInput): PoderVariables {
  const a = i.apoderado;
  const p = i.poderdante;
  return {
    BANCO: (i.banco || "").toUpperCase(),
    NOMBRE_CLIENTE: (p.nombre || "").toUpperCase(),
    CEDULA_CLIENTE: p.cedula || "",
    CIUDAD_CLIENTE: ciudadFmt(p.ciudad),
    LUGAR_EXPEDICION_CLIENTE: p.lugarExpedicion || "",
    TIPO_PRODUCTO: i.producto || "",
    CALIDAD_CLIENTE: p.calidad,
    NUMERO_CREDITO: i.numeroCredito || "",
    NOMBRE_APODERADO: (a.nombre || "").toUpperCase(),
    CEDULA_APODERADO: a.cedula || "",
    LUGAR_EXPEDICION_APODERADO: a.lugarExpedicion || "",
    CELULAR_APODERADO: a.celular || "",
    CIUDAD_APODERADO: a.ciudad || "",
    FECHA: hoy(),
  };
}

/** Construye UN poder para el poderdante indicado (titular o cotitular). */
export function buildPoderFromTemplate(i: BuildPoderInput): PoderResult {
  const templateId = i.templateOverride ?? detectPoderTemplate(i.banco, i.producto);
  const vars = toVariables(i);
  const missing = validatePoderVariables(vars, templateId);
  const legalBlocks = renderPoderTemplate(templateId, vars);

  // Bloque DATOS DEL CLIENTE — se inserta ANTES del texto jurídico.
  const datosCliente: DocBlock[] = [
    { type: "section", text: "DATOS DEL CLIENTE" },
    { type: "field", label: "Nombre", value: fmtTxt(i.poderdante.nombre) },
    { type: "field", label: "Cédula", value: fmtTxt(i.poderdante.cedula) },
    { type: "field", label: "Banco", value: fmtTxt(i.banco) },
    { type: "field", label: "Producto", value: fmtTxt(i.producto) },
    { type: "field", label: "Número crédito", value: fmtTxt(i.numeroCredito) },
    { type: "spacer", size: 12 },
  ];
  const blocks: DocBlock[] = [...datosCliente, ...legalBlocks];

  const safeName = (i.poderdante.nombre || "Cliente").replace(/\s+/g, "_");
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-4);
  const consecutivo = `NUVEX-PE-${year}-${seq}`;
  return {
    templateId,
    missing,
    doc: {
      filename: `Poder_Especial_${i.poderdante.calidad}_${safeName}`,
      title: `Poder Especial — ${i.poderdante.calidad}`,
      blocks,
      consecutivo,
      validationIssues: missing.length > 0 ? missing.map((m) => `Falta: ${m}`) : undefined,
    },
  };
}

/**
 * Devuelve uno o dos poderes (titular y cotitular si está activo) listos para
 * generar. Para Leasing usa las calidades Locatario / Colocatario automáticamente.
 */
export function buildPoderesForExpediente(
  e: ExpedienteMaestro,
  apoderado: ApoderadoSeleccionado,
  templateOverride?: PoderTemplateId,
): PoderResult[] {
  const cr = e.credito;
  const c = e.cliente;
  const banco = cr.banco;
  const producto = cr.tipoProducto;
  const numeroCredito = cr.numeroCredito;

  const out: PoderResult[] = [];
  out.push(
    buildPoderFromTemplate({
      banco, producto, numeroCredito, apoderado, templateOverride,
      poderdante: {
        nombre: c.nombre,
        cedula: c.cedula,
        lugarExpedicion: c.expedidaEn,
        ciudad: c.ciudad,
        calidad: calidadFor(producto, false),
      },
    }),
  );

  const co = e.cotitular;
  if (co?.activo && (co.nombre || co.cedula)) {
    out.push(
      buildPoderFromTemplate({
        banco, producto, numeroCredito, apoderado, templateOverride,
        poderdante: {
          nombre: co.nombre,
          cedula: co.cedula,
          lugarExpedicion: co.expedidaEn,
          ciudad: co.ciudad || c.ciudad,
          calidad: calidadFor(producto, true),
        },
      }),
    );
  }
  return out;
}

/** Compat: una sola firma legacy usada por componentes existentes. */
export function buildPoderEspecial(
  e: ExpedienteMaestro,
  apOverride?: ApoderadoSeleccionado,
  templateOverride?: PoderTemplateId,
): LegalDoc {
  const ap: ApoderadoSeleccionado = apOverride ?? {
    nombre: e.apoderado?.nombre ?? "",
    cedula: e.apoderado?.cedula ?? "",
    lugarExpedicion: null,
    ciudad: e.apoderado?.ciudad ?? null,
    celular: e.apoderado?.telefono ?? "",
  };
  const list = buildPoderesForExpediente(e, ap, templateOverride);
  return list[0]?.doc ?? {
    filename: "Poder_Especial",
    title: "Poder Especial",
    blocks: [{ type: "paragraph", text: "Sin datos suficientes." }],
  };
}

// Re-export para que los componentes UI puedan importar desde un único lugar.
export { detectPoderTemplate } from "./poderTemplates";
export type { PoderTemplateId, CalidadCliente } from "./poderTemplates";

// ─────────────────────────────────────────────────────────────────────────────
// DATOS PARA CONTRATO (tabla contractual descargable)
// ─────────────────────────────────────────────────────────────────────────────

export type ModalidadPago = "contado" | "financiado";

export interface AcuerdoComercial {
  modalidad: ModalidadPago;
  /** Valor de cada cuota (en pesos), sólo cuando modalidad = "financiado". */
  cuotas?: number[];
}

const toNum = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return isFinite(n) ? n : 0;
  }
  return 0;
};

export function buildDatosContrato(
  e: ExpedienteMaestro,
  sim?: Expediente | null,
  acuerdo?: AcuerdoComercial,
): LegalDoc {
  const c = e.cliente;
  const cr = e.credito;
  const propuesta: PropuestaData | Record<string, never> = (sim?.propuesta_data ?? {}) as PropuestaData | Record<string, never>;
  const p = propuesta as Partial<PropuestaData>;

  // Cuotas eliminadas estimadas: cuotas pendientes originales - nuevo plazo
  const cuotasPendientes = Number(cr.cuotasPagadas ? Number(cr.plazoOriginal) - Number(cr.cuotasPagadas) : 0) || 0;
  const cuotasEliminadas =
    p.añosEliminados !== undefined && p.nuevoPlazo !== undefined && cuotasPendientes > 0
      ? Math.max(0, cuotasPendientes - Number(p.nuevoPlazo))
      : null;

  // Fuente única de verdad para honorarios a cobrar (recalculado > con descuento > base)
  const honorarios = honorariosFinalesCliente(sim ?? null);

  // ── BENEFICIO DE COBERTURA: leer desde el simulador (cliente_data.cobertura)
  const cob = sim?.cliente_data?.cobertura;
  const cobActivo = !!(cob && (cob.activo || cob.valorCobertura || cob.tasaCobertura));

  const cuotaSinCob = cob?.cuotaConInteresSinSeguros
    ? toNum(cob.cuotaConInteresSinSeguros)
    : toNum(cr.cuotaActual);
  const cuotaConCob = cob?.cuotaPagadaCliente
    ? toNum(cob.cuotaPagadaCliente)
    : Math.max(0, cuotaSinCob - toNum(cob?.valorCobertura));

  // Derivados de cuotas de cobertura (tope 84 — alineado con FRESH_DEFAULT_TOTAL)
  const cuotasPagadasCred = toNum(cr.cuotasPagadas);
  const cobTotal = 84;
  const cobPagadas = Math.min(Math.max(0, Math.round(cuotasPagadasCred)), cobTotal);
  const cobPendientes = Math.max(0, cobTotal - cobPagadas);

  // ── ACUERDO COMERCIAL
  const ac: AcuerdoComercial = acuerdo ?? { modalidad: "contado" };
  const sumaCuotas = (ac.cuotas ?? []).reduce((a, b) => a + (Number(b) || 0), 0);
  const saldo = honorarios - sumaCuotas;

  // Validación matemática: cuotaSinCob - valorCobertura ≈ cuotaConCob
  const valorCob = toNum(cob?.valorCobertura);
  const coberturaMathOk =
    !cobActivo || Math.abs(cuotaSinCob - valorCob - cuotaConCob) <= 1;

  const blocks: DocBlock[] = [
    { type: "title", text: "FICHA CONTRACTUAL NUVEX" },
    { type: "subtitle", text: "Información base para elaboración del contrato de prestación de servicios." },
    { type: "spacer", size: 6 },
    { type: "paragraph", text: `Cliente: ${fullName(c.nombre)} · Entidad: ${safe(cr.banco).toUpperCase()} · Generado el ${hoy()}.` },
    { type: "spacer", size: 10 },

    { type: "section", text: "1. CLIENTE" },
    { type: "field", label: "Nombre completo", value: fmtTxt(c.nombre) },
    { type: "field", label: "Documento", value: `${c.tipoDocumento || "CC"} ${fmtTxt(c.cedula)}${c.expedidaEn ? ` de ${c.expedidaEn}` : ""}` },
    { type: "field", label: "Ciudad de residencia", value: fmtTxt(c.ciudad) },
    { type: "field", label: "Correo", value: fmtTxt(c.email) },
    { type: "field", label: "Celular", value: fmtTxt(c.telefono) },
    { type: "spacer", size: 6 },

    { type: "section", text: "2. PRODUCTO FINANCIERO" },
    { type: "field", label: "Banco", value: fmtTxt(cr.banco) },
    { type: "field", label: "Producto", value: fmtTxt(cr.tipoProducto) },
    { type: "field", label: "Número de crédito", value: fmtTxt(cr.numeroCredito) },
    { type: "field", label: "Plazo original (meses)", value: fmtTxt(cr.plazoOriginal) },
    { type: "field", label: "Cuotas pagadas", value: fmtTxt(cr.cuotasPagadas) },
    { type: "field", label: "Cuota actual", value: fmtCOP(cr.cuotaActual) },
    { type: "spacer", size: 6 },

    { type: "section", text: "3. PROPUESTA ACEPTADA" },
    { type: "field", label: "Cuotas eliminadas", value: cuotasEliminadas !== null ? String(cuotasEliminadas) : "—" },
    { type: "field", label: "Nuevo plazo (meses)", value: fmtTxt(p.nuevoPlazo) },
    { type: "field", label: "Nueva cuota", value: fmtCOP(p.nuevaCuota) },
    { type: "spacer", size: 6 },

    { type: "section", text: "4. BENEFICIO DE COBERTURA" },
    ...(cobActivo
      ? ([
          { type: "field", label: "Tipo cobertura", value: fmtTxt(cob?.tipoBeneficio) } as DocBlock,
          { type: "field", label: "Valor cobertura mensual", value: fmtCOP(cob?.valorCobertura) } as DocBlock,
          { type: "field", label: "% tasa cobertura", value: cob?.tasaCobertura ? `${cob.tasaCobertura}%` : "No aplica" } as DocBlock,
          { type: "field", label: "Cuotas cobertura pagadas", value: String(cobPagadas) } as DocBlock,
          { type: "field", label: "Cuotas cobertura pendientes", value: String(cobPendientes) } as DocBlock,
          { type: "field", label: "Cuota actual con cobertura", value: fmtCOP(cuotaConCob) } as DocBlock,
          { type: "field", label: "Cuota actual sin cobertura", value: fmtCOP(cuotaSinCob) } as DocBlock,
          { type: "field", label: "Nueva cuota después de finalizar cobertura", value: fmtCOP(p.nuevaCuota) } as DocBlock,
        ])
      : ([{ type: "field", label: "Estado", value: "NO APLICA" } as DocBlock])),
    { type: "spacer", size: 6 },

    { type: "section", text: "5. HONORARIOS Y FORMA DE PAGO" },
    { type: "field", label: "Honorarios totales", value: fmtCOP(honorarios) },
    { type: "field", label: "Modalidad de pago", value: ac.modalidad === "contado" ? "Contado" : "Financiado" },
    ...(ac.modalidad === "contado"
      ? ([] as DocBlock[])
      : ([
          { type: "field", label: "Número de cuotas", value: String((ac.cuotas ?? []).length) } as DocBlock,
          ...((ac.cuotas ?? []).map((v, i) => ({
            type: "field" as const,
            label: `Cuota ${i + 1}`,
            value: fmtCOP(v),
          })) as DocBlock[]),
          { type: "field", label: "Suma cuotas", value: fmtCOP(sumaCuotas) } as DocBlock,
          {
            type: "field",
            label: "Saldo restante",
            value:
              saldo === 0
                ? "Cuadrado · $0"
                : saldo > 0
                  ? `Falta ${fmtCOP(saldo)}`
                  : `Excede en ${fmtCOP(Math.abs(saldo))}`,
          } as DocBlock,
        ])),
    { type: "spacer", size: 6 },

    { type: "section", text: "6. ASESOR RESPONSABLE" },
    { type: "field", label: "Nombre", value: fmtTxt(e.asesor?.nombre) },
    { type: "field", label: "Correo", value: fmtTxt(e.asesor?.email) },
    { type: "field", label: "Celular", value: fmtTxt(e.asesor?.telefono) },
  ];

  const issues: string[] = [];
  if (!coberturaMathOk) {
    issues.push(
      `Advertencia: dato pendiente de validación financiera — cuota sin cobertura (${fmtCOP(cuotaSinCob)}) − valor cobertura (${fmtCOP(valorCob)}) ≠ cuota con cobertura (${fmtCOP(cuotaConCob)}).`,
    );
  }
  if (!c.nombre) issues.push("Falta nombre del cliente.");
  if (!c.cedula) issues.push("Falta cédula del cliente.");
  if (!cr.banco) issues.push("Falta banco.");
  if (!cr.numeroCredito) issues.push("Falta número de crédito.");

  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-4);
  return {
    filename: `Ficha_Contractual_NUVEX_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Ficha Contractual NUVEX",
    blocks,
    consecutivo: `NUVEX-FC-${year}-${seq}`,
    validationIssues: issues,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO DE PRESTACIÓN DE SERVICIOS
// ─────────────────────────────────────────────────────────────────────────────

export function buildContratoServicios(e: ExpedienteMaestro): LegalDoc {
  const c = e.cliente;
  const lic = e.licenciado;
  const cr = e.credito;

  const blocks: DocBlock[] = [
    { type: "title", text: "CONTRATO DE PRESTACIÓN DE SERVICIOS" },
    { type: "subtitle", text: "Optimización de crédito hipotecario · NUVEX" },
    { type: "spacer", size: 12 },
    {
      type: "paragraph",
      text: `Entre los suscritos a saber:`,
    },
    {
      type: "paragraph",
      text:
        `Por una parte, ${fullName(c.nombre)}, mayor de edad, identificado(a) con cédula de ` +
        `ciudadanía No. ${safe(c.cedula)} expedida en ${safe(c.expedidaEn)}, ` +
        `con domicilio en ${ciudadFmt(c.ciudad)}, quien en adelante se denominará EL CLIENTE; y`,
    },
    {
      type: "paragraph",
      text:
        `Por la otra, ${fullName(lic.nombre)}, mayor de edad, identificado(a) con cédula ` +
        `profesional No. ${safe(lic.cedulaProfesional)}, en representación de NUVEX FINANZAS ` +
        `INTELIGENTES, quien en adelante se denominará EL PRESTADOR;`,
    },
    {
      type: "paragraph",
      text:
        "hemos convenido celebrar el presente Contrato de Prestación de Servicios, que se " +
        "regirá por las siguientes cláusulas:",
    },
    { type: "spacer" },

    { type: "heading", text: "PRIMERA. OBJETO." },
    {
      type: "paragraph",
      text:
        `EL PRESTADOR se obliga para con EL CLIENTE a prestar sus servicios profesionales de ` +
        `análisis, asesoría y gestión orientados a la optimización del crédito hipotecario ` +
        `identificado con el No. ${safe(cr.numeroCredito)} en ${safe(cr.banco).toUpperCase()} ` +
        `(producto ${safe(cr.tipoProducto)}), con el fin de obtener reducción de cuotas, ` +
        `intereses y/o plazo conforme a las condiciones del mercado.`,
    },
    { type: "spacer" },

    { type: "heading", text: "SEGUNDA. ALCANCE DEL SERVICIO." },
    {
      type: "paragraph",
      text:
        "EL PRESTADOR realizará: (i) análisis financiero del crédito vigente; (ii) elaboración " +
        "de la propuesta de optimización; (iii) acompañamiento en la radicación ante la entidad " +
        "financiera; (iv) seguimiento del trámite hasta la decisión bancaria; y (v) entrega de " +
        "documentos soporte.",
    },
    { type: "spacer" },

    { type: "heading", text: "TERCERA. HONORARIOS." },
    {
      type: "paragraph",
      text:
        "Los honorarios se causarán EXCLUSIVAMENTE en caso de éxito, entendido como la " +
        "aprobación por parte de la entidad financiera de la propuesta de optimización. El valor " +
        "de los honorarios y su forma de pago corresponderán a los acordados en la propuesta " +
        "comercial entregada por EL PRESTADOR y aceptada por EL CLIENTE.",
    },
    { type: "spacer" },

    { type: "heading", text: "CUARTA. OBLIGACIONES DEL CLIENTE." },
    {
      type: "paragraph",
      text:
        "EL CLIENTE se obliga a: (i) entregar la información veraz y completa sobre su crédito; " +
        "(ii) suscribir los poderes y documentos requeridos para la gestión; (iii) abstenerse de " +
        "adelantar trámites paralelos que afecten la gestión contratada; y (iv) pagar los " +
        "honorarios en los términos pactados una vez se verifique el éxito.",
    },
    { type: "spacer" },

    { type: "heading", text: "QUINTA. CONFIDENCIALIDAD Y TRATAMIENTO DE DATOS." },
    {
      type: "paragraph",
      text:
        "EL PRESTADOR garantiza la confidencialidad de la información entregada por EL CLIENTE " +
        "y su tratamiento conforme a la Ley 1581 de 2012 y demás normas concordantes, exclusivamente " +
        "para los fines del presente contrato.",
    },
    { type: "spacer" },

    { type: "heading", text: "SEXTA. VIGENCIA Y TERMINACIÓN." },
    {
      type: "paragraph",
      text:
        "El presente contrato tendrá vigencia desde su suscripción hasta la decisión final del " +
        "banco sobre la propuesta o hasta la terminación anticipada por mutuo acuerdo entre las partes.",
    },
    { type: "spacer" },

    { type: "heading", text: "SÉPTIMA. DOMICILIO CONTRACTUAL." },
    {
      type: "paragraph",
      text:
        `Para todos los efectos legales se fija como domicilio contractual la ciudad de ` +
        `${ciudadFmt(c.ciudad)}.`,
    },
    { type: "spacer", size: 12 },

    {
      type: "paragraph",
      text: `Para constancia se firma en ${ciudadFmt(c.ciudad)}, a los ${hoy()}.`,
    },
    { type: "spacer", size: 24 },
    {
      type: "signature",
      columns: [
        { label: "EL CLIENTE", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` },
        {
          label: "EL PRESTADOR",
          name: fullName(lic.nombre),
          cc: `C.P. ${safe(lic.cedulaProfesional)}`,
        },
      ],
    },
  ];

  return {
    filename: `Contrato_Servicios_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Contrato de Prestación de Servicios",
    blocks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO JURÍDICO — Documentos generados desde el Expediente Maestro
// ─────────────────────────────────────────────────────────────────────────────
//
// Todos los builders consumen exclusivamente datos almacenados en el expediente
// (cliente, crédito, apoderado, licenciado). Los parámetros "extra" representan
// información propia del caso jurídico puntual (motivo, fecha de negación, etc.)
// que NO existe en el expediente y que sólo se solicita una vez por documento.

export interface DerechoPeticionExtra {
  asunto: string;
  hechos: string;
  pretensiones: string;
}

export function buildDerechoPeticion(
  e: ExpedienteMaestro,
  extra: DerechoPeticionExtra,
): LegalDoc {
  const c = e.cliente;
  const cr = e.credito;
  const ap = e.apoderado;
  const usaApoderado = !!(ap?.nombre && ap.nombre.trim());

  const blocks: DocBlock[] = [
    { type: "title", text: "DERECHO DE PETICIÓN" },
    { type: "subtitle", text: "Artículo 23 de la Constitución Política · Ley 1755 de 2015" },
    { type: "spacer", size: 12 },
    { type: "paragraph", text: `${ciudadFmt(c.ciudad)}, ${hoy()}.` },
    { type: "spacer" },
    { type: "paragraph", text: "Señores" },
    { type: "paragraph", text: `${safe(cr.banco).toUpperCase()}` },
    { type: "paragraph", text: "Atn. Defensor del Consumidor Financiero / Oficina de Atención al Cliente" },
    { type: "paragraph", text: "Ciudad." },
    { type: "spacer" },
    {
      type: "subtitle",
      text: `Referencia: Derecho de petición — Crédito No. ${safe(cr.numeroCredito)}`,
    },
    { type: "paragraph", text: `Asunto: ${safe(extra.asunto)}` },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `${fullName(c.nombre)}, mayor de edad, identificado(a) con cédula de ciudadanía ` +
        `No. ${safe(c.cedula)} expedida en ${safe(c.expedidaEn)}, con domicilio en ` +
        `${ciudadFmt(c.ciudad)}, actuando en nombre propio` +
        (usaApoderado
          ? ` y por intermedio de mi apoderado ${fullName(ap.nombre)}, identificado(a) con C.C. No. ${safe(ap.cedula)},`
          : ",") +
        ` respetuosamente me dirijo a ustedes para presentar el siguiente DERECHO DE PETICIÓN ` +
        `con fundamento en el artículo 23 de la Constitución Política y la Ley 1755 de 2015.`,
    },
    { type: "spacer" },

    { type: "heading", text: "HECHOS" },
    { type: "paragraph", text: safe(extra.hechos) },
    { type: "spacer" },

    { type: "heading", text: "PETICIONES" },
    { type: "paragraph", text: safe(extra.pretensiones) },
    { type: "spacer" },

    { type: "heading", text: "FUNDAMENTOS DE DERECHO" },
    {
      type: "paragraph",
      text:
        "Artículo 23 de la Constitución Política; Ley 1755 de 2015 (regulación del derecho " +
        "fundamental de petición); Ley 1328 de 2009 (régimen de protección al consumidor " +
        "financiero); Circular Básica Jurídica de la Superintendencia Financiera de Colombia.",
    },
    { type: "spacer" },

    { type: "heading", text: "NOTIFICACIONES" },
    {
      type: "paragraph",
      text:
        `Recibiré notificaciones en ${safe(c.direccion)}, ${ciudadFmt(c.ciudad)}, ` +
        `teléfono ${safe(c.telefono)}, correo electrónico ${safe(c.email)}.`,
    },
    { type: "spacer", size: 18 },

    { type: "paragraph", text: "Cordialmente," },
    { type: "spacer", size: 28 },
    {
      type: "signature",
      columns: usaApoderado
        ? [
            { label: "EL PETICIONARIO", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` },
            { label: "APODERADO", name: fullName(ap.nombre), cc: `C.C. ${safe(ap.cedula)}` },
          ]
        : [{ label: "EL PETICIONARIO", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` }],
    },
  ];

  return {
    filename: `Derecho_Peticion_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Derecho de Petición",
    blocks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTELA
// ─────────────────────────────────────────────────────────────────────────────

export interface TutelaExtra {
  derechoVulnerado: string;
  hechos: string;
  pretensiones: string;
  pruebas?: string;
}

export function buildTutela(e: ExpedienteMaestro, extra: TutelaExtra): LegalDoc {
  const c = e.cliente;
  const cr = e.credito;

  const blocks: DocBlock[] = [
    { type: "title", text: "ACCIÓN DE TUTELA" },
    {
      type: "subtitle",
      text: "Artículo 86 de la Constitución Política · Decreto 2591 de 1991",
    },
    { type: "spacer", size: 12 },
    {
      type: "paragraph",
      text: `${ciudadFmt(c.ciudad)}, ${hoy()}.`,
    },
    { type: "spacer" },
    { type: "paragraph", text: "Señor(a)" },
    { type: "paragraph", text: "JUEZ DE TUTELA — REPARTO" },
    { type: "paragraph", text: `${ciudadFmt(c.ciudad)}.` },
    { type: "spacer" },
    { type: "subtitle", text: `Referencia: Acción de tutela contra ${safe(cr.banco).toUpperCase()}` },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `${fullName(c.nombre)}, mayor de edad, identificado(a) con cédula de ciudadanía ` +
        `No. ${safe(c.cedula)} expedida en ${safe(c.expedidaEn)}, con domicilio en ` +
        `${safe(c.direccion)}, ${ciudadFmt(c.ciudad)}, en ejercicio del derecho consagrado ` +
        `en el artículo 86 de la Constitución Política y reglamentado por el Decreto 2591 de 1991, ` +
        `interpongo ACCIÓN DE TUTELA contra ${safe(cr.banco).toUpperCase()} con fundamento en lo siguiente:`,
    },
    { type: "spacer" },

    { type: "heading", text: "I. DERECHO FUNDAMENTAL VULNERADO" },
    { type: "paragraph", text: safe(extra.derechoVulnerado) },
    { type: "spacer" },

    { type: "heading", text: "II. HECHOS" },
    { type: "paragraph", text: safe(extra.hechos) },
    { type: "spacer" },

    { type: "heading", text: "III. PRETENSIONES" },
    { type: "paragraph", text: safe(extra.pretensiones) },
    { type: "spacer" },

    { type: "heading", text: "IV. PRUEBAS" },
    {
      type: "paragraph",
      text: extra.pruebas?.trim()
        ? extra.pruebas
        : "Solicito tener como pruebas los documentos anexos que sustentan los hechos expuestos.",
    },
    { type: "spacer" },

    { type: "heading", text: "V. JURAMENTO" },
    {
      type: "paragraph",
      text:
        "Bajo la gravedad del juramento manifiesto que no he interpuesto otra acción de tutela " +
        "por los mismos hechos y derechos.",
    },
    { type: "spacer" },

    { type: "heading", text: "VI. NOTIFICACIONES" },
    {
      type: "paragraph",
      text:
        `Recibiré notificaciones en ${safe(c.direccion)}, ${ciudadFmt(c.ciudad)}, ` +
        `teléfono ${safe(c.telefono)}, correo electrónico ${safe(c.email)}. ` +
        `La entidad accionada podrá ser notificada en sus oficinas principales en la ciudad.`,
    },
    { type: "spacer", size: 18 },

    { type: "paragraph", text: "Atentamente," },
    { type: "spacer", size: 28 },
    {
      type: "signature",
      columns: [
        { label: "EL ACCIONANTE", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` },
      ],
    },
  ];

  return {
    filename: `Tutela_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Acción de Tutela",
    blocks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPUESTA A NEGACIÓN
// ─────────────────────────────────────────────────────────────────────────────

export interface RespuestaNegacionExtra {
  fechaNegacion: string;
  radicadoNegacion: string;
  motivoNegacion: string;
  argumentos: string;
}

export function buildRespuestaNegacion(
  e: ExpedienteMaestro,
  extra: RespuestaNegacionExtra,
): LegalDoc {
  const c = e.cliente;
  const cr = e.credito;

  const blocks: DocBlock[] = [
    { type: "title", text: "RESPUESTA A NEGACIÓN" },
    { type: "subtitle", text: "Solicitud de reconsideración y recurso de reposición" },
    { type: "spacer", size: 12 },
    { type: "paragraph", text: `${ciudadFmt(c.ciudad)}, ${hoy()}.` },
    { type: "spacer" },
    { type: "paragraph", text: "Señores" },
    { type: "paragraph", text: safe(cr.banco).toUpperCase() },
    { type: "paragraph", text: "Atn. Comité de Crédito / Vicepresidencia de Crédito Hipotecario" },
    { type: "paragraph", text: "Ciudad." },
    { type: "spacer" },
    {
      type: "subtitle",
      text:
        `Referencia: Respuesta a negación · Radicado ${safe(extra.radicadoNegacion)} · ` +
        `Crédito No. ${safe(cr.numeroCredito)}`,
    },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `${fullName(c.nombre)}, identificado(a) con cédula de ciudadanía No. ${safe(c.cedula)}, ` +
        `titular del crédito hipotecario No. ${safe(cr.numeroCredito)}, en respuesta a la ` +
        `comunicación de fecha ${safe(extra.fechaNegacion)} mediante la cual esa entidad negó ` +
        `la solicitud presentada, me permito manifestar lo siguiente:`,
    },
    { type: "spacer" },

    { type: "heading", text: "1. MOTIVO INVOCADO POR EL BANCO" },
    { type: "paragraph", text: safe(extra.motivoNegacion) },
    { type: "spacer" },

    { type: "heading", text: "2. ARGUMENTOS DEL CLIENTE" },
    { type: "paragraph", text: safe(extra.argumentos) },
    { type: "spacer" },

    { type: "heading", text: "3. SOLICITUD" },
    {
      type: "paragraph",
      text:
        `Con fundamento en lo anterior, solicito respetuosamente reconsiderar la decisión y ` +
        `aprobar la solicitud presentada sobre el crédito No. ${safe(cr.numeroCredito)}. ` +
        `De mantenerse la negativa, solicito se entienda interpuesto el recurso de reposición ` +
        `correspondiente y se remita el asunto al Defensor del Consumidor Financiero.`,
    },
    { type: "spacer" },

    { type: "heading", text: "4. NOTIFICACIONES" },
    {
      type: "paragraph",
      text:
        `Recibiré notificaciones en ${safe(c.direccion)}, ${ciudadFmt(c.ciudad)}, ` +
        `teléfono ${safe(c.telefono)}, correo ${safe(c.email)}.`,
    },
    { type: "spacer", size: 18 },

    { type: "paragraph", text: "Cordialmente," },
    { type: "spacer", size: 28 },
    {
      type: "signature",
      columns: [
        { label: "EL TITULAR", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` },
      ],
    },
  ];

  return {
    filename: `Respuesta_Negacion_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Respuesta a Negación",
    blocks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RADICACIÓN (oficio remisorio de radicación de documentos)
// ─────────────────────────────────────────────────────────────────────────────

export interface RadicacionExtra {
  oficina: string; // Oficina/área a la que se radica
  asunto: string;
  documentosAdjuntos: string; // listado libre, una línea por documento
  observaciones?: string;
}

export function buildRadicacion(
  e: ExpedienteMaestro,
  extra: RadicacionExtra,
): LegalDoc {
  const c = e.cliente;
  const cr = e.credito;
  const ap = e.apoderado;
  const usaApoderado = !!(ap?.nombre && ap.nombre.trim());

  const blocks: DocBlock[] = [
    { type: "title", text: "OFICIO DE RADICACIÓN" },
    { type: "subtitle", text: "Constancia de entrega de documentos" },
    { type: "spacer", size: 12 },
    { type: "paragraph", text: `${ciudadFmt(c.ciudad)}, ${hoy()}.` },
    { type: "spacer" },
    { type: "paragraph", text: "Señores" },
    { type: "paragraph", text: safe(cr.banco).toUpperCase() },
    { type: "paragraph", text: `Atn. ${safe(extra.oficina)}` },
    { type: "paragraph", text: "Ciudad." },
    { type: "spacer" },
    {
      type: "subtitle",
      text:
        `Referencia: Radicación — Crédito No. ${safe(cr.numeroCredito)} · ` +
        `Titular ${fullName(c.nombre)}`,
    },
    { type: "paragraph", text: `Asunto: ${safe(extra.asunto)}` },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `Por medio del presente oficio${
          usaApoderado
            ? `, y en mi calidad de apoderado de ${fullName(c.nombre)} (C.C. ${safe(c.cedula)}),`
            : ","
        } radico ante esa entidad los siguientes documentos relacionados con el ` +
        `crédito hipotecario No. ${safe(cr.numeroCredito)} (producto ${safe(cr.tipoProducto)}):`,
    },
    { type: "spacer" },

    { type: "heading", text: "DOCUMENTOS RADICADOS" },
    ...safe(extra.documentosAdjuntos)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map<DocBlock>((l, i) => ({
        type: "paragraph",
        text: `${i + 1}. ${l}`,
      })),
    { type: "spacer" },

    ...(extra.observaciones?.trim()
      ? ([
          { type: "heading", text: "OBSERVACIONES" } as DocBlock,
          { type: "paragraph", text: extra.observaciones.trim() } as DocBlock,
          { type: "spacer" } as DocBlock,
        ])
      : []),

    {
      type: "paragraph",
      text:
        `Solicito amablemente expedir constancia de radicación con número, fecha y hora ` +
        `de recepción. Para notificaciones, dirección ${safe(c.direccion)}, ${ciudadFmt(c.ciudad)}, ` +
        `teléfono ${safe(c.telefono)}, correo ${safe(c.email)}.`,
    },
    { type: "spacer", size: 18 },

    { type: "paragraph", text: "Atentamente," },
    { type: "spacer", size: 28 },
    {
      type: "signature",
      columns: usaApoderado
        ? [
            { label: "EL APODERADO", name: fullName(ap.nombre), cc: `C.C. ${safe(ap.cedula)}` },
          ]
        : [
            { label: "EL TITULAR", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` },
          ],
    },
  ];

  return {
    filename: `Radicacion_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Oficio de Radicación",
    blocks,
  };
}
