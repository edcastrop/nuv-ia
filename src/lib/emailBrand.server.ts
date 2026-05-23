// Wrapper HTML institucional NUVEX para correos transaccionales.
// Server-only (lo usan server fns y server routes).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type BrandRow = {
  nombre_comercial: string;
  tagline: string;
  sitio_web: string;
  correo_juridica: string;
  correo_contratacion: string;
  direccion_bucaramanga: string;
  direccion_bogota: string;
  color_azul: string;
  color_verde: string;
  color_negro: string;
  logo_url: string;
};

const DEFAULTS: BrandRow = {
  nombre_comercial: "NUVEX Finanzas Inteligentes",
  tagline: "Finanzas Inteligentes",
  sitio_web: "www.nuvex.com.co",
  correo_juridica: "juridica@nuvex.com.co",
  correo_contratacion: "contratacion@nuvex.com.co",
  direccion_bucaramanga: "Carrera 16 # 37-48 Piso 4, Centro de Bucaramanga",
  direccion_bogota: "Calle 93 # 18-28 Oficina 704",
  color_azul: "#445DA3",
  color_verde: "#84B98F",
  color_negro: "#242424",
  logo_url: "https://sistema-nuvex.lovable.app/logo-nuvex.png",
};

let cache: { value: BrandRow; expires: number } | null = null;

export async function getBrand(): Promise<BrandRow> {
  if (cache && cache.expires > Date.now()) return cache.value;
  try {
    const { data } = await supabaseAdmin
      .from("brand_config" as never)
      .select("*")
      .maybeSingle();
    const value = { ...DEFAULTS, ...((data ?? {}) as Partial<BrandRow>) };
    cache = { value, expires: Date.now() + 60_000 };
    return value;
  } catch {
    return DEFAULTS;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Envuelve un cuerpo de texto plano (o HTML simple) en un layout institucional NUVEX.
 * Si `textBody` viene en texto plano, se convierten los saltos de línea a <br>.
 */
export async function wrapNuvexEmail(opts: {
  subject: string;
  bodyText: string;
}): Promise<string> {
  const b = await getBrand();
  const html = escapeHtml(opts.bodyText).replace(/\n/g, "<br>");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${b.color_negro};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px -12px rgba(36,36,36,0.18);">
        <tr><td style="padding:28px 32px 20px;border-bottom:3px solid ${b.color_azul};">
          <img src="${b.logo_url}" alt="${escapeHtml(b.nombre_comercial)}" height="44" style="display:block;height:44px;width:auto;border:0;outline:none;text-decoration:none;">
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:14px;line-height:1.65;color:${b.color_negro};">
          ${html}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #e8ecf3;background:#fafbfc;font-size:11px;color:#6b7280;line-height:1.55;">
          <div style="font-weight:600;color:${b.color_azul};margin-bottom:6px;">${escapeHtml(b.nombre_comercial)}</div>
          <div>${escapeHtml(b.direccion_bucaramanga)}</div>
          <div>${escapeHtml(b.direccion_bogota)}</div>
          <div style="margin-top:6px;">
            <a href="mailto:${b.correo_juridica}" style="color:${b.color_azul};text-decoration:none;">${escapeHtml(b.correo_juridica)}</a>
            &nbsp;·&nbsp;
            <a href="mailto:${b.correo_contratacion}" style="color:${b.color_azul};text-decoration:none;">${escapeHtml(b.correo_contratacion)}</a>
            &nbsp;·&nbsp;
            <a href="https://${b.sitio_web}" style="color:${b.color_azul};text-decoration:none;">${escapeHtml(b.sitio_web)}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
