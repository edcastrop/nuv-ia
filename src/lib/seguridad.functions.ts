import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendLovableEmail } from "@lovable.dev/email-js";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

// ── Cifrado AES-256-GCM para mfa_secret ─────────────────────────────────────

async function getTotpKey(): Promise<CryptoKey> {
  const raw = process.env.TOTP_ENCRYPTION_KEY ?? "";
  if (raw.length !== 64) throw new Error("TOTP_ENCRYPTION_KEY debe ser de 64 caracteres hex (32 bytes).");
  const bytes = new Uint8Array(raw.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptTotpSecret(secret: string): Promise<string> {
  const key = await getTotpKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(secret);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const cipherHex = Array.from(new Uint8Array(cipher)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `aes256gcm.v1:${ivHex}:${cipherHex}`;
}

const TOTP_SECRET_PREFIX = "aes256gcm.v1:";

function normalizeLegacyTotpSecret(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  if (raw.toLowerCase().startsWith("otpauth://")) {
    try {
      const url = new URL(raw);
      return normalizeLegacyTotpSecret(url.searchParams.get("secret"));
    } catch {
      return null;
    }
  }

  const cleaned = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z2-7]+=*$/.test(cleaned) && cleaned.replace(/=+$/g, "").length >= 16 ? cleaned : null;
}

async function readTotpSecret(stored: string): Promise<{ secret: string; legacy: boolean }> {
  if (!stored.startsWith(TOTP_SECRET_PREFIX)) {
    const legacySecret = normalizeLegacyTotpSecret(stored);
    if (legacySecret) return { secret: legacySecret, legacy: true };
    throw new Error("No pudimos leer la app autenticadora registrada. Usa Correo para verificar y vuelve a configurar App auth desde Mi Perfil.");
  }
  const [, ivHex, cipherHex] = stored.split(":");
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const cipher = new Uint8Array(cipherHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await getTotpKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  const secret = normalizeLegacyTotpSecret(new TextDecoder().decode(plain));
  if (!secret) throw new Error("No pudimos leer la app autenticadora registrada. Usa Correo para verificar y vuelve a configurar App auth desde Mi Perfil.");
  return { secret, legacy: false };
}

// ────────────────────────────────────────────────────────────────────────────

const TOTP_ISSUER = "NUVEX";

function buildTotp(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

const SENDER_DOMAIN = "notify.nuvex.com.co";
const FROM_ADDRESS = "NUVEX Seguridad <seguridad@notify.nuvex.com.co>";

async function hashCodigo(codigo: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`nuvex-mfa-v2:${userId}:${codigo}`);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `v2.${hex}`;
}

function crearTokenUnsubscribe(userId: string): string {
  return `mfa-${userId}-${crypto.randomUUID()}`;
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
      codigo_hash: await hashCodigo(codigo, userId),
      expira_at: expira,
    });

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("Email no está configurado.");

    const subject = "Tu código de verificación NUVEX";
    const text = `Tu código NUVEX: ${codigo} (expira en 10 minutos).`;
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

    try {
      await sendLovableEmail(
        {
          to: prof.email,
          from: FROM_ADDRESS,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "mfa_codigo",
          idempotency_key: `mfa-${userId}-${Date.now()}`,
          unsubscribe_token: crearTokenUnsubscribe(userId),
        },
        { apiKey: LOVABLE_API_KEY }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`No se pudo enviar el código: ${msg.slice(0, 200)}`);
    }
    return { ok: true, expira };
  });

export const verificarCodigoMfaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const expected = await hashCodigo(data.codigo, userId);

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

/* ============================================================
 * TOTP (App autenticadora: Google Authenticator / Authy / 1Password)
 * ============================================================ */

// Devuelve estado MFA del usuario
export const getEstadoMfa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("mfa_metodo, mfa_verificado_at")
      .eq("id", userId)
      .maybeSingle();
    const p = data as { mfa_metodo?: string; mfa_verificado_at?: string | null } | null;
    return {
      metodo: (p?.mfa_metodo ?? "ninguno") as "ninguno" | "email" | "totp",
      verificadoAt: p?.mfa_verificado_at ?? null,
      totpEnrolado: p?.mfa_metodo === "totp",
    };
  });

