// Catálogo de PLANTILLAS JURÍDICAS de PODERES — NUVEX.
// REGLA CRÍTICA: la IA NO redacta, NO modifica ni interpreta el contenido.
// Sólo selecciona una plantilla pre-aprobada y reemplaza variables.

import type { DocBlock } from "./legalDocs";

export type CalidadCliente = "Titular" | "Cotitular" | "Locatario" | "Colocatario";

export type PoderTemplateId =
  | "PODER_GENERAL_BANCOS"
  | "FNA_CREDITO_HIPOTECARIO"
  | "FNA_LEASING_HABITACIONAL";

export interface PoderTemplateMeta {
  id: PoderTemplateId;
  nombre: string;
  descripcion: string;
}

export const PODER_TEMPLATES: PoderTemplateMeta[] = [
  {
    id: "PODER_GENERAL_BANCOS",
    nombre: "Poder General Bancos",
    descripcion:
      "Aplica para Bancolombia, Davivienda, Banco de Bogotá, Davibank, Caja Social, Banco Popular, Banco de Occidente, AV Villas, Credifamilia, Bancoomeva, La Hipotecaria, Caja Honor y demás entidades.",
  },
  {
    id: "FNA_CREDITO_HIPOTECARIO",
    nombre: "FNA — Crédito Hipotecario",
    descripcion: "Aplica para Fondo Nacional del Ahorro con producto Crédito Hipotecario.",
  },
  {
    id: "FNA_LEASING_HABITACIONAL",
    nombre: "FNA — Leasing Habitacional",
    descripcion: "Aplica para Fondo Nacional del Ahorro con producto Leasing Habitacional.",
  },
];

/** Selección automática: Banco + Producto → plantilla. */
export function detectPoderTemplate(banco?: string | null, producto?: string | null): PoderTemplateId {
  const b = (banco || "").toLowerCase();
  const p = (producto || "").toLowerCase();
  const esFNA = /fna|fondo\s+nacional/.test(b);
  if (esFNA) {
    if (/leasing/.test(p)) return "FNA_LEASING_HABITACIONAL";
    return "FNA_CREDITO_HIPOTECARIO";
  }
  return "PODER_GENERAL_BANCOS";
}

export interface PoderVariables {
  BANCO: string;
  NOMBRE_CLIENTE: string;
  CEDULA_CLIENTE: string;
  CIUDAD_CLIENTE: string;
  LUGAR_EXPEDICION_CLIENTE: string;
  TIPO_PRODUCTO: string;
  CALIDAD_CLIENTE: CalidadCliente; // Titular / Cotitular / Locatario / Colocatario
  NUMERO_CREDITO: string;
  NOMBRE_APODERADO: string;
  CEDULA_APODERADO: string;
  LUGAR_EXPEDICION_APODERADO: string;
  CELULAR_APODERADO: string;
  CIUDAD_APODERADO: string;
  FECHA: string;
}

const VAR_KEYS: (keyof PoderVariables)[] = [
  "BANCO", "NOMBRE_CLIENTE", "CEDULA_CLIENTE", "CIUDAD_CLIENTE", "LUGAR_EXPEDICION_CLIENTE",
  "TIPO_PRODUCTO", "CALIDAD_CLIENTE", "NUMERO_CREDITO",
  "NOMBRE_APODERADO", "CEDULA_APODERADO", "LUGAR_EXPEDICION_APODERADO", "CELULAR_APODERADO",
  "CIUDAD_APODERADO", "FECHA",
];

function subst(text: string, v: PoderVariables): string {
  let out = text;
  for (const k of VAR_KEYS) {
    out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v[k] ?? ""));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLAS (texto jurídico fijo aprobado por NUVEX)
// ─────────────────────────────────────────────────────────────────────────────

type RawBlock =
  | { t: "title"; text: string }
  | { t: "subtitle"; text: string }
  | { t: "heading"; text: string }
  | { t: "p"; text: string }
  | { t: "sp"; size?: number }
  | { t: "sign" };

