// Catálogo NUVEX de departamentos y municipios de Colombia.
// Fuente: división político-administrativa DANE (capitales y municipios principales).
// Uso obligatorio en todos los campos de ciudad/lugar de expedición del sistema.

import { normalizeColombiaLocation } from "@/lib/colombiaLocations";

export interface CityRecord {
  city: string;
  department: string;
  /** Código DANE municipal (5 dígitos) cuando aplica. */
  dane?: string;
}

/**
 * Catálogo curado: incluye las 32 capitales departamentales + Bogotá D.C.
 * y los municipios más relevantes para operación NUVEX.
 * No pretende ser exhaustivo (Colombia tiene >1100 municipios); cubre los
 * casos reales de clientes hipotecarios. Si falta uno, el selector permite
 * usar texto libre con normalización.
 */
export const COLOMBIA_CITIES: CityRecord[] = [
  // Bogotá D.C.
  { city: "Bogotá D.C.", department: "Bogotá D.C.", dane: "11001" },

  // Amazonas
  { city: "Leticia", department: "Amazonas", dane: "91001" },
  { city: "Puerto Nariño", department: "Amazonas", dane: "91540" },

  // Antioquia
  { city: "Medellín", department: "Antioquia", dane: "05001" },
  { city: "Bello", department: "Antioquia", dane: "05088" },
  { city: "Envigado", department: "Antioquia", dane: "05266" },
  { city: "Itagüí", department: "Antioquia", dane: "05360" },
  { city: "Sabaneta", department: "Antioquia", dane: "05631" },
  { city: "La Estrella", department: "Antioquia", dane: "05380" },
  { city: "Caldas", department: "Antioquia", dane: "05129" },
  { city: "Copacabana", department: "Antioquia", dane: "05212" },
  { city: "Girardota", department: "Antioquia", dane: "05308" },
  { city: "Rionegro", department: "Antioquia", dane: "05615" },
  { city: "Apartadó", department: "Antioquia", dane: "05045" },
  { city: "Turbo", department: "Antioquia", dane: "05837" },
  { city: "Caucasia", department: "Antioquia", dane: "05154" },

  // Arauca
  { city: "Arauca", department: "Arauca", dane: "81001" },
  { city: "Saravena", department: "Arauca", dane: "81736" },
  { city: "Tame", department: "Arauca", dane: "81794" },

  // Atlántico
  { city: "Barranquilla", department: "Atlántico", dane: "08001" },
  { city: "Soledad", department: "Atlántico", dane: "08758" },
  { city: "Malambo", department: "Atlántico", dane: "08433" },
  { city: "Puerto Colombia", department: "Atlántico", dane: "08573" },
  { city: "Sabanalarga", department: "Atlántico", dane: "08638" },
  { city: "Galapa", department: "Atlántico", dane: "08296" },

  // Bolívar
  { city: "Cartagena", department: "Bolívar", dane: "13001" },
  { city: "Magangué", department: "Bolívar", dane: "13430" },
  { city: "Turbaco", department: "Bolívar", dane: "13836" },
  { city: "Arjona", department: "Bolívar", dane: "13052" },
  { city: "El Carmen de Bolívar", department: "Bolívar", dane: "13244" },

  // Boyacá
  { city: "Tunja", department: "Boyacá", dane: "15001" },
  { city: "Duitama", department: "Boyacá", dane: "15238" },
  { city: "Sogamoso", department: "Boyacá", dane: "15759" },
  { city: "Chiquinquirá", department: "Boyacá", dane: "15176" },
  { city: "Paipa", department: "Boyacá", dane: "15516" },
  { city: "Villa de Leyva", department: "Boyacá", dane: "15407" },

  // Caldas
  { city: "Manizales", department: "Caldas", dane: "17001" },
  { city: "Villamaría", department: "Caldas", dane: "17873" },
  { city: "Chinchiná", department: "Caldas", dane: "17174" },
  { city: "La Dorada", department: "Caldas", dane: "17380" },
  { city: "Riosucio", department: "Caldas", dane: "17614" },

  // Caquetá
  { city: "Florencia", department: "Caquetá", dane: "18001" },
  { city: "San Vicente del Caguán", department: "Caquetá", dane: "18753" },

  // Casanare
  { city: "Yopal", department: "Casanare", dane: "85001" },
  { city: "Aguazul", department: "Casanare", dane: "85010" },
  { city: "Villanueva", department: "Casanare", dane: "85440" },

  // Cauca
  { city: "Popayán", department: "Cauca", dane: "19001" },
  { city: "Santander de Quilichao", department: "Cauca", dane: "19698" },
  { city: "Puerto Tejada", department: "Cauca", dane: "19573" },
  { city: "Patía", department: "Cauca", dane: "19532" },

  // Cesar
  { city: "Valledupar", department: "Cesar", dane: "20001" },
  { city: "Aguachica", department: "Cesar", dane: "20011" },
  { city: "Bosconia", department: "Cesar", dane: "20060" },
  { city: "La Jagua de Ibirico", department: "Cesar", dane: "20400" },

  // Chocó
  { city: "Quibdó", department: "Chocó", dane: "27001" },
  { city: "Istmina", department: "Chocó", dane: "27361" },

  // Córdoba
  { city: "Montería", department: "Córdoba", dane: "23001" },
  { city: "Cereté", department: "Córdoba", dane: "23162" },
  { city: "Lorica", department: "Córdoba", dane: "23417" },
  { city: "Sahagún", department: "Córdoba", dane: "23660" },
  { city: "Planeta Rica", department: "Córdoba", dane: "23555" },

  // Cundinamarca
  { city: "Soacha", department: "Cundinamarca", dane: "25754" },
  { city: "Facatativá", department: "Cundinamarca", dane: "25269" },
  { city: "Chía", department: "Cundinamarca", dane: "25175" },
  { city: "Zipaquirá", department: "Cundinamarca", dane: "25899" },
  { city: "Mosquera", department: "Cundinamarca", dane: "25473" },
  { city: "Madrid", department: "Cundinamarca", dane: "25430" },
  { city: "Funza", department: "Cundinamarca", dane: "25286" },
  { city: "Cajicá", department: "Cundinamarca", dane: "25126" },
  { city: "Cota", department: "Cundinamarca", dane: "25214" },
  { city: "La Calera", department: "Cundinamarca", dane: "25377" },
  { city: "Fusagasugá", department: "Cundinamarca", dane: "25290" },
  { city: "Girardot", department: "Cundinamarca", dane: "25307" },
  { city: "Tocancipá", department: "Cundinamarca", dane: "25817" },
  { city: "Sopó", department: "Cundinamarca", dane: "25758" },

  // Guainía
  { city: "Inírida", department: "Guainía", dane: "94001" },

  // Guaviare
  { city: "San José del Guaviare", department: "Guaviare", dane: "95001" },

  // Huila
  { city: "Neiva", department: "Huila", dane: "41001" },
  { city: "Pitalito", department: "Huila", dane: "41551" },
  { city: "Garzón", department: "Huila", dane: "41298" },
  { city: "La Plata", department: "Huila", dane: "41396" },

  // La Guajira
  { city: "Riohacha", department: "La Guajira", dane: "44001" },
  { city: "Maicao", department: "La Guajira", dane: "44430" },
  { city: "Uribia", department: "La Guajira", dane: "44847" },
  { city: "San Juan del Cesar", department: "La Guajira", dane: "44650" },

  // Magdalena
  { city: "Santa Marta", department: "Magdalena", dane: "47001" },
  { city: "Ciénaga", department: "Magdalena", dane: "47189" },
  { city: "Fundación", department: "Magdalena", dane: "47288" },
  { city: "El Banco", department: "Magdalena", dane: "47245" },

  // Meta
  { city: "Villavicencio", department: "Meta", dane: "50001" },
  { city: "Acacías", department: "Meta", dane: "50006" },
  { city: "Granada", department: "Meta", dane: "50313" },
  { city: "Puerto López", department: "Meta", dane: "50573" },

  // Nariño
  { city: "Pasto", department: "Nariño", dane: "52001" },
  { city: "Tumaco", department: "Nariño", dane: "52835" },
  { city: "Ipiales", department: "Nariño", dane: "52356" },
  { city: "Túquerres", department: "Nariño", dane: "52838" },

  // Norte de Santander
  { city: "Cúcuta", department: "Norte de Santander", dane: "54001" },
  { city: "Ocaña", department: "Norte de Santander", dane: "54498" },
  { city: "Pamplona", department: "Norte de Santander", dane: "54518" },
  { city: "Villa del Rosario", department: "Norte de Santander", dane: "54874" },
  { city: "Los Patios", department: "Norte de Santander", dane: "54405" },
  { city: "Tibú", department: "Norte de Santander", dane: "54810" },

  // Putumayo
  { city: "Mocoa", department: "Putumayo", dane: "86001" },
  { city: "Puerto Asís", department: "Putumayo", dane: "86568" },
  { city: "Orito", department: "Putumayo", dane: "86320" },

  // Quindío
  { city: "Armenia", department: "Quindío", dane: "63001" },
  { city: "Calarcá", department: "Quindío", dane: "63130" },
  { city: "La Tebaida", department: "Quindío", dane: "63401" },
  { city: "Montenegro", department: "Quindío", dane: "63470" },
  { city: "Quimbaya", department: "Quindío", dane: "63594" },

  // Risaralda
  { city: "Pereira", department: "Risaralda", dane: "66001" },
  { city: "Dosquebradas", department: "Risaralda", dane: "66170" },
  { city: "Santa Rosa de Cabal", department: "Risaralda", dane: "66682" },
  { city: "La Virginia", department: "Risaralda", dane: "66400" },

  // San Andrés
  { city: "San Andrés", department: "San Andrés y Providencia", dane: "88001" },
  { city: "Providencia", department: "San Andrés y Providencia", dane: "88564" },

  // Santander
  { city: "Bucaramanga", department: "Santander", dane: "68001" },
  { city: "Floridablanca", department: "Santander", dane: "68276" },
  { city: "Girón", department: "Santander", dane: "68307" },
  { city: "Piedecuesta", department: "Santander", dane: "68547" },
  { city: "Barrancabermeja", department: "Santander", dane: "68081" },
  { city: "San Gil", department: "Santander", dane: "68679" },
  { city: "Socorro", department: "Santander", dane: "68755" },
  { city: "Málaga", department: "Santander", dane: "68432" },
  { city: "Barbosa", department: "Santander", dane: "68077" },
  { city: "Vélez", department: "Santander", dane: "68861" },

  // Sucre
  { city: "Sincelejo", department: "Sucre", dane: "70001" },
  { city: "Corozal", department: "Sucre", dane: "70215" },
  { city: "Sampués", department: "Sucre", dane: "70670" },
  { city: "San Marcos", department: "Sucre", dane: "70708" },

  // Tolima
  { city: "Ibagué", department: "Tolima", dane: "73001" },
  { city: "Espinal", department: "Tolima", dane: "73268" },
  { city: "Honda", department: "Tolima", dane: "73349" },
  { city: "Melgar", department: "Tolima", dane: "73449" },
  { city: "Mariquita", department: "Tolima", dane: "73443" },
  { city: "Chaparral", department: "Tolima", dane: "73168" },

  // Valle del Cauca
  { city: "Cali", department: "Valle del Cauca", dane: "76001" },
  { city: "Palmira", department: "Valle del Cauca", dane: "76520" },
  { city: "Buenaventura", department: "Valle del Cauca", dane: "76109" },
  { city: "Tuluá", department: "Valle del Cauca", dane: "76834" },
  { city: "Cartago", department: "Valle del Cauca", dane: "76147" },
  { city: "Buga", department: "Valle del Cauca", dane: "76111" },
  { city: "Jamundí", department: "Valle del Cauca", dane: "76364" },
  { city: "Yumbo", department: "Valle del Cauca", dane: "76892" },
  { city: "Candelaria", department: "Valle del Cauca", dane: "76130" },
  { city: "Florida", department: "Valle del Cauca", dane: "76275" },
  { city: "Sevilla", department: "Valle del Cauca", dane: "76736" },
  { city: "Zarzal", department: "Valle del Cauca", dane: "76895" },

  // Vaupés
  { city: "Mitú", department: "Vaupés", dane: "97001" },

  // Vichada
  { city: "Puerto Carreño", department: "Vichada", dane: "99001" },
];

