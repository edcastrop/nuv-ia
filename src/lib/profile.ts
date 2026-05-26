import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export interface ProfileRow {
  id: string;
  nombre: string | null;
  email: string | null;
  activo: boolean;
  tipo_documento: string | null;
  numero_documento: string | null;
  pais: string | null;
  departamento: string | null;
  ciudad: string | null;
  direccion: string | null;
  celular: string | null;
  whatsapp: string | null;
  correo_corporativo: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  fecha_ingreso: string | null;
  coordinador_id: string | null;
  equipo: string | null;
  sede: string | null;
  porcentaje_comision: number | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  titular_cuenta: string | null;
  created_at: string;
  updated_at: string;
}

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"];

export const profileSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  tipo_documento: z.string().max(10).nullable().optional(),
  numero_documento: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/).nullable().optional(),
  pais: z.string().trim().max(80).nullable().optional(),
  departamento: z.string().trim().max(80).nullable().optional(),
  ciudad: z.string().trim().max(80).nullable().optional(),
  direccion: z.string().trim().max(180).nullable().optional(),
  celular: z.string().trim().regex(/^\+?\d{7,15}$/).nullable().optional().or(z.literal("")),
  whatsapp: z.string().trim().regex(/^\+?\d{7,15}$/).nullable().optional().or(z.literal("")),
  email: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
  correo_corporativo: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
});

export type ProfileUpdate = Partial<ProfileRow>;

export async function getMyProfile(): Promise<ProfileRow | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("profiles" as never)
    .select("*")
    .eq("id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProfileRow) ?? null;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles" as never)
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProfileRow) ?? null;
}

export async function updateMyProfile(payload: ProfileUpdate): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const { error } = await supabase
    .from("profiles" as never)
    .update(payload as never)
    .eq("id", u.user.id);
  if (error) throw error;
}

export async function updateProfileById(userId: string, payload: ProfileUpdate): Promise<void> {
  const { error } = await supabase
    .from("profiles" as never)
    .update(payload as never)
    .eq("id", userId);
  if (error) throw error;
}

export async function uploadAvatar(file: File): Promise<{ url: string; path: string }> {
  if (!AVATAR_MIME.includes(file.type)) throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("La imagen supera los 5 MB.");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${u.user.id}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl;
  await updateMyProfile({ avatar_url: url, avatar_path: path });
  return { url, path };
}

export async function deleteAvatar(): Promise<void> {
  const me = await getMyProfile();
  if (!me) return;
  if (me.avatar_path) {
    await supabase.storage.from("avatars").remove([me.avatar_path]);
  }
  await updateMyProfile({ avatar_url: null, avatar_path: null });
}

export interface ProfileAuditoriaRow {
  id: string;
  profile_id: string;
  actor_id: string | null;
  accion: string;
  valor_anterior: unknown;
  valor_nuevo: unknown;
  created_at: string;
}

export async function getProfileAuditoria(profileId: string, limit = 50): Promise<ProfileAuditoriaRow[]> {
  const { data, error } = await supabase
    .from("profile_auditoria" as never)
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ProfileAuditoriaRow[];
}

export function initialsOf(name?: string | null, email?: string | null): string {
  const base = (name || email?.split("@")[0] || "NV").trim();
  return (
    base
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "NV"
  );
}