const TPL_PODER_GENERAL_BANCOS: RawBlock[] = [
  { t: "p", text: "Señores:" },
  { t: "p", text: "{{BANCO}}" },
  { t: "sp", size: 8 },
  { t: "p", text: "Asunto: Poder especial — {{TIPO_PRODUCTO}} {{BANCO}} No. {{NUMERO_CREDITO}}" },
  { t: "sp", size: 12 },
  {
    t: "p",
    text:
      "Yo, {{NOMBRE_CLIENTE}}, mayor de edad, domiciliado en {{CIUDAD_CLIENTE}}, identificado con cédula de ciudadanía número {{CEDULA_CLIENTE}} de {{LUGAR_EXPEDICION_CLIENTE}}, por medio del presente escrito manifiesto que confiero PODER ESPECIAL a {{NOMBRE_APODERADO}}, identificada con cédula de ciudadanía número {{CEDULA_APODERADO}} de {{LUGAR_EXPEDICION_APODERADO}} y con notificaciones judiciales en el correo juridica@nuvex.com.co o al número celular {{CELULAR_APODERADO}} para que en mi nombre y representación inicie, tramite y lleve hasta su culminación proceso de modificación del plazo del {{TIPO_PRODUCTO}} identificado con el No. {{NUMERO_CREDITO}} ante {{BANCO}}, del cual soy {{CALIDAD_CLIENTE}}, de conformidad con la Ley 546 de 1999.",
  },
  { t: "sp", size: 8 },
  {
    t: "p",
    text:
      "Mi apoderado queda ampliamente investido para todo aquello que se encuentra estipulado en el artículo 77 del Código General del Proceso, así como para radicar derechos de petición, solicitar pruebas extraprocesales, conciliar, transigir, recibir, desistir, terminar, autorizar, sustituir, firmar y reasumir este poder, sin limitaciones especiales.",
  },
  { t: "sp", size: 10 },
  { t: "p", text: "Atentamente," },
  { t: "sp", size: 14 },
  { t: "p", text: "______________________________" },
  { t: "p", text: "{{NOMBRE_CLIENTE}}" },
  { t: "p", text: "{{CEDULA_CLIENTE}} de {{LUGAR_EXPEDICION_CLIENTE}}" },
  { t: "sp", size: 10 },
  { t: "p", text: "Acepto el poder conferido," },
  { t: "sp", size: 14 },
  { t: "p", text: "________________________________" },
  { t: "p", text: "{{NOMBRE_APODERADO}}" },
  { t: "p", text: "C.C {{CEDULA_APODERADO}} de {{LUGAR_EXPEDICION_APODERADO}}" },
];

