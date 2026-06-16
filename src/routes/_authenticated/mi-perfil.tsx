import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card, TextField, SelectField } from "@/components/nuvex/ui";
import { CityField } from "@/components/ui/CityField";
import { cityDepartment } from "@/lib/colombiaCities";
import { UserAvatar, clearAvatarCache } from "@/components/nuvex/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, canManageFinanzas } from "@/hooks/useUserRole";
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  deleteAvatar,
  getProfileAuditoria,
  profileSchema,
  MAX_AVATAR_BYTES,
  AVATAR_MIME,
  type ProfileRow,
  type ProfileAuditoriaRow,
} from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Trash2, Save, Loader2, Shield, GraduationCap, History, Briefcase, CircleDollarSign, User as UserIcon, Phone, Award, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useNivelAutonomia } from "@/hooks/useNivelAutonomia";
import { etiquetaNivel, calcularNivelAutonomia, type MetricasAnalista, type NivelAutonomia } from "@/lib/autonomia";
import { TotpEnrollmentSection } from "@/components/seguridad/TotpEnrollmentSection";
import { PresenciaPrivacidadSection } from "@/components/seguridad/PresenciaPrivacidadSection";
import { NotificacionesPrefsSection } from "@/components/seguridad/NotificacionesPrefsSection";
import { roleLabel, roleLabels } from "@/lib/roleLabels";

export const Route = createFileRoute("/_authenticated/mi-perfil")({
  component: MiPerfilPage,
  head: () => ({ meta: [{ title: "Mi Perfil · NUVEX" }] }),
});

interface AcademiaResumen {
  cursos: number;
  certificaciones: number;
  avance: number;
  ultimo: string | null;
}

