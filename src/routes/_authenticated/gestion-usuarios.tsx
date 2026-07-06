import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  InsightCard,
  NCard,
  NSelect,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";
import { NUVEX } from "@/components/nuvex/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";
import { Users, ArrowRightLeft, X, AlertTriangle, UserCheck, UserMinus, Search, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gestion-usuarios")({
  component: GestionUsuariosPage,
  head: () => ({ meta: [{ title: "Gestión operativa de usuarios · NUVIA" }] }),
});

interface UsuarioRow {
  id: string;
  nombre: string | null;
  email: string | null;
  estado_acceso: string;
  roles: string[];
  casosActivos: number;
  casosTotales: number;
}

interface CasoSearchRow {
  id: string;
  codigo: string | null;
  cliente_nombre: string;
  cedula: string | null;
  numero_credito: string | null;
  banco: string | null;
  producto: string | null;
  estado_caso: string | null;
  asesor_id: string | null;
  licenciado_id: string | null;
  updated_at: string | null;
}

const ESTADOS_ACTIVOS = ["caso_finalizado", "proceso_cerrado", "negado_banco"];

function GestionUsuariosPage() {
  const { isSuperAdmin, roles } = useUserRole();
  const autorizado = isSuperAdmin || roles.includes("gerencia" as never);

  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reasignar, setReasignar] = useState<UsuarioRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ data: profs, error: e1 }, { data: ur }, { data: exps }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, email, estado_acceso").eq("estado_acceso", "aprobado").order("nombre"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("expedientes").select("asesor_id, estado_caso"),
      ]);
      if (e1) throw e1;

      const rolesByUser = new Map<string, string[]>();
      ((ur ?? []) as Array<{ user_id: string; role: string }>).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role);
        rolesByUser.set(r.user_id, list);
      });

      const totByUser = new Map<string, { activos: number; total: number }>();
      ((exps ?? []) as Array<{ asesor_id: string | null; estado_caso: string | null }>).forEach((e) => {
        if (!e.asesor_id) return;
        const slot = totByUser.get(e.asesor_id) ?? { activos: 0, total: 0 };
        slot.total++;
        if (!e.estado_caso || !ESTADOS_ACTIVOS.includes(e.estado_caso)) slot.activos++;
        totByUser.set(e.asesor_id, slot);
      });

      const out: UsuarioRow[] = ((profs ?? []) as Array<{ id: string; nombre: string | null; email: string | null; estado_acceso: string }>).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        email: p.email,
        estado_acceso: p.estado_acceso,
        roles: rolesByUser.get(p.id) ?? [],
        casosActivos: totByUser.get(p.id)?.activos ?? 0,
        casosTotales: totByUser.get(p.id)?.total ?? 0,
      }));
      out.sort((a, b) => b.casosActivos - a.casosActivos);
      setRows(out);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (autorizado) void refresh(); }, [autorizado]);

  const totales = useMemo(() => ({
    usuarios: rows.length,
    activos: rows.reduce((s, r) => s + r.casosActivos, 0),
    sinCasos: rows.filter((r) => r.casosActivos === 0).length,
    sobrecargados: rows.filter((r) => r.casosActivos > 15).length,
  }), [rows]);

  if (!autorizado) {
    return (
      <PageLayout>
        <EmptyState title="Sin acceso" description="Esta sección es exclusiva para Gerencia y Super Admin." />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Users size={12} />, label: "Gerencia · Operaciones", tone: "blue" }}
        title="Gestión Operativa de Usuarios"
        description="Carga operativa por colaborador, roles asignados y reasignación de casos."
      />

      <KpiGrid cols={4}>
        <KpiCard icon={<Users size={16} />} tone="blue" label="Usuarios activos" value={totales.usuarios} />
        <KpiCard icon={<UserCheck size={16} />} tone="green" label="Casos activos" value={totales.activos} />
        <KpiCard icon={<UserMinus size={16} />} tone="neutral" label="Sin casos asignados" value={totales.sinCasos} />
        <KpiCard icon={<AlertTriangle size={16} />} tone={totales.sobrecargados > 0 ? "warning" : "neutral"} label="Sobrecargados (>15)" value={totales.sobrecargados} />
      </KpiGrid>

      <InsightCard scope="productividad" />

      <CasoReasignacionSearch usuarios={rows} onDone={refresh} />

      <NCard padding="md">
        <SectionHeader title="Carga por colaborador" description="Ordenado por casos activos descendente." />
        {loading && <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando usuarios…</div>}
        {err && <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-danger)" }}>{err}</div>}
        {!loading && !err && rows.length === 0 && (
          <EmptyState title="Sin usuarios" description="Aún no hay colaboradores aprobados." />
        )}
        {!loading && !err && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "var(--nuvia-text-body)" }}>
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4">Usuario</th>
                  <th className="text-left py-2 pr-4" style={{ color: "var(--nuvia-text-secondary)" }}>Roles</th>
                  <th className="py-2 pr-4 text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Casos activos</th>
                  <th className="py-2 pr-4 text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Casos totales</th>
                  <th className="py-2 pr-2" style={{ color: "var(--nuvia-text-secondary)" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{r.nombre || "—"}</div>
                      <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>{r.email}</div>
                    </td>
                    <td className="py-2 pr-4">
                      {r.roles.length === 0 ? <span style={{ color: "var(--nuvia-text-secondary)", opacity: 0.6 }}>Sin rol</span> :
                        r.roles.map((rr) => (
                          <span key={rr} className="inline-block mr-1 mb-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "rgba(68,93,163,0.14)", color: "#A5B5E0", border: "1px solid rgba(68,93,163,0.40)" }}>
                            {roleLabel(rr, true)}
                          </span>
                        ))}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold"
                      style={{ color: r.casosActivos > 15 ? "var(--nuvia-warning)" : r.casosActivos === 0 ? "var(--nuvia-text-secondary)" : "var(--nuvia-text-primary)" }}>
                      {r.casosActivos}
                    </td>
                    <td className="py-2 pr-4 text-right" style={{ color: "var(--nuvia-text-secondary)" }}>{r.casosTotales}</td>
                    <td className="py-2 pr-2 text-right">
                      {r.casosActivos > 0 && (
                        <button onClick={() => setReasignar(r)}
                          className="inline-flex items-center gap-1 text-[11px] hover:underline"
                          style={{ color: "var(--nuvia-accent-blue)" }}>
                          <ArrowRightLeft size={12} /> Reasignar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      {reasignar && (
        <ReasignarModal
          origen={reasignar}
          usuarios={rows.filter((u) => u.id !== reasignar.id)}
          onClose={() => setReasignar(null)}
          onDone={async () => { setReasignar(null); await refresh(); }}
        />
      )}

      <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
        ¿Necesitas aprobar accesos o cambiar roles?{" "}
        <Link to="/super-admin/accesos" className="hover:underline" style={{ color: "var(--nuvia-accent-blue)" }}>
          Ir a Super Admin · Accesos
        </Link>
      </div>
    </PageLayout>
  );
}

function ReasignarModal({ origen, usuarios, onClose, onDone }: {
  origen: UsuarioRow;
  usuarios: UsuarioRow[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [tipo, setTipo] = useState<"asesor" | "licenciado">("asesor");
  const [casos, setCasos] = useState<Array<{ id: string; cliente_nombre: string; estado_caso: string | null }>>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoOptions = [
    { value: "asesor", label: "Asesor / responsable comercial" },
    { value: "licenciado", label: "Analista Financiero Comercial" },
  ];

  const usuarioOptions = [
    { value: "", label: "— Selecciona destinatario —" },
    ...usuarios.map((u) => ({ value: u.id, label: `${u.nombre || u.email || "Usuario"} (${u.casosActivos} activos)` })),
  ];

  useEffect(() => {
    setSeleccion(new Set());
    (async () => {
      const col = tipo === "asesor" ? "asesor_id" : "licenciado_id";
      const { data } = await supabase.from("expedientes")
        .select("id, cliente_nombre, estado_caso")
        .eq(col, origen.id)
        .not("estado_caso", "in", `(${ESTADOS_ACTIVOS.map((s) => `"${s}"`).join(",")})`)
        .order("updated_at", { ascending: false })
        .limit(200);
      setCasos((data ?? []) as Array<{ id: string; cliente_nombre: string; estado_caso: string | null }>);
    })();
  }, [origen.id, tipo]);

  const toggle = (id: string) => {
    const ns = new Set(seleccion);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSeleccion(ns);
  };
  const toggleAll = () => setSeleccion(seleccion.size === casos.length ? new Set() : new Set(casos.map((c) => c.id)));

  const reasignar = async () => {
    if (!destino || seleccion.size === 0) { setError("Selecciona destino y al menos un caso."); return; }
    setBusy(true); setError(null);
    try {
      const ids = Array.from(seleccion);
      const col = tipo === "asesor" ? "asesor_id" : "licenciado_id";
      const patch: Record<string, string> = { [col]: destino };
      const { error: e } = await supabase.from("expedientes").update(patch as never).in("id", ids);
      if (e) throw e;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("auditoria_global").insert(
        ids.map((eid) => ({
          entidad: "expediente",
          entidad_id: eid,
          accion: tipo === "asesor" ? "reasignar_asesor" : "reasignar_licenciado",
          user_id: auth.user?.id ?? null,
          valor_anterior: { [col]: origen.id } as never,
          valor_nuevo: { [col]: destino } as never,
        })) as never,
      );
      await onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
          <h2 className="text-base font-semibold">Reasignar casos de {origen.nombre || origen.email}</h2>
          <button onClick={onClose} style={{ color: "var(--nuvia-text-secondary)" }}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="nuvia-label block mb-1">Reasignar como</label>
            <NSelect value={tipo} onValueChange={(v) => setTipo(v as "asesor" | "licenciado")} options={tipoOptions} />
          </div>
          <div>
            <label className="nuvia-label block mb-1">Reasignar a</label>
            <NSelect value={destino} onValueChange={setDestino} options={usuarioOptions} placeholder="Selecciona destinatario" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>{casos.length} casos activos · {seleccion.size} seleccionados</span>
            <button onClick={toggleAll} className="text-[11px] hover:underline" style={{ color: "var(--nuvia-accent-blue)" }}>
              {seleccion.size === casos.length ? "Quitar todos" : "Seleccionar todos"}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--nuvia-border)" }}>
            {casos.length === 0 && <div className="p-4 text-[12px] text-center" style={{ color: "var(--nuvia-text-secondary)" }}>Este usuario no tiene casos activos.</div>}
            {casos.map((c) => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggle(c.id)} />
                <div className="flex-1">
                  <div className="text-[13px]">{c.cliente_nombre}</div>
                  <div className="text-[10px]" style={{ color: "var(--nuvia-text-secondary)" }}>{c.estado_caso}</div>
                </div>
              </label>
            ))}
          </div>
          {error && <div className="text-[12px]" style={{ color: "var(--nuvia-danger)" }}>{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--nuvia-border)" }}>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm" style={{ border: "1px solid var(--nuvia-border)" }}>Cancelar</button>
          <button onClick={reasignar} disabled={busy || !destino || seleccion.size === 0}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: NUVEX.azul }}>
            {busy ? "Reasignando…" : `Reasignar ${seleccion.size} caso(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CasoReasignacionSearch({ usuarios, onDone }: { usuarios: UsuarioRow[]; onDone: () => void | Promise<void> }) {
  const [q, setQ] = useState("");
  const [casos, setCasos] = useState<CasoSearchRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tipo, setTipo] = useState<"asesor" | "licenciado">("asesor");
  const [destino, setDestino] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = casos.find((c) => c.id === selectedId) ?? null;
  const userById = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);

  const usuarioOptions = useMemo(() => [
    { value: "", label: "— Selecciona analista —" },
    ...usuarios.map((u) => ({ value: u.id, label: `${u.nombre || u.email || "Usuario"} · ${u.casosActivos} activos` })),
  ], [usuarios]);

  const tipoOptions = [
    { value: "asesor", label: "Reasignar responsable comercial" },
    { value: "licenciado", label: "Reasignar analista financiero" },
  ];

  const cleanTerm = (value: string) => value.trim().replace(/[%,]/g, " ").replace(/\s+/g, " ");

  const buscar = async () => {
    const term = cleanTerm(q);
    setOk(null);
    setSelectedId("");
    setCasos([]);
    if (term.length < 2) {
      setError("Escribe al menos 2 caracteres del cliente, cédula, crédito o código.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const like = `%${term}%`;
      const { data, error: e } = await supabase
        .from("expedientes")
        .select("id,codigo,cliente_nombre,cedula,numero_credito,banco,producto,estado_caso,asesor_id,licenciado_id,updated_at")
        .or(`cliente_nombre.ilike.${like},cedula.ilike.${like},numero_credito.ilike.${like},codigo.ilike.${like},banco.ilike.${like}`)
        .order("updated_at", { ascending: false })
        .limit(25);
      if (e) throw e;
      const next = (data ?? []) as CasoSearchRow[];
      setCasos(next);
      if (next.length === 1) setSelectedId(next[0].id);
      if (next.length === 0) setError("No encontré casos con ese criterio.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar el caso.");
    } finally {
      setLoading(false);
    }
  };

  const reasignarCaso = async () => {
    if (!selected || !destino) {
      setError("Selecciona un caso y un analista destino.");
      return;
    }
    const col = tipo === "asesor" ? "asesor_id" : "licenciado_id";
    const anterior = tipo === "asesor" ? selected.asesor_id : selected.licenciado_id;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const { error: upErr } = await supabase.from("expedientes").update({ [col]: destino } as never).eq("id", selected.id);
      if (upErr) throw upErr;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("auditoria_global").insert({
        entidad: "expediente",
        entidad_id: selected.id,
        accion: tipo === "asesor" ? "reasignar_asesor_busqueda" : "reasignar_licenciado_busqueda",
        user_id: auth.user?.id ?? null,
        valor_anterior: { [col]: anterior } as never,
        valor_nuevo: { [col]: destino } as never,
      } as never);
      const destinoNombre = userById.get(destino)?.nombre || userById.get(destino)?.email || "destino";
      setOk(`${selected.cliente_nombre} reasignado a ${destinoNombre}.`);
      setCasos((prev) => prev.map((c) => c.id === selected.id ? { ...c, [col]: destino } : c));
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reasignar el caso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NCard padding="md">
      <SectionHeader
        title="Buscar cliente y reasignar caso"
        description="Busca por nombre, cédula, número de crédito, código del caso o banco."
        icon={<Search size={14} />}
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }}
          className="nuvia-input"
          placeholder="Ej: Daniel, Manuel Santos, NUV_2026, cédula o crédito…"
        />
        <button
          type="button"
          onClick={() => void buscar()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: NUVEX.azul }}
        >
          <Search size={14} /> {loading ? "Buscando…" : "Buscar caso"}
        </button>
      </div>

      {casos.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(360px,1.2fr)_minmax(300px,0.8fr)]">
          <div className="max-h-80 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--nuvia-border)" }}>
            {casos.map((c) => {
              const active = selectedId === c.id;
              const asesor = c.asesor_id ? userById.get(c.asesor_id) : null;
              const licenciado = c.licenciado_id ? userById.get(c.licenciado_id) : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="block w-full px-3 py-3 text-left transition-colors"
                  style={{
                    borderBottom: "1px solid var(--nuvia-border)",
                    background: active ? "rgba(68,93,163,0.18)" : "transparent",
                    color: "var(--nuvia-text-primary)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{c.cliente_nombre}</div>
                    <div className="text-[10px]" style={{ color: "var(--nuvia-text-secondary)" }}>{c.codigo ?? c.estado_caso ?? "—"}</div>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                    {c.banco ?? "Sin banco"} · {c.numero_credito ?? "Sin crédito"} · {c.cedula ?? "Sin cédula"}
                  </div>
                  <div className="mt-1 text-[10px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                    Responsable: {asesor?.nombre || asesor?.email || "Sin asignar"} · Analista: {licenciado?.nombre || licenciado?.email || "Sin asignar"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg p-4 space-y-3" style={{ border: "1px solid var(--nuvia-border)", background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[12px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              {selected ? `Reasignar: ${selected.cliente_nombre}` : "Selecciona un caso"}
            </div>
            <div>
              <label className="nuvia-label block mb-1">Qué reasignar</label>
              <NSelect value={tipo} onValueChange={(v) => setTipo(v as "asesor" | "licenciado")} options={tipoOptions} />
            </div>
            <div>
              <label className="nuvia-label block mb-1">Analista destino</label>
              <NSelect value={destino} onValueChange={setDestino} options={usuarioOptions} placeholder="Selecciona analista" />
            </div>
            <button
              type="button"
              onClick={() => void reasignarCaso()}
              disabled={saving || !selected || !destino}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: NUVEX.verde }}
            >
              <ArrowRightLeft size={14} /> {saving ? "Reasignando…" : "Reasignar caso seleccionado"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-3 text-[12px]" style={{ color: "var(--nuvia-danger)" }}>{error}</div>}
      {ok && <div className="mt-3 inline-flex items-center gap-2 text-[12px]" style={{ color: "var(--nuvia-accent-green)" }}><CheckCircle2 size={13} /> {ok}</div>}
    </NCard>
  );
}
