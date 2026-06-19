// ============================================================================
// Motor de analogías humanas para el "Abono Inteligente a Capital".
// ----------------------------------------------------------------------------
// La idea: traducir números fríos (abono mensual + ahorro total + años) a
// referencias cotidianas que el cliente entienda en 3 segundos. Cero robótico.
//
// Reglas:
//   1) Las analogías se eligen por banda de monto (no decir "una cena" si el
//      abono es de 3 millones).
//   2) Si el asesor marcó un perfil del cliente (hijos, carro, viajes,
//      emprendedor), se priorizan las analogías personalizadas para ese perfil.
//   3) Se evita repetir la última analogía mostrada (rotación con memoria).
//   4) El cierre es suave, nunca venta dura.
// ============================================================================

export interface PerfilCliente {
  tieneHijos?: boolean;
  tieneCarro?: boolean;
  leGustaViajar?: boolean;
  esEmprendedor?: boolean;
}

export interface AnalogiaInput {
  /** Abono mensual extra (incremento mensual) sobre la cuota actual. COP. */
  abonoMensual: number;
  /** Ahorro total estimado en COP. */
  ahorroTotal: number;
  /** Años eliminados del crédito (puede tener decimales). */
  anosEliminados: number;
  /** Cuotas eliminadas. */
  cuotasEliminadas: number;
  perfil?: PerfilCliente;
  /** Último texto de analogía mostrado, para evitar repetirlo. */
  evitar?: string | null;
}

export interface AnalogiaResultado {
  /** Frase humana del abono: "una cena con tu pareja", "el SOAT del carro"… */
  abonoComo: string;
  /** Frase humana del ahorro: "un carro de segunda en buen estado"… */
  ahorroComo: string;
  /** Texto narrativo listo para mostrar. */
  mensaje: string;
  /** Cierre suave. */
  cierre: string;
  /** Etiqueta de origen (genérica / hijos / carro / viaje / emprendedor). */
  perfilUsado: "generica" | "hijos" | "carro" | "viaje" | "emprendedor";
}

// ─── Bancos de analogías ─────────────────────────────────────────────────────

type Banda = "micro" | "chico" | "medio" | "grande" | "xl";

function bandaAbono(monto: number): Banda {
  if (monto <= 120_000) return "micro";
  if (monto <= 300_000) return "chico";
  if (monto <= 700_000) return "medio";
  if (monto <= 1_500_000) return "grande";
  return "xl";
}

function bandaAhorro(monto: number): "s" | "m" | "l" | "xl" | "xxl" {
  if (monto < 15_000_000) return "s";
  if (monto < 30_000_000) return "m";
  if (monto < 60_000_000) return "l";
  if (monto < 150_000_000) return "xl";
  return "xxl";
}

// Frases de "abono como…" por banda y perfil.
const ABONO_GENERICAS: Record<Banda, string[]> = {
  micro: [
    "una cena para dos en un buen restaurante",
    "el domicilio del sábado en la noche",
    "el mercado liviano de la semana",
    "la salida al cine con crispetas",
    "el almuerzo del viernes con el equipo",
  ],
  chico: [
    "el plan del fin de semana en familia",
    "una buena celebración de cumpleaños",
    "la mensualidad del gimnasio",
    "una cena especial con tu pareja",
  ],
  medio: [
    "una salida turística de un día",
    "un buen regalo de aniversario",
    "una revisión completa al carro",
    "el plan del puente festivo",
  ],
  grande: [
    "un fin de semana en una finca cerca de la ciudad",
    "un electrodoméstico de gama media",
    "una escapada corta a la playa",
  ],
  xl: [
    "una mensualidad de colegio privado",
    "un viaje nacional de varios días",
    "la cuota inicial de un electrodoméstico grande",
  ],
};

const ABONO_HIJOS: Record<Banda, string[]> = {
  micro: [
    "la mesada del niño este mes",
    "el helado del domingo con los pelados",
    "un cumpleaños sencillo en casa",
  ],
  chico: [
    "el kit escolar de inicio de semestre",
    "una piñata para tu hijo",
    "el uniforme nuevo del colegio",
  ],
  medio: [
    "la matrícula del jardín",
    "el plan de cumpleaños con piscina",
    "una salida a un parque temático en familia",
  ],
  grande: [
    "la mensualidad del colegio",
    "un curso de vacaciones para tu hijo",
  ],
  xl: [
    "la pensión completa de un colegio bilingüe",
    "la matrícula de un semestre técnico para tu hijo",
  ],
};

