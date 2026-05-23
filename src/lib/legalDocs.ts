// Generadores de documentos jurídicos (Poder Especial y Contrato de Prestación
// de Servicios) a partir del Expediente Maestro. Cero dependencias en
// simuladores, OCR, PDFs comerciales ni módulos existentes.
//
// El modelo de bloques es agnóstico al renderizador: tanto el exportador PDF
// como el DOCX consumen el mismo árbol, garantizando que el documento siempre
// refleje el estado actual del expediente.

import type { ExpedienteMaestro } from "./expedienteMaestro";

export type DocBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "spacer"; size?: number }
  | {
      type: "signature";
      columns: { label: string; name?: string; cc?: string }[];
    };

export interface LegalDoc {
  filename: string;
  title: string;
  blocks: DocBlock[];
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

// ─────────────────────────────────────────────────────────────────────────────
// PODER ESPECIAL
// ─────────────────────────────────────────────────────────────────────────────

export function buildPoderEspecial(e: ExpedienteMaestro): LegalDoc {
  const c = e.cliente;
  const ap = e.apoderado;
  const cr = e.credito;

  const blocks: DocBlock[] = [
    { type: "title", text: "PODER ESPECIAL" },
    { type: "spacer", size: 12 },
    {
      type: "paragraph",
      text: `${ciudadFmt(c.ciudad)}, ${hoy()}.`,
    },
    { type: "spacer" },
    { type: "paragraph", text: "Señores" },
    { type: "paragraph", text: `${safe(cr.banco).toUpperCase()}` },
    { type: "paragraph", text: "Ciudad." },
    { type: "spacer" },
    { type: "subtitle", text: "Referencia: Poder especial para gestión de crédito hipotecario" },
    {
      type: "paragraph",
      text: `Crédito No. ${safe(cr.numeroCredito)} · Producto: ${safe(cr.tipoProducto)}`,
    },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `Yo, ${fullName(c.nombre)}, mayor de edad, identificado(a) con cédula de ciudadanía ` +
        `No. ${safe(c.cedula)} expedida en ${safe(c.expedidaEn)}, ` +
        `con domicilio en ${ciudadFmt(c.ciudad)}, en pleno uso de mis facultades legales, ` +
        `por medio del presente documento confiero PODER ESPECIAL, AMPLIO Y SUFICIENTE a:`,
    },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `${fullName(ap.nombre)}, mayor de edad, identificado(a) con cédula de ciudadanía ` +
        `No. ${safe(ap.cedula)}, con domicilio en ${ciudadFmt(ap.ciudad)}, ` +
        `quien en adelante se denominará EL APODERADO,`,
    },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `para que en mi nombre y representación adelante ante ${safe(cr.banco).toUpperCase()} ` +
        `y/o cualquier entidad financiera, todas las gestiones, trámites, solicitudes y ` +
        `actuaciones necesarias relacionadas con el crédito hipotecario identificado con el ` +
        `No. ${safe(cr.numeroCredito)}, incluyendo de manera enunciativa, mas no taxativa, las siguientes:`,
    },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        "1. Solicitar y recibir extractos, certificaciones, paz y salvos, simulaciones, " +
        "tablas de amortización y cualquier información relacionada con la obligación.",
    },
    {
      type: "paragraph",
      text:
        "2. Radicar solicitudes de reestructuración, reliquidación, reducción de tasa, " +
        "ampliación o disminución de plazo, abonos a capital y demás modificaciones contractuales.",
    },
    {
      type: "paragraph",
      text:
        "3. Suscribir, presentar y retirar toda clase de comunicaciones, formularios y documentos.",
    },
    {
      type: "paragraph",
      text:
        "4. Representarme en reuniones, conciliaciones y diligencias relativas al crédito.",
    },
    {
      type: "paragraph",
      text:
        "5. Realizar cualquier otra actuación necesaria para el cabal cumplimiento del presente mandato.",
    },
    { type: "spacer" },
    {
      type: "paragraph",
      text:
        `El presente poder se otorga bajo el número ${safe(ap.numeroPoder)} con fecha ` +
        `${safe(ap.fechaPoder)} y tendrá vigencia hasta su revocatoria expresa por escrito.`,
    },
    { type: "spacer", size: 24 },
    {
      type: "signature",
      columns: [
        { label: "EL PODERDANTE", name: fullName(c.nombre), cc: `C.C. ${safe(c.cedula)}` },
        { label: "EL APODERADO", name: fullName(ap.nombre), cc: `C.C. ${safe(ap.cedula)}` },
      ],
    },
  ];

  return {
    filename: `Poder_Especial_${(c.nombre || "Cliente").replace(/\s+/g, "_")}`,
    title: "Poder Especial",
    blocks,
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
