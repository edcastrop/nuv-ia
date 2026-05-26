import { supabase } from "@/integrations/supabase/client";

const BUCKET = "academia-material";

export async function subirMaterialAcademia(file: File, carpeta: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).createSignedUrl
    ? await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5)
    : { data: null };
  return data?.signedUrl ?? path;
}

export function detectarProveedorVideo(url: string): "youtube" | "vimeo" | "loom" | "drive" | "otro" {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("loom.com")) return "loom";
  if (u.includes("drive.google.com")) return "drive";
  return "otro";
}

export function urlEmbedVideo(url: string): string {
  const p = detectarProveedorVideo(url);
  try {
    if (p === "youtube") {
      const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (p === "vimeo") {
      const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
    if (p === "loom") {
      const m = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/);
      if (m) return `https://www.loom.com/embed/${m[1]}`;
    }
    if (p === "drive") {
      const m = url.match(/\/d\/([\w-]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
  } catch { /* noop */ }
  return url;
}
