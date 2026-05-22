import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GraduationCap, BookOpen, FileText, Calculator, TrendingUp, Wallet,
  ClipboardCheck, Receipt, Trophy, Library, Bot, CheckCircle2, XCircle,
  ArrowLeft, ArrowRight, Clock, Sparkles, ChevronRight, Lock, FileBadge,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/academia")({
  component: AcademiaPage,
  head: () => ({ meta: [{ title: "Academia NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const NEGRO = "#242424";

// ============ TIPOS ============
type Modulo = {
  id: string;
  numero: number;
  titulo: string;
  emoji: string;
  Icon: typeof BookOpen;
  descripcion: string;
  tiempo: string;
  secciones: { titulo: string; puntos: string[] }[];
  quiz?: { pregunta: string; opciones: string[]; correcta: number }[];
};

// ============ CONTENIDO ============
const MODULOS: Modulo[] = [
  {
    id: "intro",
    numero: 1,
    titulo: "Introducción a NUVEX",
    emoji: "🏦",
    Icon: BookOpen,
    descripcion: "Fundamentos del modelo NUVEX, marco legal y flujo operativo del licenciado.",
    tiempo: "10 min",
    secciones: [
      {
        titulo: "Qué es NUVEX",
        puntos: [
          "NUVEX es una fintech colombiana especializada en optimización de créditos hipotecarios.",
          "Operamos bajo el principio: el ahorro no es un lujo, es un derecho.",
          "Trabajamos a través de licenciados certificados que ejecutan la metodología NUVEX.",
        ],
      },
      {
        titulo: "Problema que resolvemos",
        puntos: [
          "Los deudores hipotecarios pagan miles de millones en intereses innecesarios.",
          "La mayoría desconoce mecanismos legales para optimizar su crédito.",
          "NUVEX construye propuestas técnicas avaladas por la Ley 546 de 1999.",
        ],
      },
      {
        titulo: "Ley 546 de 1999",
        puntos: [
          "Marco legal del sistema de financiación de vivienda en Colombia.",
          "Permite reestructuración, prepagos sin penalidad y conversión entre sistemas (UVR ↔ Pesos).",
          "Soporta las propuestas técnicas presentadas a las entidades bancarias.",
        ],
      },
      {
        titulo: "Cómo gana un licenciado",
        puntos: [
          "Modelo a éxito: cobra honorarios solo cuando el caso es aprobado.",
          "Honorarios estándar: 6% sobre el ahorro generado al cliente.",
          "Mínimo institucional: $2.000.000 por caso aprobado.",
        ],
      },
      {
        titulo: "Flujo completo de un caso",
        puntos: [
          "1. Captación → 2. Simulación → 3. Radicación → 4. Aprobación → 5. Cuenta de cobro.",
          "Cada etapa queda registrada en el expediente digital del licenciado.",
        ],
      },
    ],
    quiz: [
      {
        pregunta: "¿Cuál es el porcentaje estándar de honorarios NUVEX?",
        opciones: ["4%", "5%", "6%", "8%"],
        correcta: 2,
      },
      {
        pregunta: "¿Cuál es el honorario mínimo NUVEX por caso aprobado?",
        opciones: ["$1.000.000", "$1.500.000", "$2.000.000", "$3.000.000"],
        correcta: 2,
      },
    ],
  },
  {
    id: "extractos",
    numero: 2,
    titulo: "Lectura de Extractos",
    emoji: "📄",
    Icon: FileText,
    descripcion: "Cómo interpretar extractos bancarios por entidad y extraer los datos clave.",
    tiempo: "20 min",
    secciones: [
      {
        titulo: "Conceptos universales",
        puntos: [
          "Saldo a capital: monto adeudado real sin intereses futuros.",
          "Valor de cuota: incluye capital + intereses + seguros.",
          "Seguros: vida deudores e incendio/terremoto (separados del crédito).",
          "TEA (Tasa Efectiva Anual) vs Tasa mensual: relación matemática.",
          "Capital vs Intereses: composición variable según amortización.",
          "UVR vs Pesos: dos sistemas con lógica de actualización distinta.",
          "Cuotas pagadas vs pendientes: base para proyección.",
        ],
      },
      {
        titulo: "Bancolombia",
        puntos: ["Buscar bloque 'Información del crédito'.", "Saldo capital aparece destacado en encabezado."],
      },
      { titulo: "Davivienda", puntos: ["Extracto mensual. Verificar 'Capital pendiente'."] },
      { titulo: "Caja Social", puntos: ["Revisar histórico de pagos para confirmar cuotas pagadas."] },
      { titulo: "Banco de Bogotá", puntos: ["Solicitar paz y salvo proyectado para validar TEA actual."] },
      { titulo: "FNA", puntos: ["Sistema UVR. Validar valor UVR a la fecha del extracto."] },
      { titulo: "Davibank / La Hipotecaria / Occidente / AV Villas", puntos: ["Patrones similares: identificar capital, cuota y plazo restante."] },
      { titulo: "Caja Honor", puntos: ["Régimen especial fuerzas militares. Confirmar tasa preferencial vigente."] },
    ],
  },
  {
    id: "pesos",
    numero: 3,
    titulo: "Simulador en Pesos",
    emoji: "💰",
    Icon: Calculator,
    descripcion: "Operación paso a paso del simulador en pesos NUVEX.",
    tiempo: "15 min",
    secciones: [
      {
        titulo: "Flujo operativo",
        puntos: [
          "1. Crear simulación desde el módulo Simulador.",
          "2. Ingresar datos del crédito actual (saldo, cuota, plazo, TEA).",
          "3. Interpretar resultados generados automáticamente.",
          "4. Analizar las propuestas comparativas.",
          "5. Seleccionar la propuesta óptima para el cliente.",
          "6. Usar calculadora manual para ajustes finos.",
          "7. Aplicar descuentos comerciales si aplica.",
          "8. Generar PDF ejecutivo para presentar al cliente.",
        ],
      },
    ],
  },
  {
    id: "uvr",
    numero: 4,
    titulo: "Simulador UVR",
    emoji: "📈",
    Icon: TrendingUp,
    descripcion: "Comprensión y operación del simulador UVR con escenarios de 240 y 360 meses.",
    tiempo: "20 min",
    secciones: [
      {
        titulo: "Qué es la UVR",
        puntos: [
          "Unidad de Valor Real: unidad de cuenta indexada a la inflación.",
          "Actualización diaria con base en el IPC del mes anterior.",
        ],
      },
      {
        titulo: "Conceptos clave",
        puntos: [
          "Corrección monetaria: ajuste del capital por inflación.",
          "Cuota sin seguros: base de cálculo real.",
          "Número de veces pagado: indicador de impacto del sistema.",
          "Escenarios 240 meses (20 años) y 360 meses (30 años).",
        ],
      },
    ],
  },
  {
    id: "honorarios",
    numero: 5,
    titulo: "Honorarios NUVEX",
    emoji: "💵",
    Icon: Wallet,
    descripcion: "Modelo de honorarios, descuentos y manejo de objeciones.",
    tiempo: "10 min",
    secciones: [
      {
        titulo: "Modelo a éxito",
        puntos: [
          "Solo se cobra si el caso es aprobado por el banco.",
          "Regla del 6% sobre el ahorro total generado.",
          "Honorario mínimo: $2.000.000.",
          "Descuento comercial máximo permitido: validar con gerencia.",
        ],
      },
      {
        titulo: "Manejo de objeciones",
        puntos: [
          "'Es muy caro': cuantificar el ahorro neto vs el honorario.",
          "'Lo hago solo': mostrar la complejidad técnica del proceso.",
          "'Lo pienso': agendar seguimiento con propuesta impresa.",
        ],
      },
    ],
    quiz: [
      {
        pregunta: "Si el ahorro total del cliente es $50.000.000, ¿cuál es el honorario estándar?",
        opciones: ["$2.000.000", "$2.500.000", "$3.000.000", "$5.000.000"],
        correcta: 2,
      },
    ],
  },
  {
    id: "resultado",
    numero: 6,
    titulo: "Resultado Final del Proceso",
    emoji: "📑",
    Icon: ClipboardCheck,
    descripcion: "Cómo cargar la respuesta del banco y generar el informe final.",
    tiempo: "10 min",
    secciones: [
      {
        titulo: "Paso a paso",
        puntos: [
          "Cargar respuesta oficial del banco al expediente.",
          "Comparar valores proyectados vs valores aprobados.",
          "Calcular acertividad de la propuesta.",
          "Generar informe final ejecutivo en PDF.",
        ],
      },
    ],
  },
  {
    id: "cuenta-cobro",
    numero: 7,
    titulo: "Cuenta de Cobro",
    emoji: "🧾",
    Icon: Receipt,
    descripcion: "Generación de cuenta de cobro y facturación correcta.",
    tiempo: "5 min",
    secciones: [
      {
        titulo: "Lineamientos",
        puntos: [
          "Generar cuenta de cobro desde el expediente aprobado.",
          "Validar descuentos comerciales aplicados.",
          "Verificar que cumpla honorario mínimo institucional.",
          "Emitir factura conforme a régimen tributario del licenciado.",
        ],
      },
    ],
  },
];

const CASOS_REALES = [
  {
    cliente: "Caso 001 — Bancolombia UVR",
    antes: { banco: "Bancolombia", saldo: 145_000_000, cuota: 1_820_000, plazo: "180 meses" },
    propuesta: { nuevaCuota: 1_310_000, cuotasEliminadas: 64 },
    resultado: { tiempo: "5 años 4 meses", ahorroIntereses: 58_400_000, ahorroSeguros: 7_200_000, ahorroTotal: 65_600_000 },
  },
  {
    cliente: "Caso 002 — Davivienda Pesos",
    antes: { banco: "Davivienda", saldo: 98_500_000, cuota: 1_240_000, plazo: "144 meses" },
    propuesta: { nuevaCuota: 980_000, cuotasEliminadas: 42 },
    resultado: { tiempo: "3 años 6 meses", ahorroIntereses: 31_200_000, ahorroSeguros: 4_100_000, ahorroTotal: 35_300_000 },
  },
  {
    cliente: "Caso 003 — FNA UVR 360",
    antes: { banco: "FNA", saldo: 210_000_000, cuota: 2_410_000, plazo: "320 meses" },
    propuesta: { nuevaCuota: 1_780_000, cuotasEliminadas: 108 },
    resultado: { tiempo: "9 años", ahorroIntereses: 102_600_000, ahorroSeguros: 14_800_000, ahorroTotal: 117_400_000 },
  },
];

const DOCUMENTOS = [
  { nombre: "Ley 546 de 1999", tipo: "Marco Legal" },
  { nombre: "Manual Comercial NUVEX", tipo: "Operativo" },
  { nombre: "Manual Operativo del Licenciado", tipo: "Operativo" },
  { nombre: "Formato de Radicación", tipo: "Formato" },
  { nombre: "Poder Especial Hipotecario", tipo: "Plantilla Legal" },
  { nombre: "Contrato de Prestación de Servicios", tipo: "Plantilla Legal" },
  { nombre: "Derecho de Petición – Modelo", tipo: "Plantilla Legal" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

// ============ COMPONENTE PRINCIPAL ============
function AcademiaPage() {
  const [view, setView] = useState<"home" | { type: "modulo"; id: string }>("home");
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [aprobados, setAprobados] = useState<Set<string>>(new Set());

  const progreso = useMemo(() => {
    const total = MODULOS.length;
    const done = completados.size;
    return { total, done, pendientes: total - done, casos: CASOS_REALES.length, evaluaciones: aprobados.size };
  }, [completados, aprobados]);

  return (
    <div className="relative min-h-[calc(100vh-92px)] overflow-hidden" style={{ background: "#050816" }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[700px] rounded-full opacity-[0.10] blur-[140px]" style={{ background: AZUL }} />
        <div className="absolute top-40 right-1/4 h-[500px] w-[700px] rounded-full opacity-[0.08] blur-[140px]" style={{ background: VERDE }} />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-6 py-10">
        {view === "home" ? (
          <AcademiaHome
            progreso={progreso}
            completados={completados}
            onOpen={(id) => setView({ type: "modulo", id })}
          />
        ) : (
          <ModuloDetalle
            moduloId={view.id}
            onBack={() => setView("home")}
            onComplete={(id) => setCompletados((s) => new Set(s).add(id))}
            onAprobado={(id) => setAprobados((s) => new Set(s).add(id))}
            completado={completados.has(view.id)}
            aprobado={aprobados.has(view.id)}
          />
        )}
      </div>
    </div>
  );
}

// ============ HOME ============
function AcademiaHome({
  progreso,
  completados,
  onOpen,
}: {
  progreso: { total: number; done: number; pendientes: number; casos: number; evaluaciones: number };
  completados: Set<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="space-y-5">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: `linear-gradient(135deg, ${VERDE}26, ${VERDE}10)`,
            border: `1px solid ${VERDE}55`,
            color: VERDE,
          }}
        >
          <Sparkles size={12} /> Formación Oficial NUVEX
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
          Academia <span style={{ background: `linear-gradient(135deg, #fff, ${VERDE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NUVEX</span>
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-white/65">
          Aprende a interpretar créditos hipotecarios, construir propuestas financieras y gestionar
          procesos exitosos bajo la metodología NUVEX. Capacitación oficial, técnica y comercial para licenciados.
        </p>
      </section>

      {/* PROGRESO */}
      <section>
        <GlassCard className="p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Mi progreso</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {progreso.done} de {progreso.total} módulos completados
              </div>
              <div className="mt-3 h-2 w-full md:w-[420px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(progreso.done / progreso.total) * 100}%`,
                    background: `linear-gradient(90deg, ${AZUL}, ${VERDE})`,
                    boxShadow: `0 0 16px ${VERDE}80`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Completados" value={progreso.done} color={VERDE} />
              <MiniStat label="Pendientes" value={progreso.pendientes} color={AZUL} />
              <MiniStat label="Casos estudiados" value={progreso.casos} color="#C9A84C" />
              <MiniStat label="Evaluaciones" value={progreso.evaluaciones} color={VERDE} />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* MÓDULOS */}
      <section className="space-y-5">
        <SectionTitle eyebrow="Plan de estudios" title="Módulos de aprendizaje" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULOS.map((m) => (
            <ModuloCard key={m.id} m={m} completado={completados.has(m.id)} onClick={() => onOpen(m.id)} />
          ))}
        </div>
      </section>

      {/* CASOS REALES */}
      <section className="space-y-5">
        <SectionTitle
          eyebrow="Módulo 8"
          title="Casos Reales NUVEX"
          subtitle="Biblioteca visual de casos aprobados — Antes, Propuesta y Resultado."
          icon={<Trophy size={16} style={{ color: VERDE }} />}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {CASOS_REALES.map((c, i) => <CasoCard key={i} c={c} />)}
        </div>
      </section>

      {/* BIBLIOTECA DOCUMENTAL */}
      <section className="space-y-5">
        <SectionTitle eyebrow="Recursos" title="Documentos NUVEX" icon={<Library size={16} style={{ color: AZUL }} />} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCUMENTOS.map((d, i) => (
            <GlassCard key={i} className="group flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${AZUL}33, ${AZUL}10)`,
                  border: `1px solid ${AZUL}44`,
                }}
              >
                <FileBadge size={20} style={{ color: AZUL }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-white truncate">{d.nombre}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/45 mt-0.5">{d.tipo}</div>
              </div>
              <Lock size={14} className="text-white/35" />
            </GlassCard>
          ))}
        </div>
      </section>

      {/* NUVEX IA */}
      <section>
        <div
          className="relative overflow-hidden rounded-[24px] p-8 md:p-10"
          style={{
            background: "linear-gradient(135deg, rgba(68,93,163,0.18), rgba(132,185,143,0.10))",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-30 blur-[100px]" style={{ background: AZUL }} />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                boxShadow: `0 12px 32px -12px ${VERDE}`,
              }}
            >
              <Bot size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)" }}>
                Próximamente
              </div>
              <div className="text-2xl font-semibold text-white">NUVEX IA</div>
              <p className="mt-1 text-[14px] text-white/65 max-w-2xl">
                Próximamente podrás consultar cualquier duda operativa o comercial directamente con
                la inteligencia artificial de NUVEX, entrenada con todo el conocimiento institucional.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============ MÓDULO DETALLE ============
function ModuloDetalle({
  moduloId,
  onBack,
  onComplete,
  onAprobado,
  completado,
  aprobado,
}: {
  moduloId: string;
  onBack: () => void;
  onComplete: (id: string) => void;
  onAprobado: (id: string) => void;
  completado: boolean;
  aprobado: boolean;
}) {
  const m = MODULOS.find((x) => x.id === moduloId)!;
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [evaluado, setEvaluado] = useState(false);

  const score = useMemo(() => {
    if (!m.quiz) return { ok: 0, total: 0 };
    let ok = 0;
    m.quiz.forEach((q, i) => { if (respuestas[i] === q.correcta) ok++; });
    return { ok, total: m.quiz.length };
  }, [respuestas, m.quiz]);

  const evaluar = () => {
    setEvaluado(true);
    if (m.quiz && score.ok === score.total) onAprobado(m.id);
  };

  return (
    <div className="space-y-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Volver a la Academia
      </button>

      <GlassCard className="p-8 md:p-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ background: `linear-gradient(135deg, ${AZUL}22, ${VERDE}22)`, border: "1px solid rgba(255,255,255,0.10)" }}
            >
              {m.emoji}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Módulo {m.numero}</div>
              <h1 className="mt-1 text-3xl font-semibold text-white">{m.titulo}</h1>
              <p className="mt-2 max-w-2xl text-[14px] text-white/60">{m.descripcion}</p>
              <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/55">
                <Clock size={13} /> {m.tiempo}
              </div>
            </div>
          </div>
          {completado && (
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: `${VERDE}22`, border: `1px solid ${VERDE}66`, color: VERDE }}>
              <CheckCircle2 size={13} /> Completado
            </div>
          )}
        </div>
      </GlassCard>

      <div className="space-y-5">
        {m.secciones.map((s, i) => (
          <GlassCard key={i} className="p-7">
            <div className="flex items-baseline gap-3">
              <div className="text-[11px] font-mono text-white/40">{String(i + 1).padStart(2, "0")}</div>
              <h2 className="text-xl font-semibold text-white">{s.titulo}</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {s.puntos.map((p, j) => (
                <li key={j} className="flex gap-3 text-[14px] leading-relaxed text-white/75">
                  <ChevronRight size={16} className="mt-1 shrink-0" style={{ color: VERDE }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>

      {/* QUIZ */}
      {m.quiz && (
        <GlassCard className="p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: `${AZUL}22`, border: `1px solid ${AZUL}55` }}>
              <ClipboardCheck size={18} style={{ color: AZUL }} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Evaluación</div>
              <h2 className="text-xl font-semibold text-white">Pon a prueba lo aprendido</h2>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {m.quiz.map((q, qi) => (
              <div key={qi}>
                <div className="text-[14px] font-medium text-white">{qi + 1}. {q.pregunta}</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.opciones.map((opt, oi) => {
                    const selected = respuestas[qi] === oi;
                    const correctAnswer = evaluado && oi === q.correcta;
                    const wrongPick = evaluado && selected && oi !== q.correcta;
                    return (
                      <button
                        key={oi}
                        disabled={evaluado}
                        onClick={() => setRespuestas((r) => ({ ...r, [qi]: oi }))}
                        className="group flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] transition-all"
                        style={{
                          background: correctAnswer
                            ? `${VERDE}22`
                            : wrongPick
                            ? "rgba(244,67,54,0.10)"
                            : selected
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(255,255,255,0.02)",
                          border: `1px solid ${
                            correctAnswer ? `${VERDE}88` : wrongPick ? "rgba(244,67,54,0.5)" : selected ? `${AZUL}66` : "rgba(255,255,255,0.06)"
                          }`,
                          color: "rgba(255,255,255,0.85)",
                        }}
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{
                            border: `1.5px solid ${selected ? VERDE : "rgba(255,255,255,0.25)"}`,
                            background: selected ? VERDE : "transparent",
                          }}
                        >
                          {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="flex-1">{opt}</span>
                        {correctAnswer && <CheckCircle2 size={15} style={{ color: VERDE }} />}
                        {wrongPick && <XCircle size={15} className="text-red-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {!evaluado ? (
              <button
                onClick={evaluar}
                disabled={Object.keys(respuestas).length < m.quiz.length}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                  boxShadow: `0 10px 28px -12px ${VERDE}`,
                }}
              >
                Evaluar respuestas <ArrowRight size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold"
                  style={{
                    background: score.ok === score.total ? `${VERDE}22` : "rgba(244,67,54,0.10)",
                    border: `1px solid ${score.ok === score.total ? `${VERDE}66` : "rgba(244,67,54,0.5)"}`,
                    color: score.ok === score.total ? VERDE : "#fca5a5",
                  }}
                >
                  {score.ok === score.total ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {score.ok === score.total ? "Aprobado" : "Requiere repaso"} · {score.ok}/{score.total}
                </div>
                <button
                  onClick={() => { setEvaluado(false); setRespuestas({}); }}
                  className="text-[12px] font-medium text-white/60 hover:text-white"
                >
                  Reintentar
                </button>
              </div>
            )}
            {aprobado && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: VERDE }}>
                Evaluación aprobada ✓
              </div>
            )}
          </div>
        </GlassCard>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white/75 hover:text-white transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <ArrowLeft size={14} /> Volver
        </button>
        <button
          onClick={() => { onComplete(m.id); onBack(); }}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5"
          style={{
            background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
            boxShadow: `0 12px 32px -12px ${VERDE}`,
          }}
        >
          <CheckCircle2 size={15} /> Marcar como completado
        </button>
      </div>
    </div>
  );
}

// ============ COMPONENTES AUX ============
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] ${className}`}
      style={{
        background: "linear-gradient(180deg, rgba(10,22,40,0.85), rgba(7,18,33,0.85))",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 20px 50px -28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle, icon }: { eyebrow: string; title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
        {icon} {eyebrow}
      </div>
      <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[13px] text-white/55">{subtitle}</p>}
    </div>
  );
}

function ModuloCard({ m, completado, onClick }: { m: Modulo; completado: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col text-left overflow-hidden rounded-[20px] p-6 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "linear-gradient(180deg, rgba(10,22,40,0.85), rgba(7,18,33,0.85))",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 14px 40px -24px rgba(0,0,0,0.7)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = `1px solid ${AZUL}55`;
        e.currentTarget.style.boxShadow = `0 18px 48px -22px ${AZUL}99`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "0 14px 40px -24px rgba(0,0,0,0.7)";
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[20px]"
        style={{ background: completado ? VERDE : `linear-gradient(180deg, ${AZUL}, ${VERDE})` }} />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ background: `linear-gradient(135deg, ${AZUL}26, ${VERDE}1A)`, border: "1px solid rgba(255,255,255,0.08)" }}>
            {m.emoji}
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/45">Módulo {m.numero}</div>
            <div className="text-[10.5px] text-white/50 inline-flex items-center gap-1 mt-0.5">
              <Clock size={11} /> {m.tiempo}
            </div>
          </div>
        </div>
        {completado && <CheckCircle2 size={18} style={{ color: VERDE }} />}
      </div>

      <h3 className="mt-5 text-[17px] font-semibold text-white">{m.titulo}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 line-clamp-3 flex-1">{m.descripcion}</p>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[12px] font-semibold" style={{ color: VERDE }}>
          {completado ? "Repasar" : "Continuar"}
        </span>
        <ArrowRight size={16} className="text-white/60 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function CasoCard({ c }: { c: typeof CASOS_REALES[number] }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: VERDE }}>
          Caso real
        </div>
        <Trophy size={14} style={{ color: VERDE }} />
      </div>
      <div className="mt-2 text-[16px] font-semibold text-white">{c.cliente}</div>

      <div className="mt-5 space-y-3">
        <Bloque titulo="Antes" color="#94a3b8">
          <Linea k="Banco" v={c.antes.banco} />
          <Linea k="Saldo" v={fmt(c.antes.saldo)} />
          <Linea k="Cuota" v={fmt(c.antes.cuota)} />
          <Linea k="Plazo" v={c.antes.plazo} />
        </Bloque>

        <Bloque titulo="Propuesta NUVEX" color={AZUL}>
          <Linea k="Nueva cuota" v={fmt(c.propuesta.nuevaCuota)} highlight />
          <Linea k="Cuotas eliminadas" v={String(c.propuesta.cuotasEliminadas)} highlight />
        </Bloque>

        <Bloque titulo="Resultado" color={VERDE}>
          <Linea k="Tiempo eliminado" v={c.resultado.tiempo} />
          <Linea k="Ahorro intereses" v={fmt(c.resultado.ahorroIntereses)} />
          <Linea k="Ahorro seguros" v={fmt(c.resultado.ahorroSeguros)} />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: `${VERDE}1A`, border: `1px solid ${VERDE}55` }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: VERDE }}>Ahorro total</span>
            <span className="text-[14px] font-bold" style={{ color: VERDE }}>{fmt(c.resultado.ahorroTotal)}</span>
          </div>
        </Bloque>
      </div>
    </GlassCard>
  );
}

function Bloque({ titulo, color, children }: { titulo: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color }}>{titulo}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Linea({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-white/55">{k}</span>
      <span className={highlight ? "font-semibold text-white" : "text-white/85"}>{v}</span>
    </div>
  );
}