function MiPerfilPage() {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const { metricas: metricasAutonomia, loading: loadingAutonomia } = useNivelAutonomia();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState<Partial<ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aud, setAud] = useState<ProfileAuditoriaRow[]>([]);
  const [academia, setAcademia] = useState<AcademiaResumen>({ cursos: 0, certificaciones: 0, avance: 0, ultimo: null });
  const [coordinadorNombre, setCoordinadorNombre] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const verFinanzas = true; // dueño siempre ve sus propios datos
  const editFinanzas = true; // dueño siempre puede editar sus propios datos financieros

  const reload = async () => {
    setLoading(true);
    const p = await getMyProfile();
    setProfile(p);
    setForm(p ?? {});
    if (p) {
      setCoordinadorNombre(null);
      if (p.coordinador_id) {
        const { data: coord } = await supabase
          .from("profiles" as never)
          .select("nombre,email")
          .eq("id", p.coordinador_id)
          .maybeSingle();
        const c = coord as unknown as { nombre: string | null; email: string | null } | null;
        setCoordinadorNombre(c?.nombre || c?.email || null);
      }
      const [a, cursos, certs, prog] = await Promise.all([
        getProfileAuditoria(p.id, 30),
        supabase.from("academia_cursos" as never).select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("academia_certificaciones" as never).select("id", { count: "exact", head: true }).eq("user_id", p.id),
        supabase
          .from("academia_progreso_lecciones" as never)
          .select("completada_at")
          .eq("user_id", p.id)
          .order("completada_at", { ascending: false })
          .limit(1),
      ]);
      setAud(a);
      // % avance simple: lecciones completas / total lecciones del rol
      const { count: leccionesCompletas } = await supabase
        .from("academia_progreso_lecciones" as never)
        .select("leccion_id", { count: "exact", head: true })
        .eq("user_id", p.id)
        .eq("completada", true);
      const { count: leccionesTotal } = await supabase
        .from("academia_lecciones" as never)
        .select("id", { count: "exact", head: true })
        .eq("activo", true);
      const avance = leccionesTotal && leccionesTotal > 0
        ? Math.round(((leccionesCompletas ?? 0) / leccionesTotal) * 100)
        : 0;
      const ultRow = (prog.data ?? []) as Array<{ completada_at: string | null }>;
      setAcademia({
        cursos: cursos.count ?? 0,
        certificaciones: certs.count ?? 0,
        avance: Math.min(100, avance),
        ultimo: ultRow[0]?.completada_at ?? null,
      });
    }
    setLoading(false);
  };

  useEffect(() => { if (user) void reload(); }, [user]);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!AVATAR_MIME.includes(f.type)) { toast.error("Formato no permitido"); return; }
    if (f.size > MAX_AVATAR_BYTES) { toast.error("Imagen mayor a 5 MB"); return; }
    setUploading(true);
    try {
      await uploadAvatar(f);
      clearAvatarCache(profile?.id);
      toast.success("Foto actualizada");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onDeletePhoto = async () => {
    if (!confirm("¿Eliminar tu foto de perfil?")) return;
    setUploading(true);
    try {
      await deleteAvatar();
      clearAvatarCache(profile?.id);
      toast.success("Foto eliminada");
      await reload();
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    const parsed = profileSchema.safeParse({
      nombre: form.nombre ?? profile.nombre ?? "",
      tipo_documento: form.tipo_documento ?? null,
      numero_documento: form.numero_documento ?? null,
      pais: form.pais ?? null,
      departamento: form.departamento ?? null,
      ciudad: form.ciudad ?? null,
      direccion: form.direccion ?? null,
      celular: form.celular ?? null,
      whatsapp: form.whatsapp ?? null,
      email: form.email ?? null,
      correo_corporativo: form.correo_corporativo ?? null,
    });
    if (!parsed.success) {
      toast.error("Revisa los campos: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<ProfileRow> = {
        nombre: form.nombre ?? null,
        tipo_documento: form.tipo_documento ?? null,
        numero_documento: form.numero_documento ?? null,
        pais: form.pais ?? null,
        departamento: form.departamento ?? null,
        ciudad: form.ciudad ?? null,
        direccion: form.direccion ?? null,
        celular: form.celular || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        correo_corporativo: form.correo_corporativo || null,
      };
      if (editFinanzas) {
        payload.porcentaje_comision = form.porcentaje_comision ?? null;
        payload.banco = form.banco ?? null;
        payload.tipo_cuenta = form.tipo_cuenta ?? null;
        payload.numero_cuenta = form.numero_cuenta ?? null;
        payload.titular_cuenta = form.titular_cuenta ?? null;
      }
      const completo = Boolean(
        (payload.nombre ?? "").toString().trim() &&
        (payload.celular ?? "").toString().trim() &&
        (payload.ciudad ?? "").toString().trim() &&
        (payload.pais ?? "").toString().trim()
      );
      if (completo) {
        (payload as Partial<ProfileRow> & { perfil_completo?: boolean }).perfil_completo = true;
      }
      await updateMyProfile(payload);
      toast.success("Perfil actualizado");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const upd = <K extends keyof ProfileRow>(k: K, v: ProfileRow[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) {
    return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando perfil…</div>;
  }
  if (!profile) {
    return <div className="p-12 text-center text-sm text-[#B42318]">No se pudo cargar tu perfil.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 space-y-5">
      {/* NUVIA branded hero (light) */}
      <div
        className="relative overflow-hidden rounded-2xl border px-6 py-5"
        style={{
          background: "linear-gradient(135deg, rgba(68,93,163,0.06), rgba(132,185,143,0.06))",
          borderColor: "#E3E7EE",
        }}
      >
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
          style={{ background: "linear-gradient(180deg, #445DA3, #84B98F)" }}
        />
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5"
              style={{ background: "rgba(68,93,163,0.10)", color: "#445DA3", border: "1px solid rgba(68,93,163,0.25)" }}
            >
              Perfil personal NUVIA
            </div>
            <h1 className="text-2xl font-semibold text-[#0A1226]">Mi Perfil</h1>
            <div className="text-sm text-[#242424]/60">Gestiona tu información personal, contacto y foto de perfil</div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60 shrink-0"
            style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar cambios
          </button>
        </div>
      </div>


      {/* Foto */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <UserAvatar
            url={profile.avatar_url}
            name={profile.nombre}
            email={profile.email}
            size="xl"
            ring
          />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div className="text-lg font-semibold text-[#242424]">{profile.nombre || "Sin nombre"}</div>
            <div className="text-sm text-[#242424]/70">{profile.email}</div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
              {roles.map((r) => (
                <span key={r} className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: "#EAF1FF", color: "#445DA3", border: "1px solid #C9D7F1" }}>{roleLabel(r, true)}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="hidden" />
            <button onClick={onPickFile} disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm font-medium text-[#242424] hover:bg-[#F7F9FB]">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {profile.avatar_url ? "Reemplazar foto" : "Subir foto"}
            </button>
            {profile.avatar_url && (
              <button onClick={onDeletePhoto} disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-[#F5C2C2] bg-white px-3 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FDECEC]">
                <Trash2 size={14} /> Eliminar
              </button>
            )}
            <div className="text-[10px] text-[#242424]/50 text-right">JPG/PNG/WEBP · máx. 5 MB</div>
          </div>
        </div>
      </Card>

      {/* Datos personales */}
      <Section icon={<UserIcon size={14} />} title="Datos personales">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Nombre completo *" value={form.nombre ?? ""} onChange={(v) => upd("nombre", v)} />
          <SelectField label="Tipo documento" value={form.tipo_documento ?? ""} onChange={(v) => upd("tipo_documento", v)} options={["CC","CE","PA","NIT","TI"]} />
          <TextField label="Número documento" value={form.numero_documento ?? ""} onChange={(v) => upd("numero_documento", v)} />
          <TextField label="País *" value={form.pais ?? ""} onChange={(v) => upd("pais", v)} />
          <TextField label="Departamento *" value={form.departamento ?? ""} onChange={(v) => upd("departamento", v)} hint="Se completa automáticamente al elegir la ciudad" />
          <CityField
            label="Ciudad *"
            value={form.ciudad ?? ""}
            onChange={(v) => {
              const dep = cityDepartment(v);
              setForm((prev) => ({ ...prev, ciudad: v, ...(dep ? { departamento: dep } : {}) }));
            }}
            required
          />
          <TextField label="Dirección" value={form.direccion ?? ""} onChange={(v) => upd("direccion", v)} className="sm:col-span-2" />
        </div>
      </Section>

      {/* Contacto */}
      <Section icon={<Phone size={14} />} title="Contacto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Celular *" value={form.celular ?? ""} onChange={(v) => upd("celular", v)} placeholder="+57..." />
          <TextField label="WhatsApp *" value={form.whatsapp ?? ""} onChange={(v) => upd("whatsapp", v)} placeholder="+57..." />
          <TextField label="Correo electrónico *" value={form.email ?? ""} onChange={(v) => upd("email", v)} />
          <TextField label="Correo corporativo" value={form.correo_corporativo ?? ""} onChange={(v) => upd("correo_corporativo", v)} />
        </div>
      </Section>

      {/* Organizacional */}
      <Section icon={<Briefcase size={14} />} title="Información organizacional">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <ReadOnlyField label="Rol" value={roleLabels(roles.length ? roles : profile.rol_solicitado ? [profile.rol_solicitado] : [], true)} />
          <ReadOnlyField label="Estado" value={profile.activo && ["aprobado", "activo"].includes(profile.estado_acceso ?? "") ? "Activo" : "Inactivo"} />
          <ReadOnlyField label="Fecha ingreso" value={formatDate(profile.fecha_ingreso ?? profile.aprobado_at ?? profile.created_at)} />
          <ReadOnlyField label="Coordinador" value={coordinadorNombre || "Sin coordinador asignado"} />
          <ReadOnlyField label="Equipo" value={profile.equipo || profile.equipo_registro || "Sin equipo asignado"} />
          <ReadOnlyField label="Sede" value={profile.sede || profile.ciudad || profile.ciudad_registro || "Sin sede asignada"} />
        </div>
        <div className="mt-3 text-[11px] text-[#242424]/60">
          Estos campos los administra Gerencia o Super Admin desde el módulo de Usuarios.
        </div>
      </Section>

      {/* Financiero */}
      {verFinanzas && (
        <Section icon={<CircleDollarSign size={14} />} title="Información financiera" badge={editFinanzas ? undefined : "Solo lectura"}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="% Comisión" value={form.porcentaje_comision != null ? String(form.porcentaje_comision) : ""}
              onChange={(v) => upd("porcentaje_comision", v === "" ? null : Number(v))} readOnly={!editFinanzas} />
            <TextField label="Banco" value={form.banco ?? ""} onChange={(v) => upd("banco", v)} readOnly={!editFinanzas} />
            <SelectField label="Tipo cuenta" value={form.tipo_cuenta ?? ""} onChange={(v) => upd("tipo_cuenta", v)} options={["Ahorros","Corriente"]} />
            <TextField label="Número cuenta" value={form.numero_cuenta ?? ""} onChange={(v) => upd("numero_cuenta", v)} readOnly={!editFinanzas} />
            <TextField label="Titular cuenta" value={form.titular_cuenta ?? ""} onChange={(v) => upd("titular_cuenta", v)} readOnly={!editFinanzas} className="sm:col-span-2" />
          </div>
        </Section>
      )}

      {/* Académico */}
      <Section icon={<GraduationCap size={14} />} title="Información académica">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Cursos asignados" value={academia.cursos} />
          <Stat label="Certificaciones" value={academia.certificaciones} />
          <Stat label="% Avance global" value={`${academia.avance}%`} />
          <Stat label="Último acceso" value={academia.ultimo ? new Date(academia.ultimo).toLocaleDateString("es-CO") : "—"} />
        </div>
      </Section>

      {/* Licencia de Autonomía NUVEX */}
      <Section icon={<Award size={14} />} title="Licencia de Autonomía NUVEX" badge={loadingAutonomia ? "Cargando…" : undefined}>
        {loadingAutonomia ? (
          <div className="text-sm text-[#242424]/60">Cargando métricas de calidad…</div>
        ) : (
          <div className="space-y-4">
            {/* Badge de nivel + semáforo */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div
                className="rounded-xl px-4 py-3 text-center min-w-[140px]"
                style={{
                  background:
                    metricasAutonomia.nivelAutonomia === 3
                      ? "linear-gradient(135deg, #EAF7EE, #D4EDDA)"
                      : metricasAutonomia.nivelAutonomia === 2
                        ? "linear-gradient(135deg, #FFF8E1, #FFECB3)"
                        : "linear-gradient(135deg, #FFF3E0, #FFE0B2)",
                  border:
                    metricasAutonomia.nivelAutonomia === 3
                      ? "1px solid #B7D8C0"
                      : metricasAutonomia.nivelAutonomia === 2
                        ? "1px solid #FFE082"
                        : "1px solid #FFCC80",
                }}
              >
                <div
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color:
                      metricasAutonomia.nivelAutonomia === 3
                        ? "#1F7A45"
                        : metricasAutonomia.nivelAutonomia === 2
                          ? "#8A6D1F"
                          : "#A35D1C",
                  }}
                >
                  Nivel {metricasAutonomia.nivelAutonomia}
                </div>
                <div
                  className="text-lg font-bold"
                  style={{
                    color:
                      metricasAutonomia.nivelAutonomia === 3
                        ? "#1F7A45"
                        : metricasAutonomia.nivelAutonomia === 2
                          ? "#8A6D1F"
                          : "#A35D1C",
                  }}
                >
                  {etiquetaNivel(metricasAutonomia.nivelAutonomia)}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#242424]/80">
                  <TrendingUp size={14} className="text-[#445DA3]" />
                  <span>
                    {metricasAutonomia.nivelAutonomia === 3
                      ? "Autonomía completa. Puedes generar propuestas sin marca de auditoría."
                      : metricasAutonomia.nivelAutonomia === 2
                        ? "Autonomía parcial. Score ≥95 genera PDF directo; 85–94 con advertencia."
                        : "Autonomía supervisada. Score ≥95 genera PDF con marca 'Pendiente Auditoría'."}
                  </span>
                </div>
                {metricasAutonomia.nivelAutonomia < 3 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#242424]/60">
                      <span>Progreso hacia Nivel {metricasAutonomia.nivelAutonomia + 1}</span>
                      <span>{progresoNivel(metricasAutonomia).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#E3E7EE] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progresoNivel(metricasAutonomia)}%`,
                          background: "linear-gradient(90deg, #445DA3, #84B98F)",
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[#242424]/50">
                      {metricasAutonomia.nivelAutonomia === 1
                        ? `Requiere ≥30 simulaciones y score promedio ≥85 (tienes ${metricasAutonomia.totalSimulaciones} sims · score ${metricasAutonomia.scorePromedio.toFixed(1)})`
                        : `Requiere ≥100 simulaciones y score promedio ≥95 (tienes ${metricasAutonomia.totalSimulaciones} sims · score ${metricasAutonomia.scorePromedio.toFixed(1)})`}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Score promedio" value={metricasAutonomia.scorePromedio.toFixed(1)} />
              <Stat label="Simulaciones" value={metricasAutonomia.totalSimulaciones} />
              <Stat label="Precisión histórica" value={`${metricasAutonomia.precisionHistorica.toFixed(1)}%`} />
              <Stat label="Estado PDF" value={estadoPdfLabel(metricasAutonomia)} />
            </div>
          </div>
        )}
      </Section>

      {/* Auditoría */}
      <Section icon={<History size={14} />} title="Historial de cambios">
        {aud.length === 0 ? (
          <div className="text-sm text-[#242424]/60">Sin eventos aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#242424]/60">
                  <th className="text-left py-2">Acción</th>
                  <th className="text-left">Fecha</th>
                  <th className="text-left">Hora</th>
                  <th className="text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {aud.map((a) => {
                  const d = new Date(a.created_at);
                  return (
                    <tr key={a.id} className="border-t border-[#E3E7EE]">
                      <td className="py-2 pr-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ background: "#EAF7EE", color: "#1F7A45", border: "1px solid #B7D8C0" }}>
                          {a.accion}
                        </span>
                      </td>
                      <td className="py-2 pr-2">{d.toLocaleDateString("es-CO")}</td>
                      <td className="py-2 pr-2">{d.toLocaleTimeString("es-CO")}</td>
                      <td className="py-2 pr-2 text-[12px] text-[#242424]/70">
                        <code className="text-[10px]">{JSON.stringify(a.valor_nuevo ?? a.valor_anterior ?? {})}</code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <TotpEnrollmentSection />

      <PresenciaPrivacidadSection />
      <NotificacionesPrefsSection />



      <div className="flex items-center gap-2 text-[11px] text-[#242424]/50">
        <Shield size={12} /> Toda modificación queda registrada para auditoría.
      </div>
    </div>
  );
}

function Section({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white"
          style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#242424]">{title}</h2>
        {badge && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#F7F9FB] text-[#242424]/60 border border-[#E3E7EE]">{badge}</span>
        )}
      </div>
      {children}
    </Card>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-[#242424]/70 uppercase">{label}</span>
      <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] px-3 py-2.5 text-sm text-[#242424]/80">{value}</div>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CO");
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#242424]/60">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#445DA3]">{value}</div>
    </div>
  );
}

function progresoNivel(m: MetricasAnalista): number {
  if (m.nivelAutonomia === 3) return 100;
  if (m.nivelAutonomia === 2) {
    const sims = Math.min((m.totalSimulaciones / 100) * 100, 100);
    const score = Math.min((m.scorePromedio / 95) * 100, 100);
    return (sims + score) / 2;
  }
  const sims = Math.min((m.totalSimulaciones / 30) * 100, 100);
  const score = Math.min((m.scorePromedio / 85) * 100, 100);
  return (sims + score) / 2;
}

function estadoPdfLabel(m: MetricasAnalista): string {
  if (m.nivelAutonomia === 3) return "Directo";
  if (m.nivelAutonomia === 2) return m.scorePromedio >= 95 ? "Directo" : m.scorePromedio >= 85 ? "Con advertencia" : "Bloqueado";
  return m.scorePromedio >= 95 ? "Pendiente auditoría" : m.scorePromedio >= 85 ? "Requiere revisión" : "Bloqueado";
}
