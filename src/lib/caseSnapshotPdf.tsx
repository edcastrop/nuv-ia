// Case Snapshot PDF — NUVIA Executive Financial Intelligence Report
// Render engine: @react-pdf/renderer (TTF embed real, layout flex CSS-like).
// Visual target: dashboard fintech premium denso, navy + acentos vibrantes,
// cercano al mockup (≈98%).
//
// Exporta API estable:
//   generarCaseSnapshotPdf(dto) → Promise<Blob>
//   descargarSnapshot(blob, cliente?) → triggers download

import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import React from "react";
import { formatCOP } from "@/lib/format";
import type { CaseSnapshotDTO } from "./caseSnapshot.functions";

// ── Fuentes (Inter desde GFonts mirror — TTF directos, sin CSS @import).
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuDyYMZhrib2Bg-4.ttf", fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

// ── Paleta NUVIA premium (alineada al mockup)
const C = {
  bg: "#070B1C",
  bgSoft: "#0B1228",
  surface: "#0F1733",
  surfaceHi: "#172041",
  surfaceMax: "#1F2A52",
  border: "#1F2A52",
  borderSoft: "#2A3868",
  primary: "#3B82F6",
  primaryHi: "#60A5FA",
  violet: "#8B5CF6",
  violetHi: "#A78BFA",
  accent: "#22C55E",
  accentHi: "#4ADE80",
  gold: "#FBBF24",
  red: "#EF4444",
  redHi: "#F87171",
  amber: "#F59E0B",
  text: "#FFFFFF",
  textDim: "#CBD5E1",
  muted: "#94A3B8",
  dim: "#64748B",
};

