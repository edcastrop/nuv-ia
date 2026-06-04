import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/nuvex/ui";

const BUCKET = "soportes-banco";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

interface Props {
  expedienteId: string;
  estadoCaso?: string | null;
  allowUploadForQA?: boolean;
}

interface Soporte {
  id: string;
  archivo_nombre: string;
  archivo_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  estado_relacionado: string | null;
  subcategoria: string;
  created_at: string;
  user_id: string | null;
  user_nombre?: string | null;
}

const APROBADO_STATES = new Set(["aprobado", "aprobado_banco"]);

export function SoportesBanco({ expedienteId, estadoCaso, allowUploadForQA = false }: Props) {
  const [items, setItems] = useState<Soporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showUploader = allowUploadForQA || APROBADO_STATES.has(String(estadoCaso ?? ""));
  const aprobacionItems = items.filter((i) => i.subcategoria === "aprobacion_banco");
  const sinSoporte = showUploader && aprobacionItems.length === 0;

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expediente_soportes" as never)
      .select("*")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false });
    if (error) {
      setErr(error.message);
      setItems([]);
    } else {
      const rows = (data ?? []) as unknown as Soporte[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
        const map = new Map<string, string>();
        (profs ?? []).forEach((p) => map.set(p.id, p.nombre || p.email || "—"));
        setItems(rows.map((r) => ({ ...r, user_nombre: r.user_id ? map.get(r.user_id) ?? null : null })));
      } else {
        setItems(rows);
      }
      setErr(null);
    }
    setLoading(false);
  }, [expedienteId]);

  useEffect(() => { reload(); }, [reload]);

  const handleUpload = async (file: File) => {
    setErr(null);
    if (!ACCEPTED.includes(file.type)) {
      setErr("Formato no permitido. Solo PNG, JPG, JPEG o PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("El archivo supera 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${expedienteId}/aprobacion_banco/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { error: insErr } = await supabase.from("expediente_soportes" as never).insert({
        expediente_id: expedienteId,
        categoria: "soportes_banco",
        subcategoria: "aprobacion_banco",
        archivo_nombre: file.name,
        archivo_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        estado_relacionado: "aprobado_banco",
        user_id: userId,
      } as never);
      if (insErr) throw insErr;

      await supabase.from("expediente_historial").insert({
        expediente_id: expedienteId,
        accion_origen: "soporte_aprobacion_banco",
        observacion: `Soporte de aprobación banco cargado: ${file.name}`,
        user_id: userId,
      } as never);

      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleView = async (s: Soporte) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(s.archivo_path, 60 * 5);
    if (error) { alert(error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (s: Soporte) => {
    if (!confirm(`¿Eliminar el soporte "${s.archivo_nombre}"?`)) return;
    await supabase.storage.from(BUCKET).remove([s.archivo_path]);
    await supabase.from("expediente_soportes" as never).delete().eq("id", s.id);
    await reload();
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#242424]/60">Soportes del Banco</div>
          <h3 className="text-base font-semibold text-[#242424]">Aprobación banco</h3>
          <p className="mt-1 text-xs text-[#242424]/65 max-w-xl">
            Adjunta aquí la captura del correo, PDF o evidencia enviada por el banco. Este
            soporte no es obligatorio por ahora, pero se recomienda cargarlo para dejar
            trazabilidad del expediente.
          </p>
        </div>
        {showUploader && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "#445DA3" }}
            >
              {uploading ? "Subiendo…" : aprobacionItems.length > 0 ? "Agregar otro soporte" : "Adjuntar soporte"}
            </button>
          </div>
        )}
      </div>

      {sinSoporte && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs"
          style={{ background: "#FFF7E6", borderColor: "#F0B429", color: "#8A5A00" }}
        >
          ⚠ Estado aprobado sin soporte adjunto.
        </div>
      )}

      {err && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs"
          style={{ background: "#FDECEC", borderColor: "#F5C2C2", color: "#B42318" }}
        >
          {err}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="text-xs text-[#242424]/60">Cargando soportes…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-[#242424]/60">Aún no hay soportes cargados.</div>
        ) : (
          <div className="divide-y divide-[#E3E7EE] rounded-lg border border-[#E3E7EE] bg-white">
            {items.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#242424] truncate">{s.archivo_nombre}</div>
                  <div className="text-[10px] text-[#242424]/60">
                    {new Date(s.created_at).toLocaleString()}
                    {s.user_nombre ? ` · ${s.user_nombre}` : ""}
                    {s.estado_relacionado ? ` · ${s.estado_relacionado}` : ""}
                    {s.size_bytes ? ` · ${(s.size_bytes / 1024).toFixed(0)} KB` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleView(s)}
                    className="rounded-md border border-[#E3E7EE] bg-white px-2.5 py-1 text-[11px] font-medium hover:border-[#445DA3]/40"
                  >Ver</button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="rounded-md border px-2.5 py-1 text-[11px] font-medium"
                    style={{ borderColor: "#F5C2C2", color: "#B42318", background: "#FDECEC" }}
                  >Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
