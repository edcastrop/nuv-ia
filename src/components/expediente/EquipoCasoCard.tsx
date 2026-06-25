// Equipo del caso — Asesor responsable (Analista Financiero Comercial)
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, User, UserCog, ArrowRightLeft } from "lucide-react";
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
  onChange?: (field: "asesor_id", newId: string | null) => void;
}

export function EquipoCasoCard({ expedienteId, asesorId, onChange }: Props) {
  const { roles } = useUserRole();
  const canEdit = isManager(roles);

  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [rolesByUserId, setRolesByUserId] = useState<Record<string, AppRole[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAsesor, setLocalAsesor] = useState<string | null>(asesorId ?? null);

  useEffect(() => setLocalAsesor(asesorId ?? null), [asesorId]);

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

  // Asesor comercial = roles operativos que pueden ser responsables del caso.
  // Incluye "licenciado" porque en BD ese valor representa al Analista Financiero Comercial (rebrand).
  const asesorOpts = useMemo(
    () =>
      profiles
        .filter((p) =>
          (rolesByUserId[p.id] ?? []).some((r) =>
            ["asesor", "licenciado", "auxiliar_operativo", "gerencia", "super_admin", "admin"].includes(r),
          ),
        )
        .map((p) => ({ value: p.id, label: p.nombre || p.email || p.id.slice(0, 6) })),
    [profiles, rolesByUserId],
  );

  const asesor = localAsesor ? profiles.find((p) => p.id === localAsesor) : null;

  const handleChange = async (rawValue: string) => {
    const value = rawValue === "__none__" ? null : rawValue;
    setSaving(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("expedientes")
        .update({ asesor_id: value } as never)
        .eq("id", expedienteId);
      if (upErr) throw upErr;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("expediente_historial").insert({
        expediente_id: expedienteId,
        accion_origen: "reasignacion_equipo",
        observacion: `Asesor comercial reasignado${value ? "" : " (sin asignar)"}`,
        usuario_id: auth.user?.id ?? null,
      } as never);
      setLocalAsesor(value);
      onChange?.("asesor_id", value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <NCard variant="default">
      <SectionHeader
        title="Equipo del caso"
        description="Asesor comercial responsable de este expediente."
        icon={<UserCog size={14} />}
      />
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wide text-[var(--nuvia-text-secondary)] mb-1">
          Asesor comercial
        </div>
        {canEdit ? (
          <NSelect
            value={localAsesor ?? ""}
            onValueChange={handleChange}
            options={asesorOpts}
            placeholder={saving ? "Guardando…" : "Seleccionar asesor"}
          />
        ) : (
          <div className="text-[13px] text-[var(--nuvia-text-primary)] inline-flex items-center gap-2">
            <User size={12} /> {asesor?.nombre ?? asesor?.email ?? "Sin asignar"}
          </div>
        )}
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
