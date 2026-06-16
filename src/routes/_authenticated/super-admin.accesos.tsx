import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import {
  listUsuariosAcceso, aprobarUsuario, rechazarUsuario,
  bloquearUsuario, activarUsuario, listAuditoria,
  previewDesvinculacion, desvincularUsuario, desvincularUsuarioSinTraslado,
  listSolicitudesReactivacion, aprobarReactivacion, rechazarReactivacion,
  type UsuarioAcceso, type EstadoAcceso, type PreviewDesvinculacion,
  type SolicitudReactivacion, type EstadoReactivacion,
} from "@/lib/seguridad";
import { roleLabel } from "@/lib/roleLabels";
import { ShieldCheck, ShieldAlert, ShieldOff, Clock, CheckCircle2, XCircle, Search, History, UserMinus, AlertTriangle, RefreshCw } from "lucide-react";
import { UserAvatar } from "@/components/nuvex/UserAvatar";


export const Route = createFileRoute("/_authenticated/super-admin/accesos")({
  component: AccesosPage,
  head: () => ({ meta: [{ title: "Gestión de Accesos · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const NEGRO = "#242424";

const TABS: { v: EstadoAcceso | "todos"; label: string; Icon: typeof Clock }[] = [
  { v: "pendiente", label: "Pendientes", Icon: Clock },
  { v: "aprobado", label: "Aprobados", Icon: CheckCircle2 },
  { v: "rechazado", label: "Rechazados", Icon: XCircle },
  { v: "bloqueado", label: "Bloqueados", Icon: ShieldOff },
  { v: "desvinculado", label: "Desvinculados", Icon: UserMinus },
  { v: "todos", label: "Todos", Icon: ShieldCheck },
];

const ROLES_DISPONIBLES: AppRole[] = [
  "super_admin", "admin", "gerencia", "licenciado",
  "asesor", "juridica", "operaciones", "contabilidad",
  "director_financiero_qa", "director_juridico", "cartera",
  "auxiliar_operativo", "apoderado",
];

function badge(estado: EstadoAcceso) {
  const map: Record<EstadoAcceso, { bg: string; fg: string; label: string }> = {
    pendiente: { bg: "#FEF3C7", fg: "#92400E", label: "Pendiente" },
    aprobado: { bg: "#EAF7EE", fg: "#1F6D3D", label: "Aprobado" },
    rechazado: { bg: "#FDECEC", fg: "#B42318", label: "Rechazado" },
    bloqueado: { bg: "#E5E7EB", fg: "#374151", label: "Bloqueado" },
    desvinculado: { bg: "#EEF2FF", fg: "#3730A3", label: "Desvinculado" },
  };
  const s = map[estado];
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function AccesosPage() {
  const { isSuperAdmin, roles, loading: rolesLoading } = useUserRole();
  const isAdmin = isSuperAdmin || roles.includes("admin") || roles.includes("gerencia");
  const [tab, setTab] = useState<EstadoAcceso | "todos">("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioAcceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState<UsuarioAcceso | null>(null);
  const [showAprobar, setShowAprobar] = useState(false);
  const [rolesAsignar, setRolesAsignar] = useState<AppRole[]>([]);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [showRechazar, setShowRechazar] = useState(false);
  const [auditoria, setAuditoria] = useState<Array<{ id: string; accion: string; created_at: string; detalle: Record<string, unknown> }>>([]);
  const [showDesvincular, setShowDesvincular] = useState(false);
  const [modoDesvinc, setModoDesvinc] = useState<"con_traslado" | "sin_traslado">("con_traslado");
  const [preview, setPreview] = useState<PreviewDesvinculacion | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [reemplazoId, setReemplazoId] = useState<string>("");
  const [transferirComisiones, setTransferirComisiones] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [sinTrasladoMotivo, setSinTrasladoMotivo] = useState("");
  const [sinTrasladoAck, setSinTrasladoAck] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [desvincularError, setDesvincularError] = useState<string | null>(null);
  const [showBloquear, setShowBloquear] = useState(false);
  const [motivoBloqueo, setMotivoBloqueo] = useState("");
  const [confirmarBloqueo, setConfirmarBloqueo] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [bloqueoError, setBloqueoError] = useState<string | null>(null);
  const [showDesbloquear, setShowDesbloquear] = useState(false);
  const [motivoDesbloqueo, setMotivoDesbloqueo] = useState("");
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [desbloqueoError, setDesbloqueoError] = useState<string | null>(null);
  const [accionMsg, setAccionMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  // Reactivaciones
  const [vista, setVista] = useState<"usuarios" | "reactivaciones">("usuarios");
  const [reactTab, setReactTab] = useState<EstadoReactivacion | "todos">("PENDIENTE");
  const [solicitudes, setSolicitudes] = useState<SolicitudReactivacion[]>([]);
  const [solLoading, setSolLoading] = useState(false);
  const [solSel, setSolSel] = useState<SolicitudReactivacion | null>(null);
  const [showAprobarSol, setShowAprobarSol] = useState(false);
  const [showRechazarSol, setShowRechazarSol] = useState(false);
  const [solRolAsign, setSolRolAsign] = useState<AppRole | "">("");
  const [solObs, setSolObs] = useState("");
  const [solMotivoRech, setSolMotivoRech] = useState("");
  const [solBusy, setSolBusy] = useState(false);
  const [solError, setSolError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listUsuariosAcceso(tab === "todos" ? undefined : tab);
      setUsuarios(data);
    } finally { setLoading(false); }
  };

  const reloadSolicitudes = async () => {
    setSolLoading(true);
    try {
      const data = await listSolicitudesReactivacion(reactTab === "todos" ? undefined : reactTab);
      setSolicitudes(data);
    } finally { setSolLoading(false); }
  };

  useEffect(() => { if (!rolesLoading && isAdmin && vista === "usuarios") reload(); /* eslint-disable-next-line */ }, [tab, rolesLoading, isAdmin, vista]);
  useEffect(() => { if (!rolesLoading && isSuperAdmin && vista === "reactivaciones") reloadSolicitudes(); /* eslint-disable-next-line */ }, [reactTab, rolesLoading, isSuperAdmin, vista]);


  useEffect(() => {
    if (seleccionado) {
      listAuditoria(seleccionado.id).then(setAuditoria).catch(() => setAuditoria([]));
    }
  }, [seleccionado]);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return usuarios;
    const q = busqueda.toLowerCase();
    return usuarios.filter((u) =>
      (u.nombre ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.ciudad_registro ?? "").toLowerCase().includes(q) ||
      (u.rol_solicitado ?? "").toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  if (rolesLoading) return <div className="p-12 text-center text-sm text-[var(--nuvia-text-secondary)]">Cargando…</div>;
  if (!isAdmin) return <Navigate to="/inicio" />;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-semibold mb-2"
               style={{ background: `${AZUL}15`, color: AZUL }}>
            <ShieldCheck size={12} /> Centro de seguridad
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: NEGRO }}>Gestión de Accesos</h1>
          <div className="text-sm text-[var(--nuvia-text-secondary)]">Aprueba, rechaza, reactiva y administra el acceso a la plataforma NUVEX</div>
        </div>
      </div>

      {/* Selector de vista (Usuarios / Reactivaciones) */}
      {isSuperAdmin && (
        <div className="flex gap-2 border-b border-[var(--nuvia-border)]">
          <button
            onClick={() => setVista("usuarios")}
            className="px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px"
            style={vista === "usuarios"
              ? { borderColor: AZUL, color: AZUL }
              : { borderColor: "transparent", color: "#6B7280" }}
          >Usuarios</button>
          <button
            onClick={() => setVista("reactivaciones")}
            className="px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px inline-flex items-center gap-2"
            style={vista === "reactivaciones"
              ? { borderColor: AZUL, color: AZUL }
              : { borderColor: "transparent", color: "#6B7280" }}
          >
            <RefreshCw size={14} /> Reactivaciones
            {solicitudes.filter((s) => s.estado === "PENDIENTE").length > 0 && (
              <span className="rounded-full bg-[#B42318] text-white text-[10px] font-bold px-1.5 py-0.5">
                {solicitudes.filter((s) => s.estado === "PENDIENTE").length}
              </span>
            )}
          </button>
        </div>
      )}

      {vista === "reactivaciones" ? (
        <ReactivacionesPanel
          tab={reactTab} setTab={setReactTab}
          solicitudes={solicitudes} loading={solLoading}
          onAprobar={(s) => { setSolSel(s); setSolRolAsign((s.rol_solicitado as AppRole) || (s.rol_actual as AppRole) || ""); setSolObs(""); setSolError(null); setShowAprobarSol(true); }}
          onRechazar={(s) => { setSolSel(s); setSolMotivoRech(""); setSolError(null); setShowRechazarSol(true); }}
        />
      ) : (
        <>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.v;
          const count = t.v === "todos" ? null : usuarios.filter((u) => u.estado_acceso === t.v).length;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition border"
              style={active
                ? { background: `linear-gradient(135deg,${AZUL},${VERDE})`, color: "#fff", borderColor: AZUL }
                : { background: "#fff", color: NEGRO, borderColor: "#E3E7EE" }}
            >
              <t.Icon size={14} /> {t.label}
              {tab === t.v && count !== null && <span className="text-[10px] rounded-full bg-[var(--nuvia-bg-card)]/25 px-1.5">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nuvia-text-primary)]/40" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo, ciudad o rol…"
          className="w-full rounded-xl border border-[var(--nuvia-border)] bg-[var(--nuvia-bg-card)] pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#445DA3]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-sm text-[var(--nuvia-text-secondary)]">Cargando usuarios…</div>
          ) : filtrados.length === 0 ? (
            <Card><div className="py-10 text-center text-sm text-[var(--nuvia-text-secondary)]">No hay usuarios en este estado.</div></Card>
          ) : (
            filtrados.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <UserAvatar userId={u.id} name={u.nombre ?? ""} email={u.email ?? ""} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-[15px] font-semibold truncate" style={{ color: NEGRO }}>{u.nombre || "—"}</div>
                        {badge(u.estado_acceso)}
                      </div>
                      <div className="text-xs text-[var(--nuvia-text-secondary)] truncate">{u.email}</div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[var(--nuvia-text-secondary)]">
                        <div><b className="font-semibold text-[var(--nuvia-text-primary)]/55 uppercase tracking-wider">Rol solicitado:</b> {roleLabel(u.rol_solicitado)}</div>
                        <div><b className="font-semibold text-[var(--nuvia-text-primary)]/55 uppercase tracking-wider">Teléfono:</b> {u.telefono_registro || "—"}</div>
                        <div><b className="font-semibold text-[var(--nuvia-text-primary)]/55 uppercase tracking-wider">Ciudad:</b> {u.ciudad_registro || "—"}</div>
                        <div><b className="font-semibold text-[var(--nuvia-text-primary)]/55 uppercase tracking-wider">Equipo:</b> {u.equipo_registro || "—"}</div>
                        <div><b className="font-semibold text-[var(--nuvia-text-primary)]/55 uppercase tracking-wider">Creado:</b> {new Date(u.created_at).toLocaleDateString("es-CO")}</div>
                        <div><b className="font-semibold text-[var(--nuvia-text-primary)]/55 uppercase tracking-wider">Último login:</b> {u.ultimo_login_at ? new Date(u.ultimo_login_at).toLocaleDateString("es-CO") : "Nunca"}</div>
                      </div>
                      {u.rechazado_motivo && (
                        <div className="mt-2 rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-2 py-1.5 text-[11px] text-[#B42318]">
                          <b>Motivo de rechazo:</b> {u.rechazado_motivo}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--nuvia-border)] pt-3">
                  {u.estado_acceso === "pendiente" && (
                    <>
                      <button
                        onClick={() => { setSeleccionado(u); setRolesAsignar([u.rol_solicitado as AppRole].filter((r): r is AppRole => ROLES_DISPONIBLES.includes(r))); setShowAprobar(true); }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: VERDE }}
                      ><CheckCircle2 size={12} className="inline mr-1" />Aprobar</button>
                      <button
                        onClick={() => { setSeleccionado(u); setMotivoRechazo(""); setShowRechazar(true); }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: "#B42318" }}
                      ><XCircle size={12} className="inline mr-1" />Rechazar</button>
                    </>
                  )}
                  {u.estado_acceso === "aprobado" && isSuperAdmin && (
                    <button
                      onClick={() => {
                        setSeleccionado(u);
                        setMotivoBloqueo("");
                        setConfirmarBloqueo(false);
                        setBloqueoError(null);
                        setShowBloquear(true);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "#6B7280" }}
                    ><ShieldOff size={12} className="inline mr-1" />Bloquear</button>
                  )}
                  {(u.estado_acceso === "bloqueado" || u.estado_acceso === "rechazado") && isSuperAdmin && (
                    <button
                      onClick={() => {
                        setSeleccionado(u);
                        setMotivoDesbloqueo("");
                        setDesbloqueoError(null);
                        setShowDesbloquear(true);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: VERDE }}
                    ><CheckCircle2 size={12} className="inline mr-1" />{u.estado_acceso === "bloqueado" ? "Desbloquear" : "Reactivar"}</button>
                  )}
                  {u.estado_acceso !== "desvinculado" && (
                    <button
                      onClick={async () => {
                        setSeleccionado(u);
                        setShowDesvincular(true);
                        setModoDesvinc("con_traslado");
                        setReemplazoId("");
                        setTransferirComisiones(false);
                        setConfirmText("");
                        setSinTrasladoMotivo("");
                        setSinTrasladoAck(false);
                        setDesvincularError(null);
                        setPreview(null);
                        setPreviewLoading(true);
                        try {
                          const p = await previewDesvinculacion(u.id);
                          setPreview(p);
                        } catch (e) {
                          setDesvincularError((e as Error).message);
                        } finally {
                          setPreviewLoading(false);
                        }
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "#7C2D12" }}
                    ><UserMinus size={12} className="inline mr-1" />Desvincular</button>
                  )}
                  <button
                    onClick={() => setSeleccionado(u)}
                    className="ml-auto rounded-lg border border-[var(--nuvia-border)] bg-[var(--nuvia-bg-card)] px-3 py-1.5 text-xs font-semibold"
                    style={{ color: AZUL }}
                  ><History size={12} className="inline mr-1" />Auditoría</button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Panel de auditoría */}
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={16} style={{ color: AZUL }} />
              <h3 className="font-semibold text-sm" style={{ color: NEGRO }}>Historial de auditoría</h3>
            </div>
            {!seleccionado ? (
              <div className="text-sm text-[var(--nuvia-text-primary)]/55 py-6 text-center">Selecciona un usuario para ver su historial.</div>
            ) : auditoria.length === 0 ? (
              <div className="text-sm text-[var(--nuvia-text-primary)]/55 py-6 text-center">Sin eventos.</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {auditoria.map((a) => (
                  <div key={a.id} className="rounded-lg border border-[var(--nuvia-border)] bg-[#FAFBFD] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: AZUL }}>{a.accion}</span>
                      <span className="text-[10px] text-[var(--nuvia-text-primary)]/55">{new Date(a.created_at).toLocaleString("es-CO")}</span>
                    </div>
                    {Object.keys(a.detalle).length > 0 && (
                      <pre className="mt-1 text-[10px] text-[var(--nuvia-text-secondary)] whitespace-pre-wrap break-all">{JSON.stringify(a.detalle, null, 0)}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal Aprobar */}
      {showAprobar && seleccionado && (
        <Modal onClose={() => setShowAprobar(false)} title={`Aprobar acceso · ${seleccionado.nombre}`}>
          <p className="text-sm text-[var(--nuvia-text-secondary)] mb-3">Selecciona los roles que tendrá este usuario:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {ROLES_DISPONIBLES.map((r) => {
              const sel = rolesAsignar.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => setRolesAsignar(sel ? rolesAsignar.filter((x) => x !== r) : [...rolesAsignar, r])}
                  className="rounded-full px-3 py-1 text-xs font-medium border"
                  style={sel
                    ? { background: AZUL, color: "#fff", borderColor: AZUL }
                    : { background: "#fff", color: NEGRO, borderColor: "#E3E7EE" }}
                >{roleLabel(r)}</button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAprobar(false)} className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium">Cancelar</button>
            <button
              onClick={async () => {
                if (rolesAsignar.length === 0) return;
                await aprobarUsuario(seleccionado.id, rolesAsignar);
                setShowAprobar(false);
                setSeleccionado(null);
                reload();
              }}
              disabled={rolesAsignar.length === 0}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
            >Aprobar y asignar roles</button>
          </div>
        </Modal>
      )}

      {/* Modal Rechazar */}
      {showRechazar && seleccionado && (
        <Modal onClose={() => setShowRechazar(false)} title={`Rechazar acceso · ${seleccionado.nombre}`}>
          <label className="block mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Motivo del rechazo</span>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]"
              placeholder="Explica brevemente por qué se rechaza este acceso…"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowRechazar(false)} className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium">Cancelar</button>
            <button
              onClick={async () => {
                if (motivoRechazo.trim().length < 3) return;
                await rechazarUsuario(seleccionado.id, motivoRechazo.trim());
                setShowRechazar(false);
                setSeleccionado(null);
                reload();
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "#B42318" }}
            >Confirmar rechazo</button>
          </div>
        </Modal>
      )}

      {/* Toast acción */}
      {accionMsg && (
        <div
          className="fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ background: accionMsg.tipo === "ok" ? VERDE : "#B42318" }}
        >{accionMsg.texto}</div>
      )}

      {/* Modal Bloquear */}
      {showBloquear && seleccionado && (
        <Modal onClose={() => !bloqueando && setShowBloquear(false)} title={`Bloquear · ${seleccionado.nombre}`}>
          <p className="mb-3 text-sm text-[var(--nuvia-text-primary)]">
            ¿Estás seguro de bloquear este usuario? El usuario perderá acceso inmediato a la plataforma,
            pero su historial, auditoría y procesos se conservarán.
          </p>
          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Motivo del bloqueo (obligatorio)</span>
            <textarea
              value={motivoBloqueo}
              onChange={(e) => setMotivoBloqueo(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]"
              placeholder="Indica el motivo del bloqueo (mín. 5 caracteres)…"
            />
          </label>
          <label className="mb-3 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmarBloqueo} onChange={(e) => setConfirmarBloqueo(e.target.checked)} className="mt-0.5" />
            <span>Confirmo que entiendo el efecto del bloqueo y deseo continuar.</span>
          </label>
          {bloqueoError && <div className="mb-3 rounded-md bg-[#FDECEC] px-3 py-2 text-xs text-[#B42318]">{bloqueoError}</div>}
          <div className="flex justify-end gap-2">
            <button disabled={bloqueando} onClick={() => setShowBloquear(false)} className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium">Cancelar</button>
            <button
              disabled={bloqueando || motivoBloqueo.trim().length < 5 || !confirmarBloqueo}
              onClick={async () => {
                setBloqueoError(null);
                setBloqueando(true);
                try {
                  await bloquearUsuario(seleccionado.id, motivoBloqueo.trim());
                  setShowBloquear(false);
                  setSeleccionado(null);
                  setAccionMsg({ tipo: "ok", texto: "Usuario bloqueado correctamente." });
                  setTimeout(() => setAccionMsg(null), 4000);
                  await reload();
                } catch (e) {
                  setBloqueoError((e as Error).message);
                } finally {
                  setBloqueando(false);
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#B42318" }}
            >{bloqueando ? "Bloqueando…" : "Confirmar bloqueo"}</button>
          </div>
        </Modal>
      )}

      {/* Modal Desbloquear */}
      {showDesbloquear && seleccionado && (
        <Modal onClose={() => !desbloqueando && setShowDesbloquear(false)} title={`Desbloquear · ${seleccionado.nombre}`}>
          <p className="mb-3 text-sm text-[var(--nuvia-text-primary)]">
            El usuario recuperará acceso inmediato a la plataforma. Esta acción quedará registrada en auditoría.
          </p>
          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Motivo (opcional)</span>
            <textarea
              value={motivoDesbloqueo}
              onChange={(e) => setMotivoDesbloqueo(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]"
              placeholder="Razón del desbloqueo…"
            />
          </label>
          {desbloqueoError && <div className="mb-3 rounded-md bg-[#FDECEC] px-3 py-2 text-xs text-[#B42318]">{desbloqueoError}</div>}
          <div className="flex justify-end gap-2">
            <button disabled={desbloqueando} onClick={() => setShowDesbloquear(false)} className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium">Cancelar</button>
            <button
              disabled={desbloqueando}
              onClick={async () => {
                setDesbloqueoError(null);
                setDesbloqueando(true);
                try {
                  await activarUsuario(seleccionado.id, motivoDesbloqueo.trim() || undefined);
                  setShowDesbloquear(false);
                  setSeleccionado(null);
                  setAccionMsg({ tipo: "ok", texto: "Usuario desbloqueado correctamente." });
                  setTimeout(() => setAccionMsg(null), 4000);
                  await reload();
                } catch (e) {
                  setDesbloqueoError((e as Error).message);
                } finally {
                  setDesbloqueando(false);
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: VERDE }}
            >{desbloqueando ? "Desbloqueando…" : "Confirmar desbloqueo"}</button>
          </div>
        </Modal>
      )}



      {/* Modal Desvincular */}
      {showDesvincular && seleccionado && (
        <Modal wide onClose={() => !desvinculando && setShowDesvincular(false)} title={`Desvincular · ${seleccionado.nombre}`}>
          {/* Selector de modo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setModoDesvinc("con_traslado")}
              className="rounded-xl border p-3 text-left transition"
              style={modoDesvinc === "con_traslado"
                ? { borderColor: VERDE, background: "#EAF7EE" }
                : { borderColor: "#E3E7EE", background: "#fff" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#1F6D3D" }}>Recomendado</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: NEGRO }}>Con traslado</div>
              <div className="text-[11px] text-[var(--nuvia-text-primary)]/65 mt-1">Transfiere casos, expedientes, cartera y responsabilidades a un usuario reemplazo.</div>
            </button>
            <button
              type="button"
              onClick={() => setModoDesvinc("sin_traslado")}
              className="rounded-xl border p-3 text-left transition"
              style={modoDesvinc === "sin_traslado"
                ? { borderColor: "#B42318", background: "#FDF2F2" }
                : { borderColor: "#E3E7EE", background: "#fff" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#B42318" }}>No recomendado</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: NEGRO }}>Sin traslado</div>
              <div className="text-[11px] text-[var(--nuvia-text-primary)]/65 mt-1">El usuario se desvincula sin reasignar. Casos y procesos pueden quedar sin responsable operativo.</div>
            </button>
          </div>

          <div className="rounded-lg border border-[#FCD7D7] bg-[#FDF2F2] px-3 py-2.5 text-[12px] text-[#7C2D12] mb-4 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <b>Acción crítica.</b> El usuario perderá acceso operativo. Los datos históricos (mensajes, auditoría, academia) se conservan en todos los casos.
            </div>
          </div>

          {previewLoading ? (
            <div className="py-6 text-center text-sm text-[var(--nuvia-text-secondary)]">Analizando dependencias…</div>
          ) : preview ? (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: AZUL }}>
                  {modoDesvinc === "con_traslado" ? "Se transferirán al reemplazo" : "Quedarán sin responsable (huérfanos)"}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Expedientes" v={preview.transferibles.expedientes} />
                  <Stat label="Cartera (responsable)" v={preview.transferibles.cartera_responsable} />
                  <Stat label="Cartera (creador)" v={preview.transferibles.cartera_creador} />
                  <Stat label="Validaciones QA pendientes" v={preview.transferibles.validaciones_qa_pendientes} />
                  <Stat label="Reglas de comisión" v={preview.transferibles.reglas_comision} />
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: AZUL }}>Comisiones</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Pendientes" v={preview.comisiones.pendientes} />
                  <Stat label="Pagadas (histórico)" v={preview.comisiones.pagadas} />
                  <Stat label="Cuentas de cobro pendientes" v={preview.comisiones.cuentas_cobro_pendientes} />
                  <Stat label="Cuentas de cobro pagadas" v={preview.comisiones.cuentas_cobro_pagadas} />
                </div>
                {modoDesvinc === "con_traslado" && (
                  <label className="mt-3 flex items-start gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={transferirComisiones}
                      onChange={(e) => setTransferirComisiones(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <b>¿Transferir comisiones pendientes al reemplazo?</b>
                      <div className="text-[11px] text-[var(--nuvia-text-secondary)]">Si no marcas esta opción, las reglas del usuario se desactivan y las comisiones pendientes quedan a su nombre (histórico).</div>
                    </span>
                  </label>
                )}
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: NEGRO }}>Se conserva como histórico</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Mensajes" v={preview.historico.mensajes} muted />
                  <Stat label="Notificaciones" v={preview.historico.notificaciones} muted />
                  <Stat label="Auditoría" v={preview.historico.auditoria} muted />
                  <Stat label="Progreso academia" v={preview.historico.progreso_academia} muted />
                  <Stat label="Validaciones QA históricas" v={preview.historico.validaciones_qa_historicas} muted />
                </div>
              </div>

              {modoDesvinc === "con_traslado" ? (
                <>
                  <div>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Usuario de reemplazo (obligatorio)</span>
                      <select
                        value={reemplazoId}
                        onChange={(e) => setReemplazoId(e.target.value)}
                        className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[var(--nuvia-bg-card)] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]"
                      >
                        <option value="">— Selecciona un usuario aprobado —</option>
                        {usuarios
                          .filter((x) => x.id !== seleccionado.id && x.estado_acceso === "aprobado")
                          .map((x) => (
                            <option key={x.id} value={x.id}>{x.nombre || x.email} ({x.email})</option>
                          ))}
                      </select>
                      {usuarios.filter((x) => x.id !== seleccionado.id && x.estado_acceso === "aprobado").length === 0 && (
                        <div className="mt-1.5 text-[11px] text-[#B42318]">No hay otros usuarios aprobados cargados. Cambia a la pestaña "Aprobados" para listarlos.</div>
                      )}
                    </label>
                  </div>

                  <div>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Escribe DESVINCULAR para confirmar</span>
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#7C2D12]"
                        placeholder="DESVINCULAR"
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border-2 border-[#B42318] bg-[#FDECEC] px-3 py-3 text-[12px] text-[#7C2D12] flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "#B42318" }} />
                    <div>
                      <b>Advertencia:</b> estás intentando desvincular este usuario sin asignar un responsable reemplazo.
                      Si continúas, algunos casos, expedientes, tareas, alertas o procesos pueden quedar sin responsable
                      operativo. Esto puede afectar la trazabilidad, seguimiento comercial, cartera, jurídica, comisiones
                      y control interno de NUVEX. Recomendamos usar la desvinculación segura con traslado.
                    </div>
                  </div>

                  <div>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Motivo de la desvinculación sin traslado (obligatorio)</span>
                      <textarea
                        value={sinTrasladoMotivo}
                        onChange={(e) => setSinTrasladoMotivo(e.target.value)}
                        rows={3}
                        className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#B42318]"
                        placeholder="Explica por qué se procede sin reasignar responsable (mínimo 10 caracteres)…"
                      />
                    </label>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={sinTrasladoAck}
                      onChange={(e) => setSinTrasladoAck(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span><b>Entiendo el riesgo y deseo continuar sin traslado.</b></span>
                  </label>

                  <div>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Escribe DESVINCULAR SIN TRASLADO para confirmar</span>
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#B42318]"
                        placeholder="DESVINCULAR SIN TRASLADO"
                      />
                    </label>
                  </div>
                </>
              )}

              {desvincularError && (
                <div className="rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-xs text-[#B42318]">{desvincularError}</div>
              )}
            </div>
          ) : (
            desvincularError && <div className="rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-xs text-[#B42318]">{desvincularError}</div>
          )}

          {/* Checklist de requisitos en vivo */}
          {modoDesvinc === "sin_traslado" && (
            <ul className="mt-4 space-y-1 text-[11px]">
              <li style={{ color: sinTrasladoMotivo.trim().length >= 10 ? "#1F6D3D" : "#B42318" }}>
                {sinTrasladoMotivo.trim().length >= 10 ? "✓" : "○"} Motivo con al menos 10 caracteres ({sinTrasladoMotivo.trim().length}/10)
              </li>
              <li style={{ color: sinTrasladoAck ? "#1F6D3D" : "#B42318" }}>
                {sinTrasladoAck ? "✓" : "○"} Reconocimiento de riesgo marcado
              </li>
              <li style={{ color: confirmText.trim().toUpperCase() === "DESVINCULAR SIN TRASLADO" ? "#1F6D3D" : "#B42318" }}>
                {confirmText.trim().toUpperCase() === "DESVINCULAR SIN TRASLADO" ? "✓" : "○"} Texto de confirmación exacto: DESVINCULAR SIN TRASLADO
              </li>
            </ul>
          )}
          {modoDesvinc === "con_traslado" && (
            <ul className="mt-4 space-y-1 text-[11px]">
              <li style={{ color: reemplazoId ? "#1F6D3D" : "#B42318" }}>
                {reemplazoId ? "✓" : "○"} Usuario de reemplazo seleccionado
              </li>
              <li style={{ color: confirmText.trim().toUpperCase() === "DESVINCULAR" ? "#1F6D3D" : "#B42318" }}>
                {confirmText.trim().toUpperCase() === "DESVINCULAR" ? "✓" : "○"} Texto de confirmación: DESVINCULAR
              </li>
            </ul>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowDesvincular(false)}
              disabled={desvinculando}
              className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            >Cancelar</button>
            {modoDesvinc === "con_traslado" ? (
              <button
                onClick={async () => {
                  setDesvincularError(null);
                  if (!reemplazoId) { setDesvincularError("Selecciona un usuario de reemplazo."); return; }
                  if (confirmText.trim().toUpperCase() !== "DESVINCULAR") { setDesvincularError('Escribe exactamente "DESVINCULAR" para confirmar.'); return; }
                  setDesvinculando(true);
                  try {
                    await desvincularUsuario(seleccionado.id, reemplazoId, transferirComisiones);
                    setShowDesvincular(false);
                    setSeleccionado(null);
                    reload();
                  } catch (e) {
                    setDesvincularError((e as Error).message || "Error al desvincular.");
                  } finally {
                    setDesvinculando(false);
                  }
                }}
                disabled={desvinculando}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#7C2D12" }}
              >{desvinculando ? "Desvinculando…" : "Confirmar desvinculación con traslado"}</button>
            ) : (
              <button
                onClick={async () => {
                  setDesvincularError(null);
                  if (sinTrasladoMotivo.trim().length < 10) { setDesvincularError("El motivo debe tener al menos 10 caracteres."); return; }
                  if (!sinTrasladoAck) { setDesvincularError("Debes marcar el reconocimiento de riesgo."); return; }
                  if (confirmText.trim().toUpperCase() !== "DESVINCULAR SIN TRASLADO") { setDesvincularError('Escribe exactamente "DESVINCULAR SIN TRASLADO" para confirmar.'); return; }
                  setDesvinculando(true);
                  try {
                    await desvincularUsuarioSinTraslado(seleccionado.id, sinTrasladoMotivo.trim());
                    setShowDesvincular(false);
                    setSeleccionado(null);
                    reload();
                  } catch (e) {
                    setDesvincularError((e as Error).message || "Error al desvincular sin traslado.");
                  } finally {
                    setDesvinculando(false);
                  }
                }}
                disabled={desvinculando}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#B42318" }}
              >{desvinculando ? "Desvinculando…" : "Desvincular sin traslado"}</button>
            )}

          </div>
        </Modal>
      )}
        </>
      )}

      {/* Modal Aprobar Reactivación */}
      {showAprobarSol && solSel && (
        <Modal onClose={() => !solBusy && setShowAprobarSol(false)} title={`Reactivar acceso · ${solSel.nombre || solSel.correo}`}>
          <p className="mb-3 text-sm text-[var(--nuvia-text-primary)]/75">
            El usuario recuperará acceso completo a NUVEX conservando todo su historial (auditoría, academia, expedientes, comisiones, colaboración).
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md bg-[#FAFBFD] border border-[var(--nuvia-border)] p-2"><b className="block uppercase tracking-wider text-[var(--nuvia-text-primary)]/55">Rol anterior</b>{roleLabel(solSel.rol_actual)}</div>
            <div className="rounded-md bg-[#FAFBFD] border border-[var(--nuvia-border)] p-2"><b className="block uppercase tracking-wider text-[var(--nuvia-text-primary)]/55">Rol solicitado</b>{roleLabel(solSel.rol_solicitado)}</div>
          </div>
          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Rol a asignar al reactivar</span>
            <select value={solRolAsign} onChange={(e) => setSolRolAsign(e.target.value as AppRole | "")}
              className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[var(--nuvia-bg-card)] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]">
              <option value="">— Mantener / sin rol —</option>
              {ROLES_DISPONIBLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </label>
          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Observación (opcional)</span>
            <textarea value={solObs} onChange={(e) => setSolObs(e.target.value)} rows={2}
              className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]" />
          </label>
          {solError && <div className="mb-3 rounded-md bg-[#FDECEC] px-3 py-2 text-xs text-[#B42318]">{solError}</div>}
          <div className="flex justify-end gap-2">
            <button disabled={solBusy} onClick={() => setShowAprobarSol(false)} className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium">Cancelar</button>
            <button
              disabled={solBusy}
              onClick={async () => {
                setSolError(null); setSolBusy(true);
                try {
                  await aprobarReactivacion(solSel.id, (solRolAsign || undefined) as AppRole | undefined, solObs.trim() || undefined);
                  setShowAprobarSol(false); setSolSel(null);
                  setAccionMsg({ tipo: "ok", texto: "Usuario reactivado correctamente." });
                  setTimeout(() => setAccionMsg(null), 4000);
                  await reloadSolicitudes();
                } catch (e) { setSolError((e as Error).message); } finally { setSolBusy(false); }
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
            >{solBusy ? "Reactivando…" : "Confirmar reactivación"}</button>
          </div>
        </Modal>
      )}

      {/* Modal Rechazar Reactivación */}
      {showRechazarSol && solSel && (
        <Modal onClose={() => !solBusy && setShowRechazarSol(false)} title={`Rechazar reactivación · ${solSel.nombre || solSel.correo}`}>
          <label className="block mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-primary)]/65">Motivo del rechazo (obligatorio, mín. 5)</span>
            <textarea value={solMotivoRech} onChange={(e) => setSolMotivoRech(e.target.value)} rows={4}
              className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#B42318]" />
          </label>
          {solError && <div className="mb-3 rounded-md bg-[#FDECEC] px-3 py-2 text-xs text-[#B42318]">{solError}</div>}
          <div className="flex justify-end gap-2">
            <button disabled={solBusy} onClick={() => setShowRechazarSol(false)} className="rounded-lg border border-[var(--nuvia-border)] px-4 py-2 text-sm font-medium">Cancelar</button>
            <button
              disabled={solBusy || solMotivoRech.trim().length < 5}
              onClick={async () => {
                setSolError(null); setSolBusy(true);
                try {
                  await rechazarReactivacion(solSel.id, solMotivoRech.trim());
                  setShowRechazarSol(false); setSolSel(null);
                  setAccionMsg({ tipo: "ok", texto: "Solicitud rechazada." });
                  setTimeout(() => setAccionMsg(null), 4000);
                  await reloadSolicitudes();
                } catch (e) { setSolError((e as Error).message); } finally { setSolBusy(false); }
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#B42318" }}
            >{solBusy ? "Rechazando…" : "Confirmar rechazo"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReactivacionesPanel({
  tab, setTab, solicitudes, loading, onAprobar, onRechazar,
}: {
  tab: EstadoReactivacion | "todos";
  setTab: (t: EstadoReactivacion | "todos") => void;
  solicitudes: SolicitudReactivacion[];
  loading: boolean;
  onAprobar: (s: SolicitudReactivacion) => void;
  onRechazar: (s: SolicitudReactivacion) => void;
}) {
  const tabs: Array<{ v: EstadoReactivacion | "todos"; label: string }> = [
    { v: "PENDIENTE", label: "Pendientes" },
    { v: "APROBADA", label: "Aprobadas" },
    { v: "RECHAZADA", label: "Rechazadas" },
    { v: "todos", label: "Todas" },
  ];
  const estBadge: Record<EstadoReactivacion, { bg: string; fg: string }> = {
    PENDIENTE: { bg: "#FEF3C7", fg: "#92400E" },
    APROBADA: { bg: "#EAF7EE", fg: "#1F6D3D" },
    RECHAZADA: { bg: "#FDECEC", fg: "#B42318" },
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border"
            style={tab === t.v
              ? { background: `linear-gradient(135deg,${AZUL},${VERDE})`, color: "#fff", borderColor: AZUL }
              : { background: "#fff", color: NEGRO, borderColor: "#E3E7EE" }}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--nuvia-text-secondary)]">Cargando solicitudes…</div>
      ) : solicitudes.length === 0 ? (
        <Card><div className="py-10 text-center text-sm text-[var(--nuvia-text-secondary)]">No hay solicitudes en este estado.</div></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] text-left border-b border-[var(--nuvia-border)]">
                  <th className="py-2">Nombre</th>
                  <th>Correo</th>
                  <th>Rol actual</th>
                  <th>Rol solicitado</th>
                  <th>Fecha solicitud</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--nuvia-border)] last:border-0 align-top">
                    <td className="py-3 pr-2">{s.nombre || "—"}</td>
                    <td className="py-3 pr-2 text-[var(--nuvia-text-primary)]/75">{s.correo}</td>
                    <td className="py-3 pr-2 text-xs">{roleLabel(s.rol_actual)}</td>
                    <td className="py-3 pr-2 text-xs">{roleLabel(s.rol_solicitado)}</td>
                    <td className="py-3 pr-2 text-xs text-[var(--nuvia-text-secondary)]">{new Date(s.fecha_solicitud).toLocaleString("es-CO")}</td>
                    <td className="py-3 pr-2">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: estBadge[s.estado].bg, color: estBadge[s.estado].fg }}>{s.estado}</span>
                    </td>
                    <td className="py-3 text-right">
                      {s.estado === "PENDIENTE" ? (
                        <div className="inline-flex gap-1">
                          <button onClick={() => onAprobar(s)} className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: VERDE }}>Reactivar</button>
                          <button onClick={() => onRechazar(s)} className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: "#B42318" }}>Rechazar</button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--nuvia-text-primary)]/55">
                          {s.fecha_aprobacion ? new Date(s.fecha_aprobacion).toLocaleDateString("es-CO") : "—"}
                        </span>
                      )}
                      {s.observacion_admin && (
                        <div className="mt-1 text-[10px] text-[var(--nuvia-text-secondary)] italic max-w-[200px] truncate" title={s.observacion_admin}>{s.observacion_admin}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}


function Stat({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--nuvia-border)] bg-[var(--nuvia-bg-card)] px-2.5 py-2 flex items-center justify-between">
      <span className="text-[11px] text-[var(--nuvia-text-secondary)]">{label}</span>
      <span className="text-sm font-bold" style={{ color: muted ? "#6B7280" : "#242424" }}>{v}</span>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-[var(--nuvia-bg-card)] p-6 shadow-2xl my-8`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: NEGRO }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
