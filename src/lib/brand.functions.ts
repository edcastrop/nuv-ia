import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UpdateSchema = z.object({
  nombre_comercial: z.string().min(1).max(120),
  tagline: z.string().min(1).max(120),
  sitio_web: z.string().min(1).max(120),
  correo_juridica: z.string().email().max(160),
  correo_contratacion: z.string().email().max(160),
  direccion_bucaramanga: z.string().min(1).max(240),
  direccion_bogota: z.string().min(1).max(240),
  color_azul: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  color_verde: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  color_negro: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logo_url: z.string().url().max(500),
});

export const getBrandConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("brand_config" as never)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateBrandConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("brand_config" as never)
      .update({ ...data, updated_by: userId } as never)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
