import {
  Users, ShieldCheck, Activity, Layers, FileText, Wallet, BarChart3, Trophy,
  Briefcase, FolderKanban, MessageSquare, GraduationCap, Bot, ClipboardCheck,
  Receipt, CircleDollarSign, Landmark, Banknote, MapPin, FileCheck, Scale,
  PiggyBank, Calculator, LineChart, BookUser, BellRing, Send, Gavel,
} from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";
import type { QuickAction } from "@/components/home/widgets";

export interface RoleHomeKpi {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Users;
  tone?: "blue" | "green" | "warning" | "danger" | "neutral";
  /** Fuente declarativa (placeholder en Fase 6 — el RoleHome resuelve "—" si no se mapea). */
  source?:
    | "expedientes.total"
    | "expedientes.activos.miAsesor"
    | "expedientes.aprobados"
    | "expedientes.firmados"
    | "expedientes.pagados"
    | "notificaciones.criticas"
    | "static";
  staticValue?: string;
}

export interface RoleHomeConfig {
  rolLabel: string;
  subtitle: string;
  metricaEstrella?: {
    label: string;
    source: RoleHomeKpi["source"];
    tone?: "blue" | "green" | "warning" | "danger";
    staticValue?: string;
  };
  iaPrompt: { prompt: string; hint?: string };
  kpis: RoleHomeKpi[];
  quickActions: QuickAction[];
  recomendaciones: { id: string; title: string; detail?: string; tone?: "blue" | "green" | "warning" }[];
  /** Lo que NO se muestra (documental, sólo informativo). */
  excluye: string[];
}

// ─── Quick-action helpers compartidos ───────────────────────────────────────
const NUVIA_IA: QuickAction = { to: "/nuvia-ia", label: "NUVIA IA", desc: "Copiloto operativo", icon: Bot, tone: "green" };
const MENSAJERIA: QuickAction = { to: "/mensajeria", label: "Mensajería", desc: "Conversa con tu equipo", icon: MessageSquare, tone: "blue" };
const ACADEMIA: QuickAction = { to: "/academia", label: "Academia NUVIA", desc: "Capacitación y certificados", icon: GraduationCap, tone: "green" };

