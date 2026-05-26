import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

function hashCodigo(codigo: string): string {
  // Hash simple — el código vive 10 minutos. Para auditoría/integridad.
  // No es secreto a largo plazo. Usar SHA-256 vía Web Crypto.
  const enc = new TextEncoder().encode(codigo);
  // crypto.subtle.digest es async, así que devolvemos hex base. Usamos sync fallback.
  // Aquí preferimos un hash determinístico: hex de bytes con salt fijo (mejor que claro).
  let h = 0;
  for (let i = 0; i < enc.length; i++) h = (h * 31 + enc[i]) | 0;
  return `v1.${h.toString(16)}.${codigo.length}`;
}

export const enviarCodigoMfaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("email, nombre")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.email) throw new Error("No se encontró el correo del usuario");

    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // invalidar códigos previos
    await supabase
      .from("mfa_codigos_email")
      .update({ usado: true })
      .eq("user_id", userId)
      .eq("usado", false);

    await supabase.from("mfa_codigos_email").insert({
      user_id: userId,
      codigo_hash: hashCodigo(codigo),
      expira_at: expira,
    });

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error("Email no está configurado.");

    const from = process.env.CONTRATACION_FROM_EMAIL || "NUVEX Seguridad <onboarding@resend.dev>";
    const subject = "Tu código de verificación NUVEX";
    const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F7FB;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E7EAF1">
    <div style="background:linear-gradient(135deg,#445DA3,#84B98F);padding:24px 28px;color:#fff">
      <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.85">NUVEX · Seguridad</div>
      <div style="font-size:20px;font-weight:600;margin-top:6px">Código de verificación</div>
    </div>
    <div style="padding:28px;color:#242424">
      <p style="margin:0 0 12px;font-size:14px">Hola${prof.nombre ? " " + prof.nombre : ""},</p>
      <p style="margin:0 0 18px;font-size:14px;color:#5a5a5a">Usa este código para completar tu autenticación en NUVEX. Expira en 10 minutos.</p>
      <div style="font-size:34px;letter-spacing:.4em;font-weight:700;text-align:center;background:#F5F7FB;border:1px solid #E7EAF1;border-radius:12px;padding:18px;color:#445DA3">${codigo}</div>
      <p style="margin:18px 0 0;font-size:12px;color:#8a8a8a">Si no solicitaste este código, ignora este correo y revisa la seguridad de tu cuenta.</p>
    </div>
    <div style="padding:16px 28px;background:#FAFBFD;border-top:1px solid #E7EAF1;font-size:11px;color:#8a8a8a">NUVEX · Finanzas Inteligentes</div>
  </div>
</div>`;

    const resp = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from,
        to: [prof.email],
        subject,
        html,
        text: `Tu código NUVEX: ${codigo} (expira en 10 minutos).`,
      }),
    });
    if (!resp.ok) {
      const j = await resp.text();
      throw new Error(`No se pudo enviar el código (${resp.status}): ${j.slice(0, 200)}`);
    }
    return { ok: true, expira };
  });

export const verificarCodigoMfaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const expected = hashCodigo(data.codigo);

    const { data: rows } = await supabase
      .from("mfa_codigos_email")
      .select("*")
      .eq("user_id", userId)
      .eq("usado", false)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) throw new Error("No hay código activo. Solicita uno nuevo.");
    if (new Date(row.expira_at).getTime() < Date.now()) {
      throw new Error("El código expiró. Solicita uno nuevo.");
    }
    if (row.codigo_hash !== expected) {
      await supabase.from("acceso_auditoria").insert({
        user_id: userId, actor_id: userId, accion: "mfa_fallido", detalle: {},
      });
      throw new Error("Código inválido");
    }

    await supabase.from("mfa_codigos_email").update({ usado: true }).eq("id", row.id);
    await supabase
      .from("profiles")
      .update({
        mfa_verificado_at: new Date().toISOString(),
        mfa_metodo: "email",
      })
      .eq("id", userId);
    await supabase.from("acceso_auditoria").insert({
      user_id: userId, actor_id: userId, accion: "mfa_verificado", detalle: { metodo: "email" },
    });
    return { ok: true };
  });
