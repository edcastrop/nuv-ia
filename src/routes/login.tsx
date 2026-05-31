import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/nuvex/Logo";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Acceso · NUVEX Finanzas Inteligentes" }] }),
});

const NUVEX_AZUL = "#445DA3";
const NUVEX_VERDE = "#84B98F";
const NUVEX_NEGRO = "#242424";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "signin") {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const uid = signInData.user?.id;
        if (uid) {
          const [{ data: prof }, { data: roleRows }] = await Promise.all([
            supabase
              .from("profiles" as never)
              .select("estado_acceso, mfa_verificado_at, rechazado_motivo")
              .eq("id", uid)
              .maybeSingle(),
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", uid),
          ]);
          const p = prof as { estado_acceso?: string; mfa_verificado_at?: string | null; rechazado_motivo?: string | null } | null;
          const isSuperAdmin = ((roleRows ?? []) as Array<{ role?: string }>).some((r) => r.role === "super_admin");
          if (!isSuperAdmin && p && p.estado_acceso !== "aprobado") {
            await supabase.auth.signOut();
            const msgs: Record<string, string> = {
              pendiente: "Tu cuenta está pendiente de aprobación por un administrador.",
              rechazado: `Tu acceso fue rechazado. ${p.rechazado_motivo ?? ""}`.trim(),
              bloqueado: "Tu cuenta está bloqueada. Contacta al administrador.",
            };
            throw new Error(msgs[p.estado_acceso ?? "pendiente"] ?? "Acceso no autorizado.");
          }
          // Registrar último login
          await supabase.from("profiles" as never)
            .update({ ultimo_login_at: new Date().toISOString(), intentos_fallidos: 0 } as never)
            .eq("id", uid);
          await supabase.from("acceso_auditoria" as never).insert({
            user_id: uid, actor_id: uid, accion: "login_ok", detalle: {},
          } as never);
          // MFA OBLIGATORIO para TODOS los roles sin excepción (incluye super_admin).
          // Ventana: 24 horas desde la última verificación exitosa.
          void isSuperAdmin;
          const mfaOk = !!(p?.mfa_verificado_at &&
            (Date.now() - new Date(p.mfa_verificado_at).getTime()) < 24 * 3600 * 1000
          );
          if (!mfaOk) {
            navigate({ to: "/mfa-verificar" });
            return;
          }
        }
        navigate({ to: "/" });
      } else {
        navigate({ to: "/registro" });
        return;
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };


  const google = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (r.error) throw r.error;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error con Google");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white" style={{ color: NUVEX_NEGRO }}>
      {/* COLUMNA IZQUIERDA - Brand panel */}
      <aside
        className="relative hidden lg:flex flex-col justify-between w-3/5 px-12 xl:px-16 py-10 overflow-hidden"
        style={{
          background: `radial-gradient(1200px 600px at 0% 0%, rgba(68,93,163,0.45), transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(132,185,143,0.30), transparent 55%), linear-gradient(135deg, #0e1018 0%, #181c2a 50%, #1b2236 100%)`,
        }}
      >
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Glow orbs */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-30" style={{ background: NUVEX_AZUL }} />
        <div className="absolute -bottom-40 right-10 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25" style={{ background: NUVEX_VERDE }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center animate-fade-in">
          <Logo variant="white" height={48} />
        </div>

        {/* Headline & beneficios */}
        <div className="relative z-10 max-w-xl animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-widest text-white/70 mb-6">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: NUVEX_VERDE }} />
            Plataforma profesional
          </div>
          <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.08] text-white">
            Optimiza créditos hipotecarios con{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${NUVEX_VERDE}, #b9e0c3)` }}
            >
              inteligencia financiera
            </span>
          </h1>
          <p className="mt-5 text-base xl:text-lg text-white/70 leading-relaxed max-w-lg">
            Reduce años de tu crédito, genera ahorro real en intereses y presenta propuestas profesionales en minutos.
          </p>

          <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-white/85">
            {[
              "Simulación financiera avanzada",
              "Basado en Ley 546 de 1999",
              "Ahorro en intereses y seguros",
              "Gestión profesional de propuestas",
              "Dashboard financiero inteligente",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                  style={{ background: `linear-gradient(135deg, ${NUVEX_AZUL}, ${NUVEX_VERDE})` }}
                >
                  <svg viewBox="0 0 20 20" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M4 10l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>

          {/* Tarjeta SaaS resultado */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] hover:bg-white/[0.06] transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-400/80" />
                <div className="h-2 w-2 rounded-full bg-yellow-400/80" />
                <div className="h-2 w-2 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-[11px] uppercase tracking-widest text-white/50">Resultado simulación</span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ background: `linear-gradient(135deg, ${NUVEX_VERDE}, #4f9b66)` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Aprobado
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Metric label="Años eliminados" value="8 años" tone="green" />
              <Metric label="Ahorro proyectado" value="$126.500.000" tone="blue" />
              <Metric label="Incremento cuota" value="$280.000" tone="neutral" />
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 text-xs text-white/50 italic animate-fade-in">
          "El ahorro no es un lujo, es un derecho." — NUVEX Finanzas Inteligentes
        </div>
      </aside>

      {/* COLUMNA DERECHA - Login card */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-10 py-10 bg-[#F5F7FB] relative">
        {/* Mobile mini-brand */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${NUVEX_AZUL}, ${NUVEX_VERDE})` }}
          >
            N
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: NUVEX_NEGRO }}>NUVEX</div>
            <div className="text-[10px] uppercase tracking-widest text-[#242424]/55 -mt-0.5">Finanzas Inteligentes</div>
          </div>
        </div>

        <div className="w-full max-w-md animate-scale-in">
          <div className="rounded-2xl bg-white border border-[#E7EAF1] shadow-[0_20px_60px_-20px_rgba(36,36,36,0.18)] p-8 sm:p-9">
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: NUVEX_NEGRO }}>
              {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
            </h2>
            <p className="mt-1.5 text-sm text-[#242424]/60">
              {mode === "signin"
                ? "Accede a la plataforma profesional NUVEX"
                : "Solo personal autorizado NUVEX"}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === "signup" && (
                <Field label="Nombre">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    className="nuvex-input"
                    placeholder="Tu nombre completo"
                  />
                </Field>
              )}
              <Field label="Correo electrónico">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="nuvex-input"
                  placeholder="nombre@nuvex.com.co"
                />
              </Field>
              <Field label="Contraseña">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="nuvex-input"
                  placeholder="••••••••"
                />
              </Field>

              {mode === "signin" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-[#242424]/75">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-[#CBD2DF] accent-[#445DA3]"
                    />
                    Recordarme
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      setErr(null); setInfo(null);
                      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        setErr("Ingresa tu correo arriba para enviar el enlace de recuperación.");
                        return;
                      }
                      setBusy(true);
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/login`,
                        });
                        if (error) throw error;
                        setInfo("Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.");
                      } catch (e: unknown) {
                        setErr(e instanceof Error ? e.message : "No se pudo enviar el enlace.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="font-medium hover:underline"
                    style={{ color: NUVEX_AZUL }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {err && (
                <div className="rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-sm text-[#B42318]">{err}</div>
              )}
              {info && (
                <div className="rounded-lg bg-[#EAF7EE] border border-[#84B98F] px-3 py-2 text-sm text-[#1F6D3D]">{info}</div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-[0_10px_25px_-10px_rgba(68,93,163,0.7)] transition-all hover:shadow-[0_14px_30px_-8px_rgba(68,93,163,0.85)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ background: `linear-gradient(135deg, ${NUVEX_AZUL} 0%, ${NUVEX_VERDE} 100%)` }}
              >
                <span className="relative z-10">{busy ? "Procesando…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}</span>
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${NUVEX_VERDE} 0%, ${NUVEX_AZUL} 100%)` }}
                />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E7EAF1]" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#242424]/45">o continúa con</span>
              <div className="flex-1 h-px bg-[#E7EAF1]" />
            </div>

            <button
              onClick={google}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#E7EAF1] bg-white px-4 py-2.5 text-sm font-medium text-[#242424] hover:bg-[#F7F9FB] hover:border-[#CBD2DF] transition-colors disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.9c-.25 1.37-1.02 2.53-2.18 3.31v2.75h3.52c2.06-1.9 3.26-4.7 3.26-8.09z" />
                <path fill="#34A853" d="M12 23c2.94 0 5.4-.97 7.2-2.64l-3.52-2.75c-.97.65-2.22 1.04-3.68 1.04-2.83 0-5.23-1.91-6.09-4.48H2.27v2.81C4.06 20.53 7.74 23 12 23z" />
                <path fill="#FBBC05" d="M5.91 14.17a6.6 6.6 0 010-4.34V7.02H2.27a11 11 0 000 9.96l3.64-2.81z" />
                <path fill="#EA4335" d="M12 5.38c1.6 0 3.04.55 4.17 1.63l3.13-3.13C17.39 2.16 14.93 1.18 12 1.18 7.74 1.18 4.06 3.65 2.27 7.02l3.64 2.81C6.77 7.29 9.17 5.38 12 5.38z" />
              </svg>
              Continuar con Google
            </button>

            <div className="mt-6 text-center text-sm text-[#242424]/70">
              ¿No tienes cuenta?{" "}
              <Link to="/registro" className="font-semibold hover:underline" style={{ color: NUVEX_AZUL }}>
                Solicitar acceso
              </Link>
            </div>

          </div>

          <p className="mt-5 text-center text-xs text-[#242424]/55">
            Plataforma exclusiva para asesores y analistas NUVEX
          </p>
          <div className="mt-2 text-center">
            <Link to="/" className="text-[11px] text-[#242424]/40 hover:underline">Volver al inicio</Link>
          </div>
        </div>
      </main>

      <style>{`
        .nuvex-input {
          width: 100%;
          border-radius: 0.625rem;
          border: 1px solid #E1E5EE;
          background: #FAFBFD;
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          color: ${NUVEX_NEGRO};
          outline: none;
          transition: all 0.15s ease;
        }
        .nuvex-input:focus {
          border-color: ${NUVEX_AZUL};
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(68,93,163,0.12);
        }
        .nuvex-input::placeholder { color: rgba(36,36,36,0.35); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/65">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "blue" | "neutral" }) {
  const accent =
    tone === "green" ? NUVEX_VERDE : tone === "blue" ? "#7FA3E8" : "#FFFFFF";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-transform hover:-translate-y-0.5">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold leading-tight" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
