import { motion } from "framer-motion";
import { Search, Sparkles, Users, Building2, MapPin, Activity, Briefcase, Scale, Gavel, ShieldCheck, Cpu, Crown, Filter } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";

type Props = {
  total: number;
  areas: number;
  sedes: number;
  colaboracion: number;
  q: string;
  setQ: (v: string) => void;
  quickCounts: { liderazgo: number; operativos: number; juridicos: number; comerciales: number };
  activeFilter: string | null;
  onFilter: (f: string | null) => void;
};

const AREAS = [
  { key: "Comercial", angle: 0, icon: Briefcase, color: NUVEX.verde },
  { key: "Operaciones", angle: 60, icon: Activity, color: NUVEX.azul },
  { key: "Jurídica", angle: 120, icon: Scale, color: "#a78bfa" },
  { key: "QA", angle: 180, icon: ShieldCheck, color: "#f5b971" },
  { key: "Tecnología", angle: 240, icon: Cpu, color: "#67e8f9" },
  { key: "Dirección", angle: 300, icon: Crown, color: "#e8c07a" },
];

export function DirectoryHeroHologram({ total, areas, sedes, colaboracion, q, setQ, quickCounts, activeFilter, onFilter }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl"
      style={{ boxShadow: "0 40px 120px -60px rgba(68,93,163,0.55)" }}
    >
      {/* top light beam */}
      <span className="pointer-events-none absolute inset-x-10 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(132,185,143,0.7), transparent)" }} />
      {/* subtle grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      {/* ambient blobs */}
      <motion.div className="pointer-events-none absolute -top-32 left-1/3 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${NUVEX.azul}55, transparent 70%)` }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="pointer-events-none absolute -bottom-40 right-10 h-[22rem] w-[22rem] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${NUVEX.verde}45, transparent 70%)` }} animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[35fr_35fr_30fr] gap-6 p-6 sm:p-8">
        {/* LEFT — identity + KPIs */}
        <div className="flex flex-col gap-5 min-w-0">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] font-bold text-[#84B98F]">
              <Sparkles size={11} /> ✦ NUVIA · Equipo
            </div>
            <h1 className="mt-3 text-[42px] leading-[1.02] font-semibold tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${NUVEX.verde} 55%, ${NUVEX.azul} 100%)` }}>
              Directorio NUVEX
            </h1>
            <p className="mt-2 text-sm text-white/55 max-w-md">Equipo corporativo agrupado por áreas · {total} colaboradores conectados al core operativo.</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MiniKpi icon={Users} label="Colaboradores" value={total} suffix="activos" glow={NUVEX.verde} />
            <MiniKpi icon={Building2} label="Áreas" value={areas} suffix="operativas" glow={NUVEX.azul} />
            <MiniKpi icon={MapPin} label="Sedes" value={sedes} suffix="conectadas" glow="#a78bfa" />
            <MiniKpi icon={Activity} label="Colaboración" value={colaboracion} suffix="% índice" glow="#f5b971" isPercent />
          </div>
        </div>

        {/* CENTER — Hologram */}
        <div className="relative flex items-center justify-center min-h-[340px]">
          <Hologram />
        </div>

        {/* RIGHT — search + filters + mini stats */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, cargo o ciudad…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-3 py-3 text-sm text-white placeholder:text-white/35 outline-none backdrop-blur-xl focus:border-[#84B98F]/50 focus:bg-white/[0.08] transition"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {["Área", "Cargo", "Ciudad", "Estado"].map((f) => (
              <button
                key={f}
                onClick={() => onFilter(activeFilter === f ? null : f)}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition-all backdrop-blur-xl"
                style={
                  activeFilter === f
                    ? { background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})`, borderColor: "transparent", color: "#fff" }
                    : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.65)" }
                }
              >
                <Filter size={9} /> {f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <StatMini icon={Crown} label="Liderazgo" value={quickCounts.liderazgo} color="#e8c07a" />
            <StatMini icon={Activity} label="Operativos" value={quickCounts.operativos} color={NUVEX.azul} />
            <StatMini icon={Gavel} label="Jurídicos" value={quickCounts.juridicos} color="#a78bfa" />
            <StatMini icon={Briefcase} label="Comerciales" value={quickCounts.comerciales} color={NUVEX.verde} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function MiniKpi({ icon: Icon, label, value, suffix, glow, isPercent }: { icon: any; label: string; value: number; suffix: string; glow: string; isPercent?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-3.5 py-3 transition-all hover:bg-white/[0.07]" style={{ boxShadow: `0 12px 30px -20px ${glow}80` }}>
      <span className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" style={{ background: `linear-gradient(135deg, ${glow}30, transparent)` }} />
      <div className="relative flex items-center gap-2.5">
        <div className="grid place-items-center h-8 w-8 rounded-lg border" style={{ background: `${glow}18`, borderColor: `${glow}30`, color: glow }}>
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <div className="text-lg font-bold text-white leading-none">{value}{isPercent ? "%" : ""}</div>
          </div>
          <div className="text-[9.5px] uppercase tracking-wider text-white/50 mt-0.5">{label} · {suffix}</div>
        </div>
      </div>
    </div>
  );
}

function StatMini({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-2.5 py-2 flex items-center gap-2 transition-all hover:bg-white/[0.07]">
      <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      <div className="grid place-items-center h-7 w-7 rounded-md" style={{ background: `${color}20`, color }}>
        <Icon size={12} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-white/55 leading-none">{label}</div>
        <div className="text-sm font-bold text-white mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Hologram() {
  const R1 = 90;
  const R2 = 130;
  const R3 = 170;
  return (
    <div className="relative h-[340px] w-[340px]">
      {/* base disc */}
      <div className="absolute inset-x-8 bottom-4 h-8 rounded-full blur-2xl" style={{ background: `radial-gradient(ellipse, ${NUVEX.azul}70, transparent 70%)` }} />

      {/* orbital rings */}
      {[R1, R2, R3].map((r, i) => (
        <motion.div
          key={r}
          className="absolute rounded-full border"
          style={{ left: `calc(50% - ${r}px)`, top: `calc(50% - ${r}px)`, width: r * 2, height: r * 2, borderColor: i === 1 ? "rgba(132,185,143,0.25)" : "rgba(68,93,163,0.22)", transform: "rotateX(70deg)" }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 30 + i * 8, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* particles orbiting */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        const r = i % 2 === 0 ? R2 : R3;
        return (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full"
            style={{ left: "50%", top: "50%", background: i % 3 === 0 ? NUVEX.verde : NUVEX.azul, boxShadow: `0 0 8px ${i % 3 === 0 ? NUVEX.verde : NUVEX.azul}` }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20 + (i % 4) * 5, repeat: Infinity, ease: "linear" }}
          >
            <div style={{ transform: `rotate(${angle}deg) translateX(${r}px)` }} className="h-1 w-1 rounded-full" />
          </motion.div>
        );
      })}

      {/* area nodes */}
      {AREAS.map(({ key, angle, icon: Icon, color }) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * R3;
        const y = Math.sin(rad) * R3 * 0.55; // elliptical
        return (
          <motion.div
            key={key}
            className="absolute"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: "translate(-50%,-50%)" }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="grid place-items-center h-9 w-9 rounded-xl border backdrop-blur-xl" style={{ background: `${color}18`, borderColor: `${color}55`, color, boxShadow: `0 0 20px ${color}55` }}>
                <Icon size={14} />
              </div>
              <span className="text-[9px] uppercase tracking-widest font-bold text-white/70">{key}</span>
            </div>
          </motion.div>
        );
      })}

      {/* connecting lines (svg) */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 340 340">
        {AREAS.map(({ angle, color }, i) => {
          const rad = (angle * Math.PI) / 180;
          const x = 170 + Math.cos(rad) * R3;
          const y = 170 + Math.sin(rad) * R3 * 0.55;
          return <line key={i} x1={170} y1={170} x2={x} y2={y} stroke={color} strokeWidth={0.6} strokeOpacity={0.35} strokeDasharray="2 4" />;
        })}
      </svg>

      {/* core */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative grid place-items-center h-24 w-24 rounded-full" style={{ background: `radial-gradient(circle, ${NUVEX.azul}, #1a2340 70%)`, boxShadow: `0 0 60px ${NUVEX.azul}, inset 0 0 30px rgba(132,185,143,0.35)` }}>
          <div className="absolute inset-0 rounded-full border border-white/20" />
          <div className="absolute inset-2 rounded-full border border-[#84B98F]/40" />
          <div className="text-center">
            <div className="text-[8px] uppercase tracking-[0.2em] font-bold text-white/70">NUVIA</div>
            <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-[#84B98F]">Workforce</div>
            <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/85">Core</div>
          </div>
        </div>
      </motion.div>

      {/* scanning beam */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[220px] w-[2px] -translate-x-1/2 -translate-y-1/2 origin-top"
        style={{ background: `linear-gradient(180deg, ${NUVEX.verde}, transparent)`, filter: "blur(1px)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
