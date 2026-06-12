import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Hash, MessageSquare, Users, Bell, Plus, FolderKanban, ArrowLeft, MessagesSquare } from "lucide-react";
import { ExecutiveHero, NCard, PageLayout } from "@/components/nuvia";
import { CanalChat } from "@/components/colaboracion/CanalChat";
import {
  type Canal, listCanales, crearCanal, listDirectorio, getOrCreateDM,
  listMisNotifColab, marcarTodasNotifLeidas, type NotifColab,
} from "@/lib/colaboracion";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/colaboracion/")({
  component: ColaboracionPage,
  validateSearch: (s: Record<string, unknown>) => ({ canal: (s.canal as string) || "", tab: (s.tab as string) || "canales" }),
  head: () => ({ meta: [{ title: "Colaboración · NUVEX" }] }),
});

function ColaboracionPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [canales, setCanales] = useState<Canal[]>([]);
  const [tab, setTab] = useState<string>(search.tab || "canales");
  const [notifs, setNotifs] = useState<NotifColab[]>([]);
  const [dir, setDir] = useState<Awaited<ReturnType<typeof listDirectorio>>>([]);
  const [showNew, setShowNew] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDesc, setNuevoDesc] = useState("");
  const [nuevoPriv, setNuevoPriv] = useState(false);

  const reload = () => listCanales().then(setCanales);
  useEffect(() => { reload(); listDirectorio().then(setDir); listMisNotifColab().then(setNotifs); }, []);

  const canalActivo = useMemo(() => canales.find((c) => c.id === search.canal) ?? null, [canales, search.canal]);

  const canalesArea = canales.filter((c) => c.tipo === "area");
  const canalesCustom = canales.filter((c) => c.tipo === "custom");
  const canalesCaso = canales.filter((c) => c.tipo === "caso");
  const dms = canales.filter((c) => c.tipo === "dm");

  const setCanal = (id: string) => navigate({ to: "/colaboracion", search: { canal: id, tab } });
  const clearCanal = () => navigate({ to: "/colaboracion", search: { canal: "", tab } });
  const setTabAndSync = (t: string) => { setTab(t); navigate({ to: "/colaboracion", search: { canal: search.canal, tab: t } }); };

  const crear = async () => {
    if (!nuevoNombre.trim()) return;
    const c = await crearCanal({ nombre: nuevoNombre.trim(), descripcion: nuevoDesc.trim() || undefined, privado: nuevoPriv });
    setShowNew(false); setNuevoNombre(""); setNuevoDesc(""); setNuevoPriv(false);
    await reload(); setCanal(c.id);
  };

  const hasCanal = !!canalActivo;

  return (
    <PageLayout maxWidth="full">
      <ExecutiveHero
        badge={{ icon: <MessagesSquare size={12} />, label: "NUVEX · Colaboración", tone: "blue" }}
        title="Centro de Colaboración"
        description="Conversaciones por caso, canales por área, mensajería directa y notificaciones internas."
        actions={
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {(["canales", "dm", "notificaciones", "directorio"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTabAndSync(t)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium border"
                style={
                  tab === t
                    ? { background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)", borderColor: "transparent" }
                    : { borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-secondary)", background: "rgba(255,255,255,0.02)" }
                }
              >
                {t === "canales" ? "Canales" : t === "dm" ? "Directos" : t === "notificaciones" ? "Notif." : "Directorio"}
              </button>
            ))}
          </div>
        }
      />


      {tab === "canales" && (
        <div
          className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4"
          style={{ height: "calc(100dvh - 200px)" }}
        >
          <NCard padding="none" className={`md:col-span-3 p-0 overflow-y-auto flex-col ${hasCanal ? "hidden md:flex" : "flex flex-1"}`}>
            <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "var(--nuvia-border)" }}>
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Áreas</div>
              <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }}>
                <Plus size={11} /> Nuevo
              </button>
            </div>
            <ListCanales icon={Hash} items={canalesArea} activeId={canalActivo?.id} onPick={setCanal} />
            {canalesCustom.length > 0 && <SectionTitle label="Personalizados" />}
            <ListCanales icon={Hash} items={canalesCustom} activeId={canalActivo?.id} onPick={setCanal} />
            {canalesCaso.length > 0 && <SectionTitle label="Casos" />}
            <ListCanales icon={FolderKanban} items={canalesCaso} activeId={canalActivo?.id} onPick={setCanal} />
            {dms.length > 0 && <SectionTitle label="Directos" />}
            <ListCanales icon={MessageSquare} items={dms} activeId={canalActivo?.id} onPick={setCanal} />
          </NCard>

          <NCard padding="none" className={`md:col-span-9 p-0 overflow-hidden flex-col ${hasCanal ? "flex flex-1" : "hidden md:flex"}`}>
            {canalActivo ? (
              <div className="flex flex-col h-full">
                <button onClick={clearCanal} className="md:hidden inline-flex items-center gap-1.5 text-[12px] px-3 py-2 border-b" style={{ color: "var(--nuvia-text-secondary)", borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)" }}>
                  <ArrowLeft size={14} /> Canales
                </button>
                <div className="flex-1 min-h-0">
                  <CanalChat canal={canalActivo} />
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Selecciona un canal.</div>
            )}
          </NCard>
        </div>
      )}

      {tab === "dm" && (
        <NCard padding="md">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--nuvia-text-primary)" }}>Iniciar mensaje directo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {dir.filter((p) => p.user_id !== user?.id).map((p) => (
              <button key={p.user_id} onClick={async () => { const c = await getOrCreateDM(p.user_id); await reload(); setTabAndSync("canales"); setCanal(c.id); }} className="flex items-center gap-3 rounded-xl border p-3 text-left transition hover:[background:var(--nuvia-bg-card)]" style={{ borderColor: "var(--nuvia-border)", background: "rgba(255,255,255,0.03)" }}>
                <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--nuvia-text-primary)" }}>{p.nombre}</div>
                  <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{p.roles.join(", ") || "—"}</div>
                </div>
              </button>
            ))}
          </div>
        </NCard>
      )}

      {tab === "notificaciones" && (
        <NCard padding="md">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: "var(--nuvia-text-primary)" }}><Bell size={14} /> Mis notificaciones</h3>
            <button onClick={async () => { await marcarTodasNotifLeidas(); listMisNotifColab().then(setNotifs); }} className="text-[11px] md:text-[12px] font-medium text-right" style={{ color: "var(--nuvia-accent-green)" }}>
              Marcar todas leídas
            </button>
          </div>
          {notifs.length === 0 ? (
            <div className="text-center text-sm py-6" style={{ color: "var(--nuvia-text-secondary)" }}>Sin notificaciones.</div>
          ) : (
            <div className="space-y-1">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: n.leida ? "rgba(255,255,255,0.025)" : "rgba(68,93,163,0.18)", borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{n.tipo === "mencion" ? "Te mencionaron" : "Nuevo mensaje"}</div>
                    <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>{new Date(n.created_at).toLocaleString("es-CO")}</div>
                  </div>
                  {n.canal_id && <button onClick={() => { setTabAndSync("canales"); setCanal(n.canal_id!); }} className="text-[12px] font-semibold shrink-0" style={{ color: "var(--nuvia-accent-green)" }}>Abrir</button>}
                </div>
              ))}
            </div>
          )}
        </NCard>
      )}

      {tab === "directorio" && (
        <NCard padding="md">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2 mb-3" style={{ color: "var(--nuvia-text-primary)" }}><Users size={14} /> Directorio interno</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {dir.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--nuvia-border)", background: "rgba(255,255,255,0.03)" }}>
                <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--nuvia-text-primary)" }}>{p.nombre}</div>
                  <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{p.correo || "—"}</div>
                  <div className="text-[10px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{p.roles.join(", ") || "—"}</div>
                </div>
                {p.user_id !== user?.id && (
                  <button onClick={async () => { const c = await getOrCreateDM(p.user_id); await reload(); setTabAndSync("canales"); setCanal(c.id); }} className="rounded-md px-2 py-1 text-[11px] font-semibold shrink-0" style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }}>
                    Mensaje
                  </button>
                )}
              </div>
            ))}
          </div>
        </NCard>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowNew(false)}>
          <div className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl p-4 md:p-5" style={{ background: "var(--nuvia-bg-tertiary)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>Nuevo canal</h3>
              <button onClick={() => setShowNew(false)} className="text-xl leading-none px-2" style={{ color: "var(--nuvia-text-secondary)" }}>×</button>
            </div>
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="# nombre-canal" className="nuvia-input mb-2" />
            <textarea value={nuevoDesc} onChange={(e) => setNuevoDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2} className="nuvia-input mb-2" />
            <label className="flex items-center gap-2 text-sm mb-4" style={{ color: "var(--nuvia-text-primary)" }}>
              <input type="checkbox" checked={nuevoPriv} onChange={(e) => setNuevoPriv(e.target.checked)} /> Canal privado (solo miembros invitados)
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>Cancelar</button>
              <button onClick={crear} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold border-t" style={{ color: "var(--nuvia-text-secondary)", borderColor: "var(--nuvia-border)" }}>{label}</div>;
}

function ListCanales({ items, activeId, onPick, icon: Icon }: { items: Canal[]; activeId?: string; onPick: (id: string) => void; icon: typeof Hash }) {
  return (
    <div className="py-1">
      {items.map((c) => (
        <button key={c.id} onClick={() => onPick(c.id)} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition hover:[background:var(--nuvia-bg-card)]" style={activeId === c.id ? { background: "rgba(68,93,163,0.18)", color: "var(--nuvia-text-primary)", fontWeight: 600 } : { color: "var(--nuvia-text-secondary)" }}>
          <Icon size={13} className="shrink-0" />
          <span className="truncate">{c.nombre}</span>
          {c.privado && <span className="ml-auto text-[9px] uppercase" style={{ color: "var(--nuvia-text-secondary)" }}>priv</span>}
        </button>
      ))}
    </div>
  );
}
