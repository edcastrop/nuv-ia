/**
 * Configuración institucional NUVEX
 * Fuente única de verdad para identidad corporativa.
 */

export const NUVEX_BRAND = {
  nombreComercial: "NUVEX Finanzas Inteligentes",
  nombreCorto: "NUVEX",
  tagline: "Finanzas Inteligentes",

  logo: {
    principal: "/logo-nuvex.png",
    favicon: "/favicon.png",
  },

  colores: {
    azul: "#445DA3",
    verde: "#84B98F",
    negro: "#242424",
  },

  direcciones: {
    bucaramanga: "Carrera 16 # 37-48 Piso 4, Centro de Bucaramanga",
    bogota: "Calle 93 # 18-28 Oficina 704",
  },

  correos: {
    juridica: "juridica@nuvex.com.co",
    contratacion: "contratacion@nuvex.com.co",
  },

  sitioWeb: "www.nuvex.com.co",
} as const;

export type NuvexBrand = typeof NUVEX_BRAND;
