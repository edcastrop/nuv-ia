import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/nuvex/Logo";
import { ArrowRight, ShieldCheck, Lock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
  head: () => ({ meta: [{ title: "Solicitar acceso · NUVEX" }] }),
});

const ROLES_SOLICITABLES = [
  { v: "licenciado", label: "Licenciado" },
  { v: "operaciones", label: "Operaciones" },
  { v: "juridica", label: "Jurídica" },
  { v: "finanzas_tesoreria", label: "Finanzas y Tesorería" },
  { v: "contabilidad", label: "Contabilidad" },
  { v: "gerencia_comercial", label: "Gerencia Comercial" },
  { v: "super_admin", label: "Super Admin" },
];

function RegistroPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "", email: "", password: "",
    telefono: "", ciudad: "", equipo: "",
    rol_solicitado: "licenciado",
  });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (form.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nombre: form.nombre,
            telefono: form.telefono,
            ciudad: form.ciudad,
            equipo: form.equipo,
            rol_solicitado: form.rol_solicitado,
          },
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/login" : undefined,
        },
      });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="nuvex-register-shell min-h-screen px-4 py-8 sm:px-6">
        <div className="nuvex-register-success mx-auto w-full max-w-md">
          <div className="flex justify-center">
            <Logo variant="white" height={72} />
          </div>
          <section className="nuvex-register-card nuvex-register-card--success mt-8 text-center">
            <div className="nuvex-register-status-icon mx-auto mb-5">
              <ShieldCheck className="w-7 h-7" strokeWidth={2.5} />
            </div>
            <h1 className="nuvex-register-title">Solicitud enviada</h1>
            <p className="nuvex-register-copy mt-3">
              Tu cuenta quedó en <b>estado pendiente</b>. Un administrador NUVEX revisará y aprobará tu acceso.
              Recibirás una notificación cuando puedas iniciar sesión.
            </p>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="nuvex-register-submit mt-7 w-full"
            >Volver al login</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="nuvex-register-shell min-h-screen px-4 py-8 sm:px-6">
      <div className="nuvex-register-grid mx-auto grid w-full max-w-6xl items-stretch gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="nuvex-register-brand-panel">
          <Logo variant="white" height={86} />
          <div className="nuvex-register-brand-content">
            <div className="nuvex-register-kicker">
              <Sparkles className="h-4 w-4" strokeWidth={2.2} />
              Acceso corporativo NUVEX
            </div>
            <h1 className="nuvex-register-hero-title">Crear cuenta NUVEX</h1>
            <p className="nuvex-register-hero-copy">
              Solicita ingreso a la plataforma financiera y operativa. Tu perfil será validado por administración antes de activar el acceso.
            </p>
          </div>
          <div className="nuvex-register-trust-row">
            <span>Validación administrativa</span>
            <span>Cuenta protegida</span>
          </div>
        </aside>

        <section className="nuvex-register-card">
          <div className="nuvex-register-card-header">
            <div>
              <div className="nuvex-register-badge">
                <span />
                Solicitud de acceso
              </div>
              <h2 className="nuvex-register-title mt-4">Completa tus datos</h2>
              <p className="nuvex-register-copy mt-2">
                Conservamos el flujo actual de registro: la cuenta queda pendiente hasta aprobación interna.
              </p>
            </div>
            <div className="nuvex-register-lock-mark" aria-hidden="true">
              <Lock className="h-5 w-5" strokeWidth={2.3} />
            </div>
          </div>

          <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Nombre completo *">
              <Input value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
            </Field>
            <Field label="Correo corporativo *">
              <Input type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            </Field>
            <Field label="Contraseña *">
              <Input type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
            </Field>
            <Field label="Teléfono / WhatsApp *">
              <Input value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} required placeholder="+57 …" />
            </Field>
            <Field label="Ciudad *">
              <Input value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} required />
            </Field>
            <Field label="Equipo / Sede">
              <Input value={form.equipo} onChange={(v) => setForm({ ...form, equipo: v })} placeholder="Ej. Bogotá Norte" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Rol solicitado *">
                <select
                  value={form.rol_solicitado}
                  onChange={(e) => setForm({ ...form, rol_solicitado: e.target.value })}
                  className="nuvex-register-control nuvex-register-select"
                >
                  {ROLES_SOLICITABLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            {err && (
              <div className="nuvex-register-error sm:col-span-2">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="nuvex-register-submit sm:col-span-2"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Enviando…
                </span>
              ) : (
                <>
                  <Lock className="w-4 h-4" strokeWidth={2.5} />
                  Solicitar acceso
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <div className="nuvex-register-note">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" strokeWidth={2.4} />
            <span>
              Tu solicitud será revisada por el equipo administrador de NUVEX antes de habilitar el acceso.
            </span>
          </div>

          <div className="nuvex-register-login-link">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login">Iniciar sesión</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="nuvex-register-label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      required={props.required}
      placeholder={props.placeholder}
      className="nuvex-register-control"
    />
  );
}
