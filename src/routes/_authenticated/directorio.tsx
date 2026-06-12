import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Mail, MessageCircle, Phone, MapPin, BookUser, Sparkles } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { listDirectorioFull, getOrCreateDM, type DirectorioPersona } from "@/lib/colaboracion";
import { useNavigate } from "@tanstack/react-router";
import { PresenceDot } from "@/components/presencia/PresenceDot";

export const Route = createFileRoute("/_authenticated/directorio")({
  component: DirectorioPage,
  head: () => ({ meta: [{ title: "Directorio NUVEX" }] }),
});

type GroupKey = "licenciados" | "juridica" | "operaciones" | "contabilidad" | "qa" | "direccion" | "otros";

const GROUPS: { key: GroupKey; label: string; match: (rolesRaw: string[], equipo: string | null) => boolean }[] = [
  { key: "licenciados", label: "Analistas Financieros Comerciales", match: (r) => r.includes("licenciado") || r.includes("asesor") },
  { key: "juridica", label: "Jurídica", match: (r) => r.includes("juridica") || r.includes("director_juridico") || r.includes("apoderado") },
  { key: "operaciones", label: "Operaciones", match: (r) => r.includes("operaciones") || r.includes("auxiliar_operativo") },
  { key: "contabilidad", label: "Contabilidad", match: (r) => r.includes("contabilidad") || r.includes("cartera") },
  { key: "qa", label: "QA", match: (r) => r.includes("director_financiero_qa") },
  { key: "direccion", label: "Dirección", match: (r) => r.includes("gerencia") || r.includes("admin") || r.includes("super_admin") },
  { key: "otros", label: "Otros", match: () => true },
];

function asignarGrupo(p: DirectorioPersona): GroupKey {
  for (const g of GROUPS) if (g.key !== "otros" && g.match(p.rolesRaw, p.equipo)) return g.key;
  return "otros";
}

function cargoDe(p: DirectorioPersona): string {
  if (p.equipo) return p.equipo;
  const r = p.roles[0];
  if (!r) return "—";
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function NeuralBg() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 20% 10%, rgba(68,93,163,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(132,185,143,0.14), transparent 55%)" }} />
      <motion.div
        className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${NUVEX.azul}40, transparent 70%)` }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${NUVEX.verde}35, transparent 70%)` }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

function DirectorioPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DirectorioPersona[]>([]);
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState<GroupKey | "todos">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => { listDirectorioFull().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return data.filter((p) => {
      if (qn) {
        const hay = [p.nombre, cargoDe(p), p.ciudad ?? "", p.equipo ?? "", p.correo ?? "", p.correo_corp ?? ""].join(" ").toLowerCase();
        if (!hay.includes(qn)) return false;
      }
      if (grupo !== "todos" && asignarGrupo(p) !== grupo) return false;
      return true;
    });
  }, [data, q, grupo]);

  const grouped = useMemo(() => {
    const m = new Map<GroupKey, DirectorioPersona[]>();
    GROUPS.forEach((g) => m.set(g.key, []));
    filtered.forEach((p) => m.get(asignarGrupo(p))!.push(p));
    return m;
  }, [filtered]);

  const conteos = useMemo(() => {
    const m = new Map<GroupKey, number>();
    GROUPS.forEach((g) => m.set(g.key, 0));
    data.forEach((p) => m.set(asignarGrupo(p), (m.get(asignarGrupo(p)) ?? 0) + 1));
    return m;
  }, [data]);

  const abrirDM = async (uid: string) => {
    const c = await getOrCreateDM(uid);
    navigate({ to: "/colaboracion/dm/$conversationId", params: { conversationId: c.id } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <NeuralBg />
      <div className="relative mx-auto max-w-[1500px] px-6 py-10 space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-2xl relative overflow-hidden"
        >
          <span className="pointer-events-none absolute inset-x-8 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(132,185,143,0.6), transparent)" }} />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-[#84B98F]">
                <Sparkles size={11} /> NUVIA · Equipo
              </div>
              <h1 className="text-3xl font-semibold tracking-tight mt-2 inline-flex items-center gap-2"><BookUser size={26} /> Directorio NUVEX</h1>
              <p className="text-sm text-white/55 mt-1">Equipo corporativo agrupado por área · {data.length} colaboradores.</p>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, cargo o ciudad…"
                className="w-[320px] rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none backdrop-blur-xl focus:border-[#84B98F]/50 focus:bg-white/[0.06] transition"
              />
            </div>
          </div>
        </motion.header>

        <div className="flex flex-wrap gap-2">
          <ChipGrupo label={`Todos · ${data.length}`} active={grupo === "todos"} onClick={() => setGrupo("todos")} />
          {GROUPS.filter((g) => g.key !== "otros" || (conteos.get("otros") ?? 0) > 0).map((g) => (
            <ChipGrupo key={g.key} label={`${g.label} · ${conteos.get(g.key) ?? 0}`} active={grupo === g.key} onClick={() => setGrupo(g.key)} />
          ))}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl text-center text-sm text-white/50 py-14">Cargando directorio…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl text-center text-sm text-white/50 py-14">Sin resultados.</div>
        ) : (
          <div className="space-y-6">
            {GROUPS.filter((g) => grupo === "todos" || grupo === g.key).map((g) => {
              const items = grouped.get(g.key) ?? [];
              if (items.length === 0) return null;
              return (
                <motion.div
                  key={g.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 px-1">
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/80">{g.label}</h2>
                    <span className="text-[11px] text-white/40">{items.length}</span>
                    <span className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((p) => (
                      <PersonaCard key={p.user_id} p={p} onDM={() => abrirDM(p.user_id)} />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChipGrupo({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold border backdrop-blur-xl transition-all"
      style={
        active
          ? { background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})`, color: "#fff", borderColor: "transparent", boxShadow: `0 8px 24px -10px ${NUVEX.azul}` }
          : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)" }
      }
    >
      {label}
    </button>
  );
}

function PersonaCard({ p, onDM }: { p: DirectorioPersona; onDM: () => void }) {
  const cargo = cargoDe(p);
  const correo = p.correo_corp || p.correo;
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-5 flex flex-col gap-3 hover:bg-white/[0.06] transition-colors"
      style={{ boxShadow: "0 20px 50px -30px rgba(0,0,0,0.8)" }}
    >
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(132,185,143,0.5), transparent)" }} />
      <span className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 blur-xl" style={{ background: `linear-gradient(135deg, ${NUVEX.azul}30, ${NUVEX.verde}30)` }} />
      <div className="relative flex items-start gap-3">
        <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-white truncate">{p.nombre}</div>
            <PresenceDot userId={p.user_id} lastSeenAt={p.last_seen_at} visible={p.presencia_visible} />
          </div>
          <div className="text-[12px] text-white/60 truncate">{cargo}</div>
          <div className="text-[10.5px] text-white/40 mt-0.5">
            <PresenceDot userId={p.user_id} lastSeenAt={p.last_seen_at} visible={p.presencia_visible} showText />
          </div>
          {(p.ciudad || p.pais) && (
            <div className="text-[11px] text-white/50 inline-flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {[p.ciudad, p.pais].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>
      <div className="relative flex flex-col gap-1.5 text-[12px] text-white/70 border-t border-white/10 pt-3">
        {correo && <a href={`mailto:${correo}`} className="inline-flex items-center gap-2 hover:text-white truncate transition-colors"><Mail size={12} /> {correo}</a>}
        {p.whatsapp && <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[#84B98F] transition-colors"><MessageCircle size={12} /> {p.whatsapp}</a>}
        {!p.whatsapp && p.celular && <span className="inline-flex items-center gap-2"><Phone size={12} /> {p.celular}</span>}
      </div>
      <button
        onClick={onDM}
        className="relative w-full rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition-all hover:scale-[1.02]"
        style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})`, boxShadow: `0 10px 30px -10px ${NUVEX.azul}` }}
      >
        Enviar mensaje
      </button>
    </motion.div>
  );
}