const ABONO_CARRO: Record<Banda, string[]> = {
  micro: [
    "un tanque de gasolina",
    "el lavado completo del carro este mes",
    "el peaje de un viaje corto",
  ],
  chico: [
    "el cambio de aceite y filtros",
    "una llanta nueva",
    "la mensualidad del parqueadero",
  ],
  medio: [
    "el SOAT del carro",
    "una revisión mecánica completa",
    "un juego de pastillas y discos",
  ],
  grande: [
    "la tecnomecánica más una latonería pequeña",
    "un kit de llantas nuevas",
  ],
  xl: [
    "una reparación grande del motor",
    "una caja automática reconstruida",
  ],
};

const ABONO_VIAJE: Record<Banda, string[]> = {
  micro: [
    "una noche en un buen hotel",
    "el tinto del aeropuerto en un viaje rápido",
  ],
  chico: [
    "un pasaje nacional ida y vuelta en oferta",
    "dos noches en un hostal frente al mar",
  ],
  medio: [
    "un fin de semana en Cartagena, todo incluido para una persona",
    "un vuelo nacional con maleta",
  ],
  grande: [
    "un fin de semana en San Andrés para dos",
    "tres noches en un resort en Santa Marta",
  ],
  xl: [
    "una semana en un crucero por el Caribe",
    "un pasaje a Europa en temporada baja",
  ],
};

const ABONO_EMPRENDEDOR: Record<Banda, string[]> = {
  micro: [
    "el café del equipo durante un mes",
    "la papelería del negocio este mes",
  ],
  chico: [
    "una pauta pequeña en redes sociales",
    "el dominio y hosting anual de tu marca",
  ],
  medio: [
    "una campaña básica de marketing digital",
    "un mes de servicios contables",
  ],
  grande: [
    "el inventario inicial de un nuevo producto",
    "la mensualidad de tu local comercial",
  ],
  xl: [
    "un empleado adicional por un mes",
    "la inversión inicial de una línea nueva del negocio",
  ],
};

// Frases de "ahorro como…" — siempre genéricas + variantes por perfil.
const AHORRO_GENERICAS: Record<ReturnType<typeof bandaAhorro>, string[]> = {
  s: [
    "una moto nueva, paga al contado",
    "un viaje familiar a San Andrés todo incluido",
    "la cuota inicial de un apartamento pequeño",
  ],
  m: [
    "un carro de segunda en muy buen estado",
    "la cuota inicial de un apartamento",
    "dos años de salario mínimo, libres",
  ],
  l: [
    "un carro nuevo de entrada de gama",
    "la remodelación completa de tu vivienda",
    "tres años sin tener que pagar arriendo",
  ],
  xl: [
    "la cuota inicial de una casa",
    "un apartamento usado en una ciudad intermedia",
    "el capital semilla para tu propio negocio",
  ],
  xxl: [
    "una casa pequeña en pueblo, paga al contado",
    "una propiedad para arrendar y vivir de la renta",
    "la libertad financiera adelantada varios años",
  ],
};

const AHORRO_HIJOS: Record<ReturnType<typeof bandaAhorro>, string[]> = {
  s: ["dos semestres de universidad para tu hijo"],
  m: ["una carrera técnica completa para tu hijo"],
  l: ["una carrera universitaria privada completa"],
  xl: ["una universidad privada + un carro para cuando se gradúe"],
  xxl: ["el futuro educativo de tus hijos resuelto"],
};

const AHORRO_VIAJE: Record<ReturnType<typeof bandaAhorro>, string[]> = {
  s: ["un viaje a Europa con tu pareja"],
  m: ["dar la vuelta a Suramérica en familia"],
  l: ["un año sabático viajando por el mundo"],
  xl: ["recorrer 20 países sin preocuparte por el dinero"],
  xxl: ["viajar el resto de tu vida sin volver a trabajar"],
};