const TPL_FNA_CREDITO_HIPOTECARIO: RawBlock[] = [
  { t: "title", text: "PODER ESPECIAL" },
  { t: "sp", size: 12 },
  { t: "p", text: "{{CIUDAD_CLIENTE}}, {{FECHA}}." },
  { t: "sp" },
  { t: "p", text: "Señores" },
  { t: "p", text: "FONDO NACIONAL DEL AHORRO — FNA" },
  { t: "p", text: "Ciudad." },
  { t: "sp" },
  { t: "subtitle", text: "Referencia: Poder especial — Crédito Hipotecario FNA No. {{NUMERO_CREDITO}}" },
  { t: "sp" },
  {
    t: "p",
    text:
      "Yo, {{NOMBRE_CLIENTE}}, mayor de edad, identificado(a) con cédula de ciudadanía No. {{CEDULA_CLIENTE}} expedida en {{LUGAR_EXPEDICION_CLIENTE}}, con domicilio en {{CIUDAD_CLIENTE}}, obrando en mi calidad de {{CALIDAD_CLIENTE}} del Crédito Hipotecario suscrito con el FONDO NACIONAL DEL AHORRO — FNA, identificado con el No. {{NUMERO_CREDITO}}, en pleno uso de mis facultades legales, confiero PODER ESPECIAL, AMPLIO Y SUFICIENTE a:",
  },
  { t: "sp" },
  {
    t: "p",
    text:
      "{{NOMBRE_APODERADO}}, mayor de edad, identificado(a) con cédula de ciudadanía No. {{CEDULA_APODERADO}} expedida en {{LUGAR_EXPEDICION_APODERADO}}, con celular {{CELULAR_APODERADO}}, en adelante EL APODERADO,",
  },
  { t: "sp" },
  {
    t: "p",
    text:
      "para que ante el FONDO NACIONAL DEL AHORRO — FNA adelante todas las gestiones administrativas, financieras y documentales relacionadas con el Crédito Hipotecario No. {{NUMERO_CREDITO}}, incluyendo de manera enunciativa, mas no taxativa:",
  },
  { t: "sp" },
  { t: "p", text: "1. Solicitar extractos, paz y salvos, certificaciones tributarias, tablas de amortización y simulaciones." },
  { t: "p", text: "2. Radicar solicitudes de reestructuración, reliquidación, reducción de tasa, modificación de plazo y abonos a capital conforme a la normatividad FNA." },
  { t: "p", text: "3. Presentar derechos de petición, recursos de reposición y demás actuaciones administrativas ante el FNA y la Superintendencia Financiera de Colombia cuando sea procedente." },
  { t: "p", text: "4. Suscribir, presentar y retirar comunicaciones, formularios y documentos." },
  { t: "p", text: "5. Representarme en cualquier diligencia o reunión relacionada con la obligación." },
  { t: "p", text: "6. Realizar las demás actuaciones necesarias para el cabal cumplimiento del mandato." },
  { t: "sp" },
  { t: "p", text: "El presente poder tendrá vigencia hasta su revocatoria expresa por escrito por parte del poderdante." },
  { t: "sp", size: 24 },
  { t: "sign" },
];

const TPL_FNA_LEASING_HABITACIONAL: RawBlock[] = [
  { t: "title", text: "PODER ESPECIAL" },
  { t: "sp", size: 12 },
  { t: "p", text: "{{CIUDAD_CLIENTE}}, {{FECHA}}." },
  { t: "sp" },
  { t: "p", text: "Señores" },
  { t: "p", text: "FONDO NACIONAL DEL AHORRO — FNA" },
  { t: "p", text: "Ciudad." },
  { t: "sp" },
  { t: "subtitle", text: "Referencia: Poder especial — Leasing Habitacional FNA No. {{NUMERO_CREDITO}}" },
  { t: "sp" },
  {
    t: "p",
    text:
      "Yo, {{NOMBRE_CLIENTE}}, mayor de edad, identificado(a) con cédula de ciudadanía No. {{CEDULA_CLIENTE}} expedida en {{LUGAR_EXPEDICION_CLIENTE}}, con domicilio en {{CIUDAD_CLIENTE}}, obrando en mi calidad de {{CALIDAD_CLIENTE}} del Contrato de Leasing Habitacional suscrito con el FONDO NACIONAL DEL AHORRO — FNA, identificado con el No. {{NUMERO_CREDITO}}, en pleno uso de mis facultades legales, confiero PODER ESPECIAL, AMPLIO Y SUFICIENTE a:",
  },
  { t: "sp" },
  {
    t: "p",
    text:
      "{{NOMBRE_APODERADO}}, mayor de edad, identificado(a) con cédula de ciudadanía No. {{CEDULA_APODERADO}} expedida en {{LUGAR_EXPEDICION_APODERADO}}, con celular {{CELULAR_APODERADO}}, en adelante EL APODERADO,",
  },
  { t: "sp" },
  {
    t: "p",
    text:
      "para que ante el FONDO NACIONAL DEL AHORRO — FNA adelante todas las gestiones relacionadas con el Contrato de Leasing Habitacional No. {{NUMERO_CREDITO}}, en su calidad de {{CALIDAD_CLIENTE}}, incluyendo de manera enunciativa, mas no taxativa:",
  },
  { t: "sp" },
  { t: "p", text: "1. Solicitar extractos, paz y salvos, certificaciones y tablas de amortización del canon." },
  { t: "p", text: "2. Radicar solicitudes de modificación del canon, reducción de tasa, ampliación o disminución de plazo, abonos a capital y ejercicio anticipado de la opción de adquisición conforme a la reglamentación FNA." },
  { t: "p", text: "3. Presentar derechos de petición, recursos de reposición y actuaciones administrativas ante el FNA y la Superintendencia Financiera de Colombia cuando sea procedente." },
  { t: "p", text: "4. Suscribir, presentar y retirar comunicaciones, formularios y documentos." },
  { t: "p", text: "5. Representarme en cualquier diligencia o reunión relacionada con el contrato de leasing." },
  { t: "p", text: "6. Realizar las demás actuaciones necesarias para el cabal cumplimiento del mandato." },
  { t: "sp" },
  { t: "p", text: "El presente poder tendrá vigencia hasta su revocatoria expresa por escrito por parte del poderdante." },
  { t: "sp", size: 24 },
  { t: "sign" },
];