// ─── Configuración por rol ─────────────────────────────────────────────────
export const HOME_CONFIG: Partial<Record<AppRole, RoleHomeConfig>> = {
  super_admin: {
    rolLabel: "Super Admin",
    subtitle: "Salud operativa, seguridad y configuración global de la plataforma NUVIA.",
    metricaEstrella: { label: "Usuarios activos", source: "static", staticValue: "—", tone: "blue" },
    iaPrompt: {
      prompt: "Dame un resumen de incidencias de seguridad y accesos bloqueados de las últimas 24 horas.",
    },
    kpis: [
      { id: "users", label: "Usuarios activos", icon: Users, tone: "blue", source: "static" },
      { id: "mfa", label: "Cuentas sin MFA", icon: ShieldCheck, tone: "warning", source: "static" },
      { id: "audit", label: "Eventos auditoría 24h", icon: Activity, tone: "neutral", source: "static" },
      { id: "rls", label: "Cobertura RLS", icon: Layers, tone: "green", source: "static", staticValue: "100%" },
    ],
    quickActions: [
      { to: "/super-admin/usuarios", label: "Usuarios", desc: "Gestión de cuentas", icon: Users, tone: "blue" },
      { to: "/super-admin/permisos", label: "Permisos", desc: "Roles y RLS", icon: ShieldCheck, tone: "green" },
      { to: "/super-admin/marca", label: "Marca", desc: "Identidad NUVIA", icon: Layers, tone: "blue" },
      { to: "/super-admin/onboarding", label: "Onboarding", desc: "Plantillas y flujos", icon: ClipboardCheck, tone: "green" },
      { to: "/super-admin/accesos", label: "Auditoría", desc: "Trazabilidad de accesos", icon: Activity, tone: "blue" },
      { to: "/super-admin/nuvex-ia-kb", label: "NUVIA IA · KB", desc: "Base de conocimiento", icon: Bot, tone: "green" },
      NUVIA_IA,
      ACADEMIA,
    ],
    recomendaciones: [
      { id: "1", title: "Activa MFA obligatorio en cuentas con rol crítico", tone: "warning" },
      { id: "2", title: "Revisa la última corrida de auditoría de accesos", tone: "blue" },
    ],
    excluye: ["Detalle operativo de casos individuales", "Pipeline comercial personal"],
  },

  gerencia: {
    rolLabel: "Gerencia / Director",
    subtitle: "Visión 360° del negocio NUVIA. Decisiones basadas en KPIs consolidados.",
    metricaEstrella: { label: "Expedientes activos", source: "expedientes.total", tone: "blue" },
    iaPrompt: {
      prompt: "¿Cómo va el cierre del mes vs. el objetivo? Identifica los 3 mayores riesgos.",
      hint: "NUVIA IA cruzará pipeline, cartera y honorarios.",
    },
    kpis: [
      { id: "exp", label: "Expedientes totales", icon: FolderKanban, tone: "blue", source: "expedientes.total" },
      { id: "apr", label: "Aprobados", icon: ShieldCheck, tone: "green", source: "expedientes.aprobados" },
      { id: "firm", label: "Firmados", icon: FileText, tone: "blue", source: "expedientes.firmados" },
      { id: "pag", label: "Pagados", icon: Banknote, tone: "green", source: "expedientes.pagados" },
    ],
    quickActions: [
      { to: "/torre-control", label: "Torre de control", desc: "Visión consolidada", icon: BarChart3, tone: "blue" },
      { to: "/dashboard", label: "Dashboard ejecutivo", desc: "KPIs ejecutivos", icon: LineChart, tone: "green" },
      { to: "/comisiones", label: "Comisiones", desc: "Liquidaciones", icon: Wallet, tone: "blue" },
      { to: "/finanzas", label: "Finanzas", desc: "Tesorería", icon: Landmark, tone: "green" },
      { to: "/cartera", label: "Cartera", desc: "Aging y cobros", icon: CircleDollarSign, tone: "blue" },
      { to: "/honorarios", label: "Honorarios", desc: "Motor de honorarios", icon: Calculator, tone: "green" },
      NUVIA_IA,
      MENSAJERIA,
    ],
    recomendaciones: [
      { id: "1", title: "Top 3 asesores con mejor tasa de cierre este mes", tone: "green" },
      { id: "2", title: "Cartera +60 días requiere revisión esta semana", tone: "warning" },
    ],
    excluye: ["Configuración técnica del sistema", "KB de NUVIA IA"],
  },

  licenciado: {
    rolLabel: "Analista Financiero Comercial",
    subtitle: "Avanza tus casos, cierra comisiones y mantén tu cartera activa.",
    metricaEstrella: { label: "Mis casos activos", source: "expedientes.activos.miAsesor", tone: "blue" },
    iaPrompt: {
      prompt: "Dame el siguiente paso recomendado para mis 3 casos con más antigüedad sin movimiento.",
    },
    kpis: [
      { id: "mios", label: "Mis casos activos", icon: FolderKanban, tone: "blue", source: "expedientes.activos.miAsesor" },
      { id: "firm", label: "Mis firmados", icon: FileText, tone: "green", source: "static" },
      { id: "com", label: "Comisiones devengadas", icon: Wallet, tone: "blue", source: "static" },
      { id: "conv", label: "Tasa conversión", icon: Trophy, tone: "green", source: "static" },
    ],
    quickActions: [
      { to: "/casos", label: "Mis casos", desc: "Pipeline personal", icon: FolderKanban, tone: "blue" },
      { to: "/directorio", label: "Directorio", desc: "Mis clientes", icon: BookUser, tone: "green" },
      { to: "/herramientas/proyeccion", label: "Proyección financiera", desc: "Simulador", icon: LineChart, tone: "blue" },
      { to: "/comisiones", label: "Mis comisiones", desc: "Liquidación y wallet", icon: Wallet, tone: "green" },
      { to: "/wallet", label: "Mi wallet", desc: "Saldo y movimientos", icon: PiggyBank, tone: "blue" },
      MENSAJERIA,
      NUVIA_IA,
      ACADEMIA,
    ],
    recomendaciones: [
      { id: "1", title: "Programa seguimiento a tus 3 casos con más antigüedad", tone: "warning" },
      { id: "2", title: "Cierra los documentos pendientes del cliente para avanzar etapa", tone: "blue" },
    ],
    excluye: ["Casos de otros analistas", "KPIs globales", "Auditoría sistémica"],
  },

  // Analista Financiero (mapeado al rol más cercano si no existe enum propio).
  // Si el proyecto crea un rol "analista_financiero" futuro, replicar este bloque allá.
  director_financiero_qa: {
    rolLabel: "Auditor Financiero (Dir. Financiero QA)",
    subtitle: "Garantiza calidad, trazabilidad y conformidad de cada expediente antes de banco.",
    metricaEstrella: { label: "Casos por auditar", source: "static", tone: "warning", staticValue: "—" },
    iaPrompt: {
      prompt: "Lista los casos con discrepancias documentales más frecuentes esta semana.",
    },
    kpis: [
      { id: "qa", label: "Casos en cola QA", icon: ClipboardCheck, tone: "warning", source: "static" },
      { id: "halz", label: "Hallazgos abiertos", icon: FileCheck, tone: "danger", source: "static" },
      { id: "apr", label: "% aprobación QA", icon: ShieldCheck, tone: "green", source: "static" },
      { id: "t", label: "Tiempo medio revisión", icon: Activity, tone: "blue", source: "static" },
    ],
    quickActions: [
      { to: "/pipeline", label: "Cola QA", desc: "Pipeline pendiente revisión", icon: ClipboardCheck, tone: "blue" },
      { to: "/super-admin/accesos", label: "Auditoría accesos", desc: "Trazabilidad usuarios", icon: ShieldCheck, tone: "green" },
      { to: "/casos", label: "Validar radicación", desc: "Documentos finales", icon: FileCheck, tone: "blue" },
      { to: "/torre-control", label: "Torre de control", desc: "Vista global", icon: BarChart3, tone: "green" },
      NUVIA_IA,
      MENSAJERIA,
    ],
    recomendaciones: [
      { id: "1", title: "Revisa los casos rechazados en la última semana para identificar patrón", tone: "warning" },
      { id: "2", title: "Hallazgos por tipo: documentos vs. validación de identidad", tone: "blue" },
    ],
    excluye: ["Comisiones", "Crear casos", "Configuración de marca"],
  },

  juridica: {
    rolLabel: "Jurídica / Apoderado",
    subtitle: "Produce y valida documentos legales, controla vencimientos y firmas.",
    metricaEstrella: { label: "Documentos por generar", source: "static", tone: "blue", staticValue: "—" },
    iaPrompt: {
      prompt: "¿Qué poderes están próximos a vencer en los próximos 30 días?",
    },
    kpis: [
      { id: "doc", label: "Documentos por generar", icon: FileText, tone: "blue", source: "static" },
      { id: "pod", label: "Poderes vigentes", icon: Scale, tone: "green", source: "static" },
      { id: "con", label: "Contratos firmados mes", icon: Gavel, tone: "blue", source: "static" },
      { id: "ots", label: "Otrosíes pendientes", icon: ClipboardCheck, tone: "warning", source: "static" },
    ],
    quickActions: [
      { to: "/casos", label: "Generador legal", desc: "Documentos por expediente", icon: FileText, tone: "blue" },
      { to: "/apoderados-nuvex", label: "Apoderados", desc: "Registro y vigencia", icon: BookUser, tone: "green" },
      { to: "/casos", label: "Checklist documental", desc: "Estado por caso", icon: ClipboardCheck, tone: "blue" },
      NUVIA_IA,
      MENSAJERIA,
      ACADEMIA,
    ],
    recomendaciones: [
      { id: "1", title: "Renueva los poderes que vencen este mes", tone: "warning" },
      { id: "2", title: "Valida identidades pendientes antes de generar contrato", tone: "blue" },
    ],
    excluye: ["KPIs financieros globales", "Comisiones", "Auditoría sistémica"],
  },

  operaciones: {
    rolLabel: "Operaciones",
    subtitle: "Coordina envíos, radicación y entregables con bancos y aliados.",
    metricaEstrella: { label: "Envíos pendientes", source: "static", tone: "warning", staticValue: "—" },
    iaPrompt: {
      prompt: "¿Qué bancos están con SLA en riesgo hoy?",
    },
    kpis: [
      { id: "env", label: "Envíos pendientes", icon: Send, tone: "warning", source: "static" },
      { id: "rad", label: "Radicaciones del día", icon: FileCheck, tone: "blue", source: "static" },
      { id: "vnc", label: "Entregables vencidos", icon: BellRing, tone: "danger", source: "static" },
      { id: "sla", label: "SLA cumplido", icon: ShieldCheck, tone: "green", source: "static" },
    ],
    quickActions: [
      { to: "/casos", label: "Checklist envío", desc: "Por expediente", icon: ClipboardCheck, tone: "blue" },
      { to: "/casos", label: "Radicación", desc: "Confirmar entrega", icon: FileCheck, tone: "green" },
      { to: "/super-admin/marca", label: "Productos bancarios", desc: "Configuración", icon: Briefcase, tone: "blue" },
      { to: "/torre-control", label: "Cobertura ciudades", desc: "Mapa operativo", icon: MapPin, tone: "green" },
      NUVIA_IA,
      MENSAJERIA,
    ],
    recomendaciones: [
      { id: "1", title: "Bancos sin respuesta >48h: escalar contacto comercial", tone: "warning" },
      { id: "2", title: "Programa las radicaciones de mañana antes del cierre de hoy", tone: "blue" },
    ],
    excluye: ["Análisis financiero detallado", "Comisiones"],
  },

  cartera: {
    rolLabel: "Cartera / Contabilidad",
    subtitle: "Recupera cartera, concilia pagos y mantén el flujo de caja sano.",
    metricaEstrella: { label: "Cartera vencida", source: "static", tone: "danger", staticValue: "—" },
    iaPrompt: {
      prompt: "Dame el top 10 de deudores con mayor antigüedad y propuesta de gestión.",
    },
    kpis: [
      { id: "ven", label: "Cartera vencida", icon: CircleDollarSign, tone: "danger", source: "static" },
      { id: "pag", label: "Pagos del día", icon: Banknote, tone: "green", source: "static" },
      { id: "cob", label: "Cuentas de cobro pendientes", icon: Receipt, tone: "warning", source: "static" },
      { id: "dso", label: "DSO promedio", icon: Activity, tone: "blue", source: "static" },
    ],
    quickActions: [
      { to: "/cartera", label: "Cartera", desc: "Aging y gestión", icon: CircleDollarSign, tone: "blue" },
      { to: "/finanzas", label: "Finanzas", desc: "Tesorería", icon: Landmark, tone: "green" },
      { to: "/comisiones", label: "Comisiones", desc: "Liquidación", icon: Wallet, tone: "blue" },
      { to: "/wallet", label: "Wallet", desc: "Saldos", icon: PiggyBank, tone: "green" },
      NUVIA_IA,
      MENSAJERIA,
    ],
    recomendaciones: [
      { id: "1", title: "Genera cuentas de cobro para vencimientos de esta semana", tone: "warning" },
      { id: "2", title: "Concilia pagos pendientes antes del cierre contable", tone: "blue" },
    ],
    excluye: ["Configuración técnica", "KB IA"],
  },
};

// Aliases — varios códigos de rol comparten el mismo Home
HOME_CONFIG.admin = HOME_CONFIG.super_admin;
HOME_CONFIG.director_juridico = HOME_CONFIG.juridica;
HOME_CONFIG.apoderado = HOME_CONFIG.juridica;
HOME_CONFIG.auxiliar_operativo = HOME_CONFIG.operaciones;
HOME_CONFIG.contabilidad = HOME_CONFIG.cartera;
HOME_CONFIG.asesor = HOME_CONFIG.licenciado;
