// Equipo del caso — Asesor + Licenciado (auto-contenido)
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, User, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NCard, NSelect, SectionHeader } from "@/components/nuvia";
import { useUserRole, isManager, type AppRole } from "@/hooks/useUserRole";

interface ProfileLite {
  id: string;
  nombre: string | null;
  email: string | null;
}

interface Props {
  expedienteId: string;
  asesorId: string | null | undefined;
  licenciadoId: string | null | undefined;
  onChange?: (field: "asesor_id" | "licenciado_id", newId: string | null) => void;
}

export function EquipoCasoCard({ expedienteId, asesorId, licenciadoId, onChange }: Props) {
  const { role } = useUserRole();
  const canEdit = isManager(role);

  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [rolesByUserId, setRolesByUserId] = useState<Record<string, AppRole[]>>({});
  const [saving, setSaving] = useState<null | "asesor_id" | "licenciado_id">(null);
  const [error, setError] = useState<string | null>(null);
  const [localAsesor, setLocalAsesor] = useState<string | null>(asesorId ?? null);
  const [localLic, setLocalLic] = useState<string | null>(licenciadoId ?? null);

  useEffect(() => setLocalAsesor(asesorId ?? null), [asesorId]);
  useEffect(() => setLocalLic(licenciadoId ?? null), [licenciadoId]);

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,nombre,email").order("nombre"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      setProfiles((profs as ProfileLite[]) ?? []);
      const map: Record<string, AppRole[]> = {};
      ((roles as Array<{ user_id: string; role: AppRole }>) ?? []).forEach((r) => {
        (map[r.user_id] ??= []).push(r.role);
      });
      setRolesByUserId(map);
    })();
  }, []);

  const asesorOpts = useMemo(
    () =>
      profiles
        .filter((p) =>
          (rolesByUserId[p.id] ?? []).some((r) =>
            ["asesor", "auxiliar_operativo", "gerencia", "super_admin", "admin"].includes(r),
          ),
        )
        .map((p) => ({ value: p.id, label: p.nombre || p.email || p.id.slice(0, 6) })),
    [profiles, rolesByUserId],
  );

  const licenciadoOpts = useMemo(
    () =>
      [{ value: "__none__", label: "— Sin asignar —" }].concat(
        profiles
          .filter((p) => (rolesByUserId[p.id] ?? []).includes("licenciado"))
          .map((p) => ({ value: p.id, label: p.nombre || p.email || p.id.slice(0, 6) })),
      ),
    [profiles, rolesByUserId],
  );

  const asesor = localAsesor ? profiles.find((p) => p.id === localAsesor) : null;
  const licenciado = localLic ? profiles.find((p) => p.id === localLic) : null;

  const handleChange = async (field: "asesor_id" | "licenciado_id", rawValue: string) => {
    const value = rawValue === "__none__" ? null : rawValue;
    setSaving(field);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("expedientes")
        .update({ [field]: value } as never)
        .eq("id", expedienteId);
      if (upErr) throw upErr;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("expediente_historial").insert({
        expediente_id: expedienteId,
        accion_origen: "reasignacion_equipo",
        observacion: `${field === "asesor_id" ? "Asesor" : "Licenciado"} reasignado${value ? "" : " (sin asignar)"}`,
        usuario_id: auth.user?.id ?? null,
      } as never);
      if (field === "asesor_id") setLocalAsesor(value);
      else setLocalLic(value);
      onChange?.(field, value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <NCard variant="default">
      <SectionHeader
        title="Equipo del caso"
        description="Asesor responsable y licenciado asignado a este expediente."
        icon={<UserCog size={14} />}
      />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--nuvia-text-secondary)] mb-1">
            Asesor comercial
          </div>
          {canEdit ? (
            <NSelect
              value={localAsesor ?? ""}
              onValueChange={(v) => handleChange("asesor_id", v)}
              options={asesorOpts}
              placeholder={saving === "asesor_id" ? "Guardando…" : "Seleccionar asesor"}
            />
          ) : (
            <div className="text-[13px] text-[var(--nuvia-text-primary)] inline-flex items-center gap-2">
              <User size={12} /> {asesor?.nombre ?? asesor?.email ?? "Sin asignar"}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--nuvia-text-secondary)] mb-1">
            Licenciado
          </div>
          {canEdit ? (
            <NSelect
              value={localLic ?? "__none__"}
              onValueChange={(v) => handleChange("licenciado_id", v)}
              options={licenciadoOpts}
              placeholder={saving === "licenciado_id" ? "Guardando…" : "Seleccionar licenciado"}
            />
          ) : (
            <div className="text-[13px] text-[var(--nuvia-text-primary)] inline-flex items-center gap-2">
              <UserCog size={12} /> {licenciado?.nombre ?? licenciado?.email ?? "Sin asignar"}
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 text-[11px] text-rose-400 inline-flex items-center gap-1">
          <AlertTriangle size={11} /> {error}
        </div>
      )}
      {!canEdit && (
        <div className="mt-2 text-[10px] text-[var(--nuvia-text-secondary)]">
          Solo gerencia / super admin puede reasignar desde aquí.
        </div>
      )}
    </NCard>
  );
}
