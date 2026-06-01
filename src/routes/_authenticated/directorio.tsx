import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Mail, MessageCircle, Phone, MapPin, BookUser } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { listDirectorioFull, getOrCreateDM, type DirectorioPersona } from "@/lib/colaboracion";
import { useNavigate } from "@tanstack/react-router";

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
    <div className="mx-auto max-w-[1500px] px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>NUVEX</div>
            <h1 className="text-2xl font-semibold text-[#242424] inline-flex items-center gap-2"><BookUser size={22} /> Directorio NUVEX</h1>
            <p className="text-sm text-[#242424]/60 mt-1">Equipo corporativo agrupado por área. {data.length} colaboradores.</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#242424]/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, cargo o ciudad…" className="w-[320px] rounded-lg border border-[#E3E7EE] pl-9 pr-3 py-2 text-sm" />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ChipGrupo label={`Todos · ${data.length}`} active={grupo === "todos"} onClick={() => setGrupo("todos")} />
        {GROUPS.filter((g) => g.key !== "otros" || (conteos.get("otros") ?? 0) > 0).map((g) => (
          <ChipGrupo key={g.key} label={`${g.label} · ${conteos.get(g.key) ?? 0}`} active={grupo === g.key} onClick={() => setGrupo(g.key)} />
        ))}
      </div>

      {loading ? (
        <Card><div className="text-center text-sm text-[#242424]/50 py-8">Cargando directorio…</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="text-center text-sm text-[#242424]/50 py-8">Sin resultados.</div></Card>
      ) : (
        <div className="space-y-5">
          {GROUPS.filter((g) => grupo === "todos" || grupo === g.key).map((g) => {
            const items = grouped.get(g.key) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-sm font-semibold text-[#242424]">{g.label}</h2>
                  <span className="text-[11px] text-[#242424]/50">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map((p) => (
                    <PersonaCard key={p.user_id} p={p} onDM={() => abrirDM(p.user_id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipGrupo({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full px-3 py-1.5 text-[12px] font-medium border" style={active ? { background: NUVEX.azul, color: "#fff", borderColor: NUVEX.azul } : { background: "#fff", borderColor: "#E3E7EE", color: "#242424" }}>{label}</button>
  );
}

function PersonaCard({ p, onDM }: { p: DirectorioPersona; onDM: () => void }) {
  const cargo = cargoDe(p);
  const correo = p.correo_corp || p.correo;
  return (
    <div className="rounded-2xl border border-[#E3E7EE] bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-[#242424] truncate">{p.nombre}</div>
            <span className={`inline-block w-2 h-2 rounded-full ${p.activo ? "bg-[#84B98F]" : "bg-[#242424]/25"}`} title={p.activo ? "Activo" : "Inactivo"} />
          </div>
          <div className="text-[12px] text-[#242424]/65 truncate">{cargo}</div>
          {(p.ciudad || p.pais) && (
            <div className="text-[11px] text-[#242424]/55 inline-flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {[p.ciudad, p.pais].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-[12px] text-[#242424]/75 border-t border-[#E3E7EE] pt-2">
        {correo && <a href={`mailto:${correo}`} className="inline-flex items-center gap-2 hover:underline truncate"><Mail size={12} /> {correo}</a>}
        {p.whatsapp && <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline"><MessageCircle size={12} /> {p.whatsapp}</a>}
        {!p.whatsapp && p.celular && <span className="inline-flex items-center gap-2"><Phone size={12} /> {p.celular}</span>}
      </div>
      <button onClick={onDM} className="w-full rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: NUVEX.azul }}>Enviar mensaje</button>
    </div>
  );
}