// Inicia enrolamiento TOTP: genera secret y otpauth URL + QR (data URL)
export const iniciarEnrolarTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("email, correo_corporativo").eq("id", userId).maybeSingle();
    const p = prof as { email?: string; correo_corporativo?: string | null } | null;
    const label = p?.correo_corporativo?.trim() || p?.email || userId;

    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const totp = buildTotp(secret, label);
    const otpauthUrl = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });

    // Guardamos el secret pendiente (se "activa" cuando confirme el código).
    // Reusamos columna mfa_secret; el método queda en "email" o "ninguno" hasta confirmar.
    const secretCifrado = await encryptTotpSecret(secret);
    await supabase.from("profiles").update({ mfa_secret: secretCifrado }).eq("id", userId);
    return { otpauthUrl, qrDataUrl, secret };
  });

// Confirma el primer código TOTP y marca mfa_metodo=totp
export const confirmarEnrolarTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("email, mfa_secret").eq("id", userId).maybeSingle();
    const row = prof as { email?: string; mfa_secret?: string | null } | null;
    if (!row?.mfa_secret) throw new Error("No hay enrolamiento TOTP en curso. Inicia de nuevo.");

    const storedSecret = await readTotpSecret(row.mfa_secret);
    const totp = buildTotp(storedSecret.secret, row.email ?? userId);
    const delta = totp.validate({ token: data.codigo, window: 1 });
    if (delta === null) throw new Error("Código inválido. Verifica la hora del dispositivo e intenta de nuevo.");
    const migratedSecret = storedSecret.legacy ? await encryptTotpSecret(storedSecret.secret) : null;

    await supabase
      .from("profiles")
      .update({
        mfa_metodo: "totp",
        mfa_verificado_at: new Date().toISOString(),
        ...(migratedSecret ? { mfa_secret: migratedSecret } : {}),
      })
      .eq("id", userId);
    await supabase.from("acceso_auditoria").insert({
      user_id: userId, actor_id: userId, accion: "mfa_totp_enrolado", detalle: {},
    });
    return { ok: true };
  });

// Verifica un código TOTP en el flujo de login
export const verificarCodigoTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("email, mfa_secret, mfa_metodo").eq("id", userId).maybeSingle();
    const row = prof as { email?: string; mfa_secret?: string | null; mfa_metodo?: string } | null;
    if (!row?.mfa_secret || row.mfa_metodo !== "totp") {
      throw new Error("No tienes una app autenticadora configurada. Usa el código por correo.");
    }
    const storedSecret = await readTotpSecret(row.mfa_secret);
    const totp = buildTotp(storedSecret.secret, row.email ?? userId);
    const delta = totp.validate({ token: data.codigo, window: 1 });
    if (delta === null) {
      await supabase.from("acceso_auditoria").insert({
        user_id: userId, actor_id: userId, accion: "mfa_fallido", detalle: { metodo: "totp" },
      });
      throw new Error("Código inválido");
    }
    await supabase
      .from("profiles")
      .update({
        mfa_verificado_at: new Date().toISOString(),
        ...(storedSecret.legacy ? { mfa_secret: await encryptTotpSecret(storedSecret.secret) } : {}),
      })
      .eq("id", userId);
    await supabase.from("acceso_auditoria").insert({
      user_id: userId, actor_id: userId, accion: "mfa_verificado", detalle: { metodo: "totp" },
    });
    return { ok: true };
  });

// Desactiva TOTP (vuelve a email)
export const desactivarTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ mfa_metodo: "email", mfa_secret: null })
      .eq("id", userId);
    await supabase.from("acceso_auditoria").insert({
      user_id: userId, actor_id: userId, accion: "mfa_totp_desactivado", detalle: {},
    });
    return { ok: true };
  });

