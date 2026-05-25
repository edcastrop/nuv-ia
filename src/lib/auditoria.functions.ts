import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Genera una URL firmada de descarga para un comprobante de cartera.
export const obtenerUrlComprobante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      path: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: signedData, error } = await supabaseAdmin.storage
      .from("cartera-comprobantes")
      .createSignedUrl(data.path, 300); // 5 minutos
    if (error) throw new Error("No se pudo generar URL del comprobante: " + error.message);
    return { url: signedData.signedUrl };
  });