const TEMPLATES: Record<PoderTemplateId, RawBlock[]> = {
  PODER_GENERAL_BANCOS: TPL_PODER_GENERAL_BANCOS,
  FNA_CREDITO_HIPOTECARIO: TPL_FNA_CREDITO_HIPOTECARIO,
  FNA_LEASING_HABITACIONAL: TPL_FNA_LEASING_HABITACIONAL,
};

export function renderPoderTemplate(id: PoderTemplateId, v: PoderVariables): DocBlock[] {
  const tpl = TEMPLATES[id];
  return tpl.map((b): DocBlock => {
    switch (b.t) {
      case "title": return { type: "title", text: subst(b.text, v) };
      case "subtitle": return { type: "subtitle", text: subst(b.text, v) };
      case "heading": return { type: "heading", text: subst(b.text, v) };
      case "p": return { type: "paragraph", text: subst(b.text, v) };
      case "sp": return { type: "spacer", size: b.size };
      case "sign":
        return {
          type: "signature",
          columns: [
            { label: `EL ${v.CALIDAD_CLIENTE.toUpperCase()} (PODERDANTE)`, name: v.NOMBRE_CLIENTE, cc: `C.C. ${v.CEDULA_CLIENTE} de ${v.LUGAR_EXPEDICION_CLIENTE}` },
            { label: "EL APODERADO", name: v.NOMBRE_APODERADO, cc: `C.C. ${v.CEDULA_APODERADO} de ${v.LUGAR_EXPEDICION_APODERADO}` },
          ],
        };
    }
  });
}

/** Validación: devuelve la lista de campos faltantes (vacíos). */
export function validatePoderVariables(v: Partial<PoderVariables>, templateId?: PoderTemplateId): string[] {
  const missing: string[] = [];
  const need: { k: keyof PoderVariables; label: string }[] = [
    { k: "BANCO", label: "Banco" },
    { k: "NOMBRE_CLIENTE", label: "Nombre del cliente" },
    { k: "CEDULA_CLIENTE", label: "Cédula del cliente" },
    { k: "CIUDAD_CLIENTE", label: "Ciudad del cliente" },
    { k: "LUGAR_EXPEDICION_CLIENTE", label: "Lugar de expedición de la cédula del cliente" },
    { k: "TIPO_PRODUCTO", label: "Producto / tipo de crédito" },
    { k: "NOMBRE_APODERADO", label: "Apoderado NUVEX (nombre)" },
    { k: "CEDULA_APODERADO", label: "Apoderado NUVEX (cédula)" },
    { k: "LUGAR_EXPEDICION_APODERADO", label: "Apoderado NUVEX (lugar de expedición)" },
  ];
  need.push({ k: "NUMERO_CREDITO", label: "Número de crédito" });
  for (const { k, label } of need) {
    const val = (v[k] ?? "").toString().trim();
    if (!val) missing.push(label);
  }
  return missing;
}

export function calidadFor(producto: string | null | undefined, esCotitular: boolean): CalidadCliente {
  const esLeasing = /leasing\s+habitacional/i.test(producto || "");
  if (esLeasing) return esCotitular ? "Colocatario" : "Locatario";
  return esCotitular ? "Cotitular" : "Titular";
}
