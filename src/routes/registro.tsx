import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoNuvex from "@/assets/logo-nuvex.png";
import {
  ArrowRight, ShieldCheck, Lock, User, Mail, Phone, MapPin, Building2,
  UserCog, Eye, EyeOff, Sparkles, Zap, CheckCircle2, MapPinned, PhoneCall, Globe, KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
  head: () => ({ meta: [{ title: "Solicitar acceso · NUVEX" }] }),
});

const ROLES_SOLICITABLES = [
  { v: "licenciado", label: "Licenciado" },
  { v: "operaciones", label: "Operaciones" },
  { v: "juridica", label: "Jurídica" },
  { v: "contabilidad", label: "Contabilidad" },
  { v: "director_financiero_qa", label: "Director Financiero QA" },
  { v: "apoderado", label: "Apoderado" },
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
  const [doneMode, setDoneMode] = useState<"signup" | "reactivacion">("signup");
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (form.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

      // 1) Pre-check: si el correo corresponde a un usuario DESVINCULADO,
      //    no crear cuenta nueva: generar solicitud de reactivación.
      try {
        const { data: pre, error: preErr } = await supabase.rpc(
          "solicitar_reactivacion_por_email" as never,
          {
            _email: form.email.trim(),
            _rol_solicitado: form.rol_solicitado,
            _motivo: "Reingreso solicitado desde el formulario de registro",
            _nombre: form.nombre,
          } as never
        );
        if (!preErr && pre) {
          const status = (pre as { status?: string }).status;
          if (status === "created" || status === "already_pending") {
            setDoneMode("reactivacion");
            setDone(true);
            return;
          }
          if (status === "exists_not_desvinculado") {
            throw new Error("Este correo ya está registrado en NUVEX. Inicia sesión o contacta al administrador.");
          }
        }
      } catch (preCheckErr) {
        // Si la RPC indicó conflicto, abortamos; si fue un error de red genérico, continuamos al signUp normal.
        if (preCheckErr instanceof Error && preCheckErr.message.includes("ya está registrado")) throw preCheckErr;
      }

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
      setDoneMode("signup");
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };


  if (done) {
    return (
      <main className="nuvex-register-shell">
        <div className="nuvex-register-right" style={{ minHeight: "100vh" }}>
          <section className="nuvex-register-card nuvex-register-card--success">
            <div className="nrx-status-icon mb-5"><ShieldCheck className="w-7 h-7" strokeWidth={2.5} /></div>
            <h1 className="nuvex-register-title">Solicitud enviada</h1>
            <p className="nuvex-register-copy mx-auto mt-3">
              Tu cuenta quedó en <b>estado pendiente</b>. Un administrador NUVEX revisará y aprobará tu acceso.
              Recibirás una notificación cuando puedas iniciar sesión.
            </p>
            <button onClick={() => navigate({ to: "/login" })} className="nuvex-register-submit mt-7">
              Volver al login
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="nuvex-register-shell">
      <div className="nuvex-register-grid">
        {/* ===== PANEL IZQUIERDO ===== */}
        <aside className="nuvex-register-brand-panel">
          {/* Ondas decorativas SVG */}
          <svg className="nrx-waves" viewBox="0 0 600 1000" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="nrxWaveA" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#445DA3" stopOpacity="0.0" />
                <stop offset="50%" stopColor="#445DA3" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#84B98F" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="nrxWaveB" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#84B98F" stopOpacity="0.0" />
                <stop offset="60%" stopColor="#84B98F" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#84B98F" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M 0 720 C 160 660, 300 820, 600 700 L 600 1000 L 0 1000 Z" fill="url(#nrxWaveA)" />
            <path d="M 0 820 C 200 780, 360 900, 600 820" stroke="url(#nrxWaveB)" strokeWidth="1.2" fill="none" />
            <path d="M 0 870 C 220 840, 380 940, 600 870" stroke="url(#nrxWaveB)" strokeWidth="1" fill="none" opacity="0.7" />
            <path d="M 0 920 C 240 890, 400 970, 600 920" stroke="url(#nrxWaveB)" strokeWidth="0.8" fill="none" opacity="0.5" />
          </svg>

          <img src={logoNuvex} alt="NUVEX" className="nrx-logo" style={{ filter: "brightness(0) invert(1)" }} draggable={false} />

          <div className="nuvex-register-brand-content">
            <div className="nrx-kicker">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.4} />
              Acceso corporativo NUVEX
            </div>
            <h1 className="nrx-hero-title">
              Crear
              <span className="nrx-accent">cuenta</span>
              NUVEX
            </h1>
            <p className="nrx-hero-copy">
              Solicita acceso a la plataforma financiera y operativa NUVEX. Tu perfil será validado por
              administración antes de activar el acceso.
            </p>

            <div className="nrx-benefits">
              <div className="nrx-benefit">
                <div className="nrx-benefit-icon"><ShieldCheck className="w-4 h-4" strokeWidth={2.4} /></div>
                <div>
                  <div className="nrx-benefit-title">Seguro y confiable</div>
                  <div className="nrx-benefit-copy">Tus datos protegidos bajo estándares corporativos.</div>
                </div>
              </div>
              <div className="nrx-benefit">
                <div className="nrx-benefit-icon"><CheckCircle2 className="w-4 h-4" strokeWidth={2.4} /></div>
                <div>
                  <div className="nrx-benefit-title">Validación administrativa</div>
                  <div className="nrx-benefit-copy">Cada acceso es aprobado por el equipo NUVEX.</div>
                </div>
              </div>
              <div className="nrx-benefit">
                <div className="nrx-benefit-icon"><Zap className="w-4 h-4" strokeWidth={2.4} /></div>
                <div>
                  <div className="nrx-benefit-title">Plataforma especializada</div>
                  <div className="nrx-benefit-copy">Herramientas financieras exclusivas para licenciados.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="nrx-footer">
            <span className="nrx-footer-row"><MapPinned className="w-4 h-4" strokeWidth={2.2} /> Bogotá · Bucaramanga</span>
            <span className="nrx-footer-row"><PhoneCall className="w-4 h-4" strokeWidth={2.2} /> +57 316 4023779</span>
            <span className="nrx-footer-row"><Globe className="w-4 h-4" strokeWidth={2.2} /> www.nuvex.com.co</span>
          </div>
        </aside>

        {/* ===== PANEL DERECHO ===== */}
        <section className="nuvex-register-right">
          <div className="nuvex-register-card">
            <div className="nuvex-register-card-header">
              <div>
                <div className="nrx-status-badge">Solicitud de acceso</div>
                <h2 className="nuvex-register-title">Completa tus datos</h2>
                <p className="nuvex-register-copy">
                  Conservamos el flujo actual de registro: la cuenta quedará pendiente hasta aprobación interna.
                </p>
              </div>
              <div className="nrx-lock-mark" aria-hidden="true">
                <Lock className="w-6 h-6" strokeWidth={2.3} />
              </div>
            </div>

            <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Nombre completo *" icon={<User className="w-4 h-4" />}>
                <input className="nuvex-register-control" value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </Field>
              <Field label="Correo corporativo *" icon={<Mail className="w-4 h-4" />}>
                <input type="email" className="nuvex-register-control" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>

              <Field label="Contraseña *" icon={<KeyRound className="w-4 h-4" />}
                trailing={
                  <button type="button" className="nrx-field-trailing" onClick={() => setShowPwd((s) => !s)} aria-label="Mostrar contraseña">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }>
                <input type={showPwd ? "text" : "password"} className="nuvex-register-control" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </Field>
              <Field label="Teléfono / WhatsApp *" icon={<Phone className="w-4 h-4" />}>
                <input className="nuvex-register-control" value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })} required placeholder="+57 3XX XXX XXXX" />
              </Field>

              <Field label="Ciudad *" icon={<MapPin className="w-4 h-4" />}>
                <input className="nuvex-register-control" value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })} required placeholder="Ej. Bogotá" />
              </Field>
              <Field label="Equipo / Sede" icon={<Building2 className="w-4 h-4" />}>
                <input className="nuvex-register-control" value={form.equipo}
                  onChange={(e) => setForm({ ...form, equipo: e.target.value })} placeholder="Ej. Bogotá Norte" />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Rol solicitado *" icon={<UserCog className="w-4 h-4" />}>
                  <select value={form.rol_solicitado}
                    onChange={(e) => setForm({ ...form, rol_solicitado: e.target.value })}
                    className="nuvex-register-control nuvex-register-select">
                    {ROLES_SOLICITABLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                  </select>
                </Field>
              </div>

              {err && <div className="nuvex-register-error sm:col-span-2">{err}</div>}

              {/* Bloque de verificación de identidad */}
              <div className="nrx-security-block sm:col-span-2">
                <div className="nrx-security-title">
                  <ShieldCheck className="w-4 h-4" strokeWidth={2.4} />
                  Verificación de identidad
                </div>
                <p className="nrx-security-copy">
                  Para proteger la información financiera de NUVEX, todos los accesos nuevos deben completar:
                </p>
                <ul className="nrx-security-list">
                  <li><CheckCircle2 className="w-4 h-4" strokeWidth={2.4} /> Verificación de correo electrónico</li>
                  <li><CheckCircle2 className="w-4 h-4" strokeWidth={2.4} /> Código OTP vía SMS o WhatsApp</li>
                  <li><CheckCircle2 className="w-4 h-4" strokeWidth={2.4} /> Aprobación administrativa</li>
                </ul>
              </div>

              <button type="submit" disabled={busy} className="nuvex-register-submit sm:col-span-2">
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Enviando…
                  </span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" strokeWidth={2.6} />
                    Solicitar acceso
                    <ArrowRight className="w-4 h-4" strokeWidth={2.6} />
                  </>
                )}
              </button>
            </form>

            <div className="nuvex-register-note">
              <ShieldCheck className="w-4 h-4" strokeWidth={2.4} />
              <span>Tu solicitud será revisada por el equipo administrador de NUVEX antes de habilitar el acceso.</span>
            </div>

            <div className="nuvex-register-login-link">
              ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, icon, trailing, children }: { label: string; icon?: ReactNode; trailing?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="nuvex-register-label">{label}</span>
      <div className="nrx-field mt-2">
        {icon && <span className="nrx-field-icon">{icon}</span>}
        {children}
        {trailing}
      </div>
    </label>
  );
}
