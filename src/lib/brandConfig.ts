/**
 * Configuración institucional NUVIA (antes NUVEX)
 * Fuente única de verdad para identidad corporativa.
 *
 * Rebranding Fase 5: NUVEX → NUVIA. Se conservan los identificadores
 * `NUVEX_BRAND` / `NuvexBrand` como alias legacy para no romper
 * componentes congelados (Pipeline, Casos, Directorio, Mensajería, Finanzas)
 * que aún los importan. Nuevos consumidores deben usar `NUVIA_BRAND`.
 */

export const NUVIA_BRAND = {
  nombreComercial: "NUVIA Finanzas Inteligentes",
  nombreCorto: "NUVIA",
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

export type NuviaBrand = typeof NUVIA_BRAND;

// ─── Alias legacy (no usar en código nuevo) ────────────────────────────────
export const NUVEX_BRAND = NUVIA_BRAND;
export type NuvexBrand = NuviaBrand;