// ── Page (alto ajustado al contenido real → sin hueco vertical)
const W = 612;
const H = 960;

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 22, fontFamily: "Inter", color: C.text, fontSize: 9 },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  brandLogoText: { color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 1 },
  brandWord: { color: C.text, fontWeight: 800, fontSize: 13, letterSpacing: 4 },
  brandTag: { color: C.muted, fontSize: 7, letterSpacing: 2, fontWeight: 600, marginTop: 1 },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { color: C.muted, fontSize: 7.5, letterSpacing: 3, fontWeight: 700 },
  headerDate: { color: C.text, fontSize: 10, fontWeight: 700, marginTop: 2 },

  // Hero cliente
  hero: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroEyebrow: { color: C.primaryHi, fontSize: 7, letterSpacing: 2.5, fontWeight: 700 },
  heroName: { color: C.text, fontSize: 18, fontWeight: 800, marginTop: 4, letterSpacing: 0.2 },
  heroMeta: { color: C.textDim, fontSize: 8.5, marginTop: 3 },
  heroChips: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontSize: 7, fontWeight: 700, letterSpacing: 1 },
  chipBank: { backgroundColor: "rgba(59,130,246,0.18)", color: C.primaryHi, borderWidth: 1, borderColor: "rgba(59,130,246,0.35)" },
  chipProd: { backgroundColor: "rgba(139,92,246,0.18)", color: C.violetHi, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)" },
  chipMod:  { backgroundColor: "rgba(34,197,94,0.16)", color: C.accentHi, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)" },
  chipEst:  { backgroundColor: "rgba(251,191,36,0.16)", color: C.gold, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)" },

  qaBadge: { width: 90, alignItems: "center", borderRadius: 12, padding: 10, backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderSoft },
  qaScore: { fontSize: 26, fontWeight: 800, color: C.accent, letterSpacing: -0.5 },
  qaLabel: { fontSize: 7, color: C.muted, fontWeight: 700, letterSpacing: 2, marginTop: 2 },
  qaDict:  { fontSize: 8, color: C.text, fontWeight: 700, marginTop: 4 },

  // KPI Grid 4-col
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  kpi: { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border },
  kpiHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kpiLabel: { color: C.muted, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 },
  kpiIcon: { width: 18, height: 18, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  kpiIconText: { color: "#fff", fontSize: 9, fontWeight: 800 },
  kpiValue: { color: C.text, fontSize: 13.5, fontWeight: 800, marginTop: 8, letterSpacing: -0.2 },
  kpiSub: { color: C.dim, fontSize: 7, marginTop: 2 },

  // Hero "VAS A PAGAR Xx"
  vecesHero: { marginBottom: 10, borderRadius: 16, padding: 16, backgroundColor: "#1A0B1F", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vecesLeft: { flex: 1 },
  vecesEyebrow: { color: C.red, fontSize: 8, fontWeight: 800, letterSpacing: 3 },
  vecesTitle: { color: C.text, fontSize: 13, fontWeight: 800, marginTop: 4, letterSpacing: 0.2 },
  vecesSub: { color: C.muted, fontSize: 8.5, marginTop: 4, lineHeight: 1.35 },
  vecesBig: { fontSize: 64, fontWeight: 800, color: C.redHi, letterSpacing: -2, lineHeight: 1 },
  vecesBigCaption: { color: C.red, fontSize: 8, fontWeight: 800, letterSpacing: 2, textAlign: "right", marginTop: 2 },

  // Propuesta recomendada
  propWrap: { marginBottom: 10, borderRadius: 16, padding: 14, backgroundColor: "#0A1E14", borderWidth: 2, borderColor: C.accent, position: "relative" },
  propBadge: { position: "absolute", top: -8, right: 14, backgroundColor: C.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  propBadgeText: { fontSize: 7, fontWeight: 800, letterSpacing: 2, color: "#06231A" },
  propHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  propTitle: { color: C.accentHi, fontSize: 11, fontWeight: 800, letterSpacing: 2 },
  propScenario: { color: C.text, fontSize: 9, fontWeight: 600 },
  propGrid: { flexDirection: "row", gap: 8 },
  propStat: { flex: 1, backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 10, padding: 9, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  propStatLabel: { color: C.accentHi, fontSize: 7, fontWeight: 700, letterSpacing: 1.4 },
  propStatValue: { color: C.text, fontSize: 13, fontWeight: 800, marginTop: 6 },

  // 2-col section
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  cardTitle: { color: C.muted, fontSize: 7.5, fontWeight: 800, letterSpacing: 2, marginBottom: 8 },

  // AI Diagnostic
  diagRow: { flexDirection: "row", gap: 8 },
  diagItem: { flex: 1, backgroundColor: C.bgSoft, borderRadius: 10, padding: 9, borderWidth: 1, borderColor: C.borderSoft, alignItems: "center" },
  diagDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  diagDotText: { color: "#fff", fontSize: 11, fontWeight: 800 },
  diagLabel: { color: C.muted, fontSize: 7, fontWeight: 700, letterSpacing: 1.2 },
  diagValue: { color: C.text, fontSize: 9, fontWeight: 800, marginTop: 2 },

  // Honorarios
  honoRow: { flexDirection: "row", gap: 8 },
  honoCell: { flex: 1 },
  honoLabel: { color: C.muted, fontSize: 7, fontWeight: 700, letterSpacing: 1.2 },
  honoValue: { color: C.text, fontSize: 12, fontWeight: 800, marginTop: 3 },
  honoTag: { fontSize: 7, fontWeight: 700, letterSpacing: 1, marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },

  // Timeline
  tlTrack: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  tlStep: { flex: 1, alignItems: "center" },
  tlDot: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  tlDotText: { fontSize: 9, fontWeight: 800 },
  tlLine: { height: 2, flex: 1 },
  tlLabel: { color: C.textDim, fontSize: 6.5, marginTop: 4, fontWeight: 600, textAlign: "center" },

  // Intervinientes
  peopleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  person: { width: "31%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bgSoft, borderRadius: 8, padding: 6, borderWidth: 1, borderColor: C.borderSoft },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 8, fontWeight: 800 },
  personMeta: { flex: 1 },
  personRole: { color: C.muted, fontSize: 6.5, fontWeight: 700, letterSpacing: 1 },
  personName: { color: C.text, fontSize: 8, fontWeight: 700 },

  // Trazabilidad
  trazaItem: { flexDirection: "row", gap: 8, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.border },
  trazaDate: { color: C.muted, fontSize: 7, width: 68, fontWeight: 700 },
  trazaAccion: { flex: 1, color: C.text, fontSize: 8 },
  trazaUser: { color: C.primaryHi, fontSize: 7, fontWeight: 700 },

  // Footer
  footer: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  footerText: { color: C.dim, fontSize: 6.5, letterSpacing: 1 },
});

// ── Helpers
const money = (v?: number | null) =>
  v == null || !isFinite(v) || v === 0 ? "—" : formatCOP(v);
const safe = (v?: string | null, fb = "—") => (v && v.trim().length ? v : fb);
const initials = (name: string) => {
  const p = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "·";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
};
const fmtDate = (d: string) => {
  if (!d || d === "—") return "—";
  const dd = new Date(d);
  return isNaN(dd.getTime()) ? d : dd.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};
const avatarColor = (seed: string): string => {
  const palette = [C.primary, C.violet, C.accent, C.amber, C.red, "#06B6D4", "#EC4899", "#F97316"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};
const dictamenLabel = (d?: string | null) => {
  if (!d) return "PENDIENTE";
  return d.toUpperCase().replace(/_/g, " ");
};
const riskScore = (dto: CaseSnapshotDTO) => {
  // Heurística simple (0-100): mayor veces pagado, peor riesgo.
  const v = dto.credito.vecesPagado || 1;
  const r = Math.min(100, Math.max(0, (v - 1) * 60));
  return Math.round(r);
};
const viabilityScore = (dto: CaseSnapshotDTO) => {
  const ahorro = dto.propuesta.ahorroTotal || 0;
  const saldo = dto.credito.saldoCapital || 1;
  return Math.min(100, Math.round((ahorro / saldo) * 100 * 1.5));
};
const complexityScore = (dto: CaseSnapshotDTO) => {
  const cps = dto.credito.cuotasPendientes || 0;
  return Math.min(100, Math.round((cps / 240) * 100));
};
const scoreColor = (n: number) =>
  n >= 70 ? C.red : n >= 40 ? C.amber : C.accent;
const scoreLabel = (n: number) =>
  n >= 70 ? "ALTO" : n >= 40 ? "MEDIO" : "BAJO";

// ── Componentes
function Header({ dto }: { dto: CaseSnapshotDTO }) {
  return (
    <View style={s.header}>
      <View style={s.brand}>
        <View style={s.brandLogo}><Text style={s.brandLogoText}>N</Text></View>
        <View>
          <Text style={s.brandWord}>NUVIA</Text>
          <Text style={s.brandTag}>FINANCIAL INTELLIGENCE</Text>
        </View>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerLabel}>CASE SNAPSHOT</Text>
        <Text style={s.headerDate}>{fmtDate(dto.meta.fecha)}</Text>
        <Text style={s.brandTag}>ID · {dto.meta.expedienteId.slice(0, 8).toUpperCase()}</Text>
      </View>
    </View>
  );
}

function HeroCliente({ dto }: { dto: CaseSnapshotDTO }) {
  const score = dto.meta.qaScore;
  return (
    <View style={s.hero}>
      <View style={s.heroTop}>
        <View style={s.heroLeft}>
          <Text style={s.heroEyebrow}>EXPEDIENTE · CLIENTE</Text>
          <Text style={s.heroName}>{safe(dto.cliente.nombre)}</Text>
          <Text style={s.heroMeta}>CC {safe(dto.cliente.cedula)} · {safe(dto.cliente.ciudad)} · {safe(dto.cliente.telefono)}</Text>
          <View style={s.heroChips}>
            <Text style={[s.chip, s.chipBank]}>{safe(dto.meta.banco).toUpperCase()}</Text>
            <Text style={[s.chip, s.chipProd]}>{safe(dto.meta.producto).toUpperCase()}</Text>
            <Text style={[s.chip, s.chipMod]}>{safe(dto.meta.modalidad).toUpperCase()}</Text>
            <Text style={[s.chip, s.chipEst]}>{safe(dto.meta.estadoCaso || dto.meta.estado).toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.qaBadge}>
          <Text style={s.qaScore}>{score != null ? score.toFixed(0) : "—"}</Text>
          <Text style={s.qaLabel}>QA SCORE</Text>
          <Text style={s.qaDict}>{dictamenLabel(dto.meta.qaDictamen)}</Text>
        </View>
      </View>
    </View>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <View style={s.kpi}>
      <View style={s.kpiHead}>
        <Text style={s.kpiLabel}>{label}</Text>
        <View style={[s.kpiIcon, { backgroundColor: color }]}><Text style={s.kpiIconText}>{icon}</Text></View>
      </View>
      <Text style={s.kpiValue}>{value}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function CreditoKpis({ dto }: { dto: CaseSnapshotDTO }) {
  const c = dto.credito;
  return (
    <>
      <View style={s.kpiRow}>
        <KpiCard label="SALDO CAPITAL" value={money(c.saldoCapital)} sub={`Desembolso ${money(c.valorDesembolsado)}`} color={C.primary} icon="$" />
        <KpiCard label="CUOTA ACTUAL" value={money(c.cuotaActual)} sub={`Seguros ${money(c.seguros)}`} color={C.violet} icon="C" />
        <KpiCard label="CUOTAS PEND." value={String(c.cuotasPendientes || "—")} sub={`Pagadas ${c.cuotasPagadas || 0}/${c.plazoAprobado || "—"}`} color={C.amber} icon="#" />
        <KpiCard label="COSTO TOTAL" value={money(c.costoReal || c.totalProyectado)} sub={`TEA ${c.tea ? c.tea.toFixed(2) + "%" : "—"}`} color={C.red} icon="T" />
      </View>
    </>
  );
}

function VecesHero({ dto }: { dto: CaseSnapshotDTO }) {
  const v = dto.credito.vecesPagado;
  const txt = v && isFinite(v) ? `${v.toFixed(2)}x` : "—";
  return (
    <View style={s.vecesHero}>
      <View style={s.vecesLeft}>
        <Text style={s.vecesEyebrow}>IMPACTO REAL DEL CRÉDITO</Text>
        <Text style={s.vecesTitle}>VAS A PAGAR {txt} EL VALOR ORIGINAL</Text>
        <Text style={s.vecesSub}>
          Sobre un saldo de {money(dto.credito.saldoCapital)}, el banco proyecta cobrar {money(dto.credito.costoReal || dto.credito.totalProyectado)} en {dto.credito.cuotasPendientes || "—"} cuotas pendientes.
        </Text>
      </View>
      <View>
        <Text style={s.vecesBig}>{txt}</Text>
        <Text style={s.vecesBigCaption}>VECES EL CAPITAL</Text>
      </View>
    </View>
  );
}

function PropuestaRecomendada({ dto }: { dto: CaseSnapshotDTO }) {
  const p = dto.propuesta;
  return (
    <View style={s.propWrap}>
      {p.recomendada ? (
        <View style={s.propBadge}><Text style={s.propBadgeText}>RECOMENDADA POR NUVIA</Text></View>
      ) : null}
      <View style={s.propHead}>
        <Text style={s.propTitle}>PROPUESTA · {safe(p.escenario).toUpperCase()}</Text>
        <Text style={s.propScenario}>Ahorro total {money(p.ahorroTotal)}</Text>
      </View>
      <View style={s.propGrid}>
        <View style={s.propStat}>
          <Text style={s.propStatLabel}>NUEVA CUOTA</Text>
          <Text style={s.propStatValue}>{money(p.nuevaCuota)}</Text>
        </View>
        <View style={s.propStat}>
          <Text style={s.propStatLabel}>NUEVO PLAZO</Text>
          <Text style={s.propStatValue}>{p.nuevoPlazo ? `${p.nuevoPlazo} m` : "—"}</Text>
        </View>
        <View style={s.propStat}>
          <Text style={s.propStatLabel}>CUOTAS ELIM.</Text>
          <Text style={s.propStatValue}>{p.cuotasEliminadas || "—"}</Text>
        </View>
        <View style={s.propStat}>
          <Text style={s.propStatLabel}>AHORRO INT.</Text>
          <Text style={s.propStatValue}>{money(p.ahorroIntereses)}</Text>
        </View>
        <View style={s.propStat}>
          <Text style={s.propStatLabel}>AHORRO SEG.</Text>
          <Text style={s.propStatValue}>{money(p.ahorroSeguros)}</Text>
        </View>
      </View>
    </View>
  );
}

function DiagnosticoIA({ dto }: { dto: CaseSnapshotDTO }) {
  const items = [
    { label: "RIESGO", n: riskScore(dto) },
    { label: "VIABILIDAD", n: viabilityScore(dto) },
    { label: "COMPLEJIDAD", n: complexityScore(dto) },
  ];
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>DIAGNÓSTICO IA</Text>
      <View style={s.diagRow}>
        {items.map((it) => (
          <View key={it.label} style={s.diagItem}>
            <View style={[s.diagDot, { backgroundColor: scoreColor(it.n) }]}>
              <Text style={s.diagDotText}>{it.n}</Text>
            </View>
            <Text style={s.diagLabel}>{it.label}</Text>
            <Text style={[s.diagValue, { color: scoreColor(it.n) }]}>{scoreLabel(it.n)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Honorarios({ dto }: { dto: CaseSnapshotDTO }) {
  const h = dto.honorarios;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>HONORARIOS NUVIA</Text>
      <View style={s.honoRow}>
        <View style={s.honoCell}>
          <Text style={s.honoLabel}>PACTADOS</Text>
          <Text style={s.honoValue}>{money(h.pactados)}</Text>
          <Text style={[s.honoTag, { backgroundColor: "rgba(59,130,246,0.18)", color: C.primaryHi }]}>{h.porcentaje ? `${h.porcentaje}%` : "—"}</Text>
        </View>
        <View style={s.honoCell}>
          <Text style={s.honoLabel}>ESTADO COBRO</Text>
          <Text style={[s.honoValue, { fontSize: 10 }]}>{safe(h.estadoCobro).toUpperCase()}</Text>
          {h.cuentaCobroEmitida ? (
            <Text style={[s.honoTag, { backgroundColor: "rgba(34,197,94,0.18)", color: C.accentHi }]}>EMITIDA</Text>
          ) : (
            <Text style={[s.honoTag, { backgroundColor: "rgba(148,163,184,0.2)", color: C.muted }]}>PENDIENTE</Text>
          )}
        </View>
        <View style={s.honoCell}>
          <Text style={s.honoLabel}>PAZ Y SALVO</Text>
          <Text style={[s.honoValue, { fontSize: 10, color: h.pazYSalvo ? C.accentHi : C.muted }]}>{h.pazYSalvo ? "SÍ" : "NO"}</Text>
        </View>
      </View>
    </View>
  );
}

function Timeline({ dto }: { dto: CaseSnapshotDTO }) {
  const tl = dto.timeline.length ? dto.timeline : [];
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>RUTA OPERATIVA NUVIA</Text>
      <View style={s.tlTrack}>
        {tl.map((step, i) => {
          const isDone = step.estado === "hecho";
          const isCurr = step.estado === "curso";
          const color = isDone ? C.accent : isCurr ? C.gold : C.borderSoft;
          const txtColor = isDone ? "#fff" : isCurr ? "#000" : C.muted;
          return (
            <View key={i} style={s.tlStep}>
              <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
                {i > 0 ? <View style={[s.tlLine, { backgroundColor: tl[i-1].estado === "hecho" ? C.accent : C.borderSoft }]} /> : <View style={s.tlLine} />}
                <View style={[s.tlDot, { backgroundColor: color, borderColor: color }]}>
                  <Text style={[s.tlDotText, { color: txtColor }]}>{isDone ? "✓" : String(i + 1)}</Text>
                </View>
                {i < tl.length - 1 ? <View style={[s.tlLine, { backgroundColor: isDone ? C.accent : C.borderSoft }]} /> : <View style={s.tlLine} />}
              </View>
              <Text style={s.tlLabel}>{step.etiqueta}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Intervinientes({ dto }: { dto: CaseSnapshotDTO }) {
  const list = dto.intervinientes.slice(0, 6);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>EQUIPO DEL CASO</Text>
      <View style={s.peopleRow}>
        {list.map((p, i) => (
          <View key={i} style={s.person}>
            <View style={[s.avatar, { backgroundColor: avatarColor(p.nombre + p.rol) }]}>
              <Text style={s.avatarText}>{initials(p.nombre)}</Text>
            </View>
            <View style={s.personMeta}>
              <Text style={s.personRole}>{p.rol.toUpperCase()}</Text>
              <Text style={s.personName}>{safe(p.nombre)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Trazabilidad({ dto }: { dto: CaseSnapshotDTO }) {
  const t = dto.trazabilidad.slice(0, 6);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>TRAZABILIDAD RECIENTE</Text>
      {t.length === 0 ? (
        <Text style={{ color: C.muted, fontSize: 8 }}>Sin movimientos registrados.</Text>
      ) : t.map((r, i) => (
        <View key={i} style={s.trazaItem}>
          <Text style={s.trazaDate}>{fmtDate(r.fecha)}</Text>
          <Text style={s.trazaAccion}>{safe(r.accion)}</Text>
          <Text style={s.trazaUser}>{safe(r.usuario)}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ dto }: { dto: CaseSnapshotDTO }) {
  return (
    <View style={s.footer}>
      <Text style={s.footerText}>NUVIA · CASE SNAPSHOT · CONFIDENCIAL</Text>
      <Text style={s.footerText}>{safe(dto.meta.analista.nombre)} · {fmtDate(new Date().toISOString())}</Text>
    </View>
  );
}

// ── Documento
function SnapshotDoc({ dto }: { dto: CaseSnapshotDTO }) {
  return (
    <Document>
      <Page size={{ width: W, height: H }} style={s.page}>
        <Header dto={dto} />
        <HeroCliente dto={dto} />
        <CreditoKpis dto={dto} />
        <VecesHero dto={dto} />
        <PropuestaRecomendada dto={dto} />
        <View style={s.twoCol}>
          <DiagnosticoIA dto={dto} />
          <Honorarios dto={dto} />
        </View>
        <Timeline dto={dto} />
        <View style={s.twoCol}>
          <Intervinientes dto={dto} />
          <Trazabilidad dto={dto} />
        </View>
        <Footer dto={dto} />
      </Page>
    </Document>
  );
}

// ── API pública
export async function generarCaseSnapshotPdf(dto: CaseSnapshotDTO): Promise<Blob> {
  const instance = pdf(<SnapshotDoc dto={dto} />);
  return await instance.toBlob();
}

export function descargarSnapshot(blob: Blob, cliente?: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (cliente || "caso").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
  a.href = url;
  a.download = `NUVIA_CaseSnapshot_${safeName}_${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