const AHORRO_EMPRENDEDOR: Record<ReturnType<typeof bandaAhorro>, string[]> = {
  s: ["el capital inicial para montar tu propio negocio"],
  m: ["abrir tu primer local comercial sin endeudarte"],
  l: ["lanzar tu marca propia con todo a favor"],
  xl: ["abrir tres locales o expandir a otra ciudad"],
  xxl: ["construir tu propia empresa desde cero, sin deudas"],
};

// Cierres suaves
const CIERRES = [
  "Pequeño hoy, gigante mañana.",
  "Eso es lo que llamamos plata bien invertida.",
  "Una decisión hoy, libertad financiera mañana.",
  "Esa es la magia del abono inteligente.",
  "Lo que sacrificas hoy, te lo agradeces después.",
  "Es matemática a tu favor.",
];

// ─── Generador ───────────────────────────────────────────────────────────────

function pick<T>(arr: T[], evitar?: string | null): T {
  if (arr.length === 0) throw new Error("Pool vacío");
  if (arr.length === 1) return arr[0];
  const filtrados = evitar
    ? arr.filter((x) => String(x) !== evitar)
    : arr;
  const pool = filtrados.length > 0 ? filtrados : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generarAnalogia(input: AnalogiaInput): AnalogiaResultado {
  const banda = bandaAbono(input.abonoMensual);
  const bAhorro = bandaAhorro(input.ahorroTotal);
  const p = input.perfil ?? {};

  // Construye pool de "abono como…" según perfil(es) activos.
  const poolsAbono: Array<{ tipo: AnalogiaResultado["perfilUsado"]; arr: string[] }> = [];
  if (p.tieneHijos) poolsAbono.push({ tipo: "hijos", arr: ABONO_HIJOS[banda] });
  if (p.tieneCarro) poolsAbono.push({ tipo: "carro", arr: ABONO_CARRO[banda] });
  if (p.leGustaViajar) poolsAbono.push({ tipo: "viaje", arr: ABONO_VIAJE[banda] });
  if (p.esEmprendedor) poolsAbono.push({ tipo: "emprendedor", arr: ABONO_EMPRENDEDOR[banda] });
  poolsAbono.push({ tipo: "generica", arr: ABONO_GENERICAS[banda] });

  // 70% probabilidad de usar perfil personalizado si existe, 30% genérica
  // para mantener variedad.
  const tienePerfil = poolsAbono.length > 1;
  const usarPersonalizada = tienePerfil && Math.random() < 0.7;
  const elegido = usarPersonalizada
    ? poolsAbono[Math.floor(Math.random() * (poolsAbono.length - 1))]
    : poolsAbono[poolsAbono.length - 1];

  const abonoComo = pick(elegido.arr, input.evitar);

  // Pool ahorro: igual lógica, pero más simple (una variante por perfil).
  const poolsAhorro: string[][] = [];
  if (p.tieneHijos) poolsAhorro.push(AHORRO_HIJOS[bAhorro]);
  if (p.leGustaViajar) poolsAhorro.push(AHORRO_VIAJE[bAhorro]);
  if (p.esEmprendedor) poolsAhorro.push(AHORRO_EMPRENDEDOR[bAhorro]);
  poolsAhorro.push(AHORRO_GENERICAS[bAhorro]);

  const poolAhorro =
    poolsAhorro.length > 1 && Math.random() < 0.6
      ? poolsAhorro[Math.floor(Math.random() * (poolsAhorro.length - 1))]
      : poolsAhorro[poolsAhorro.length - 1];

  const ahorroComo = pick(poolAhorro);
  const cierre = pick(CIERRES);

  const anos = input.anosEliminados;
  const tiempoTxt =
    anos >= 1
      ? `${anos.toFixed(anos % 1 === 0 ? 0 : 1)} ${anos < 2 ? "año" : "años"}`
      : `${input.cuotasEliminadas} cuotas`;

  const mensaje =
    `Ese abono extra es como ${abonoComo}. ` +
    `Y con eso ahorras ${tiempoTxt} de deuda — el equivalente a ${ahorroComo}.`;

  return {
    abonoComo,
    ahorroComo,
    mensaje,
    cierre,
    perfilUsado: elegido.tipo,
  };
}