/** Etiqueta estándar: "Municipio, Departamento". */
export function cityLabel(c: CityRecord): string {
  return `${c.city}, ${c.department}`;
}

/** Extrae el departamento desde "Municipio, Departamento" (o '' si no aplica). */
export function cityDepartment(label: string | null | undefined): string {
  const t = (label || "").trim();
  if (!t) return "";
  if (t.includes(",")) {
    const parts = t.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
  }
  // Si vino sólo el municipio, intentar resolver desde catálogo.
  const folded = fold(t);
  const hit = COLOMBIA_CITIES.find((c) => fold(c.city) === folded);
  return hit?.department ?? "";
}

/** Extrae el municipio desde "Municipio, Departamento". */
export function cityMunicipio(label: string | null | undefined): string {
  const t = (label || "").trim();
  if (!t) return "";
  if (t.includes(",")) return t.split(",")[0].trim();
  return t;
}

/** Quita acentos y normaliza para búsqueda fuzzy. */
function fold(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Búsqueda por substring sin acentos en ciudad o departamento. */
export function searchCities(query: string, limit = 20): CityRecord[] {
  const q = fold(query);
  if (!q) return COLOMBIA_CITIES.slice(0, limit);
  const matches: CityRecord[] = [];
  for (const c of COLOMBIA_CITIES) {
    if (fold(c.city).startsWith(q)) matches.push(c);
    if (matches.length >= limit) break;
  }
  if (matches.length < limit) {
    for (const c of COLOMBIA_CITIES) {
      if (matches.includes(c)) continue;
      if (fold(c.city).includes(q) || fold(c.department).includes(q)) {
        matches.push(c);
        if (matches.length >= limit) break;
      }
    }
  }
  return matches;
}

/**
 * Normaliza un texto libre a la etiqueta canónica del catálogo cuando es posible.
 * - "bogota" → "Bogotá D.C., Bogotá D.C."
 * - "Bucaramanga" → "Bucaramanga, Santander"
 * - Si no encuentra match unívoco, devuelve el texto saneado (capitalizado).
 */
export function normalizeCityText(raw: string | null | undefined): string {
  const t = (raw || "").trim();
  if (!t) return "";
  const official = normalizeColombiaLocation(t);
  if (official.matched) return official.label;
  // ya viene como "Ciudad, Departamento" del catálogo → respetar
  if (t.includes(",")) {
    const [city] = t.split(",").map((s) => s.trim());
    const hit = COLOMBIA_CITIES.find((c) => fold(c.city) === fold(city));
    if (hit) return cityLabel(hit);
    return t;
  }
  const folded = fold(t);
  // match exacto por ciudad
  const exact = COLOMBIA_CITIES.find((c) => fold(c.city) === folded);
  if (exact) return cityLabel(exact);
  // alias frecuentes
  const aliases: Record<string, string> = {
    "bogota": "Bogotá D.C.",
    "bogota dc": "Bogotá D.C.",
    "bogota d c": "Bogotá D.C.",
    "santafe de bogota": "Bogotá D.C.",
    "medellin": "Medellín",
    "ibague": "Ibagué",
    "cucuta": "Cúcuta",
    "monteria": "Montería",
    "popayan": "Popayán",
    "neiva": "Neiva",
    "manizales": "Manizales",
  };
  const alias = aliases[folded];
  if (alias) {
    const hit = COLOMBIA_CITIES.find((c) => c.city === alias);
    if (hit) return cityLabel(hit);
  }
  // capitaliza para no romper
  return t.replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}
