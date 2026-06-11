import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Iniciar sesión · NUVIA — Sistema Operativo de Inteligencia Financiera" }] }),
});

const BLUE = "#445DA3";
const GREEN = "#84B98F";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
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
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signInData.user?.id;
      if (uid) {
        const [{ data: prof }, { data: roleRows }] = await Promise.all([
          supabase.from("profiles" as never).select("estado_acceso, mfa_verificado_at, rechazado_motivo").eq("id", uid).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        const p = prof as { estado_acceso?: string; mfa_verificado_at?: string | null; rechazado_motivo?: string | null } | null;
        const isSuperAdmin = ((roleRows ?? []) as Array<{ role?: string }>).some((r) => r.role === "super_admin");
        if (!isSuperAdmin && p && p.estado_acceso !== "aprobado") {
          await supabase.auth.signOut();
          const msgs: Record<string, string> = {
            pendiente: "Tu cuenta está pendiente de aprobación por un administrador.",
            rechazado: `Acceso denegado. ${p.rechazado_motivo ?? ""}`.trim(),
            bloqueado: "Tu cuenta está bloqueada. Contacta a tu administrador.",
          };
          throw new Error(msgs[p.estado_acceso ?? "pendiente"] ?? "Acceso no autorizado.");
        }
        await supabase.from("profiles" as never).update({ ultimo_login_at: new Date().toISOString(), intentos_fallidos: 0 } as never).eq("id", uid);
        await supabase.from("acceso_auditoria" as never).insert({ user_id: uid, actor_id: uid, accion: "login_ok", detalle: {} } as never);
        const mfaOk = !!(p?.mfa_verificado_at && (Date.now() - new Date(p.mfa_verificado_at).getTime()) < 24 * 3600 * 1000);
        if (!mfaOk) { navigate({ to: "/mfa-verificar" }); return; }
      }
      navigate({ to: "/" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "microsoft" | "apple") => {
    setErr(null); setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (r.error) throw r.error;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : `Error al iniciar sesión con ${provider}`);
      setBusy(false);
    }
  };

  const forgot = async () => {
    setErr(null); setInfo(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Ingresa tu email arriba para recibir el enlace de recuperación.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfo("Te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No pudimos enviar el enlace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row text-white"
      style={{ background: "#0A0B10" }}
    >
      {/* ============ LEFT — Neural Intelligence Canvas ============ */}
      <aside
        className="relative overflow-hidden lg:w-[55%] min-h-[42vh] lg:min-h-screen"
        style={{
          background:
            "radial-gradient(1100px 700px at 20% 10%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(900px 600px at 90% 90%, rgba(132,185,143,0.22), transparent 55%), linear-gradient(160deg, #0A0B10 0%, #0F121C 55%, #0A0B10 100%)",
        }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />

        {/* Floating orbs */}
        <motion.div
          className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full blur-[120px] opacity-40"
          style={{ background: BLUE }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full blur-[140px] opacity-30"
          style={{ background: GREEN }}
          animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Neural network SVG */}
        <NeuralCanvas />

        {/* Brand & narrative */}
        <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-14">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <Mark />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-[0.22em]">NUVIA</div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/45">Inteligencia Financiera</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden lg:block max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-1 text-[11px] tracking-widest uppercase text-white/60 mb-6">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
              Capa de inteligencia · en línea
            </div>
            <h1 className="text-5xl xl:text-6xl font-semibold leading-[1.05] tracking-tight">
              Inteligencia que{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${BLUE}, ${GREEN})` }}
              >
                mueve las finanzas.
              </span>
            </h1>
            <p className="mt-6 text-base xl:text-lg text-white/55 leading-relaxed max-w-lg font-light">
              El sistema operativo para equipos financieros de alto rendimiento. Decisiones autónomas, señales en tiempo real, cero ruido.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
              {[
                { k: "Decisions / mo", v: "4.2M" },
                { k: "Models live", v: "128" },
                { k: "Latency p50", v: "38ms" },
              ].map((m) => (
                <div key={m.k} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">{m.k}</div>
                  <div className="mt-1 text-lg font-semibold">{m.v}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="hidden lg:flex items-center justify-between text-[11px] text-white/35">
            <span>© {new Date().getFullYear()} NUVIA Systems</span>
            <span className="tracking-widest uppercase">SOC 2 · ISO 27001</span>
          </div>
        </div>
      </aside>

      {/* ============ RIGHT — Auth card ============ */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 relative">
        {/* Mobile mini brand */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <Mark size={28} />
          <span className="text-sm font-semibold tracking-[0.2em]">NUVIA</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div
            className="rounded-[24px] border border-white/[0.08] p-8 sm:p-10 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)] relative overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            {/* Card glow edge */}
            <div
              className="absolute inset-x-0 -top-px h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BLUE}, ${GREEN}, transparent)` }}
            />

            <h2 className="text-[28px] font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-white/50">
              Access your financial intelligence workspace.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="nuvia-input"
                />
              </Field>

              <Field
                label="Password"
                right={
                  <button
                    type="button"
                    onClick={forgot}
                    className="text-[11px] font-medium text-white/55 hover:text-white transition"
                  >
                    Forgot password?
                  </button>
                }
              >
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="nuvia-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <label className="flex items-center gap-2 text-sm text-white/65 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#445DA3]"
                />
                Remember me
              </label>

              {err && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>
              )}
              {info && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{info}</div>
              )}

              <motion.button
                type="submit"
                disabled={busy}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(68,93,163,0.7)] transition-shadow hover:shadow-[0_18px_50px_-12px_rgba(132,185,143,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${GREEN} 100%)` }}
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  {busy ? "Signing in…" : "Sign In"}
                  {!busy && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
                </span>
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${GREEN}, ${BLUE})` }}
                />
              </motion.button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] tracking-[0.22em] uppercase text-white/35">or continue with</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <SocialBtn label="Google" onClick={() => oauth("google")} disabled={busy}>
                <GoogleIcon />
              </SocialBtn>
              <SocialBtn label="Microsoft" onClick={() => oauth("microsoft")} disabled={busy}>
                <MicrosoftIcon />
              </SocialBtn>
              <SocialBtn label="Apple" onClick={() => oauth("apple")} disabled={busy}>
                <AppleIcon />
              </SocialBtn>
            </div>

            <div className="mt-7 text-center text-sm text-white/55">
              Don't have an account?{" "}
              <Link to="/registro" className="font-semibold text-white hover:underline inline-flex items-center gap-1">
                Create Workspace <Sparkles size={12} style={{ color: GREEN }} />
              </Link>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-white/30">
            Protected by enterprise-grade encryption · NUVIA Systems
          </p>
        </motion.div>
      </main>

      <style>{`
        .nuvia-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #fff;
          padding: 0.75rem 0.95rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.18s ease;
        }
        .nuvia-input::placeholder { color: rgba(255,255,255,0.3); }
        .nuvia-input:focus {
          border-color: rgba(68,93,163,0.65);
          background: rgba(255,255,255,0.05);
          box-shadow: 0 0 0 4px rgba(68,93,163,0.18);
        }
        .nuvia-input:-webkit-autofill {
          -webkit-text-fill-color: #fff;
          -webkit-box-shadow: 0 0 0 1000px rgba(20,22,32,0.95) inset;
          caret-color: #fff;
        }
      `}</style>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Field({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">{label}</span>
        {right}
      </div>
      {children}
    </label>
  );
}

function SocialBtn({
  children, label, onClick, disabled,
}: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Continue with ${label}`}
      className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition px-3 py-2.5 text-sm text-white/85 disabled:opacity-50"
    >
      {children}
      <span className="hidden sm:inline text-xs">{label}</span>
    </button>
  );
}

function Mark({ size = 34 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-xl shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${BLUE}, ${GREEN})`,
        boxShadow: "0 8px 24px -8px rgba(68,93,163,0.6)",
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M5 19V5l14 14V5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ---------- Neural canvas (animated SVG) ---------- */

function NeuralCanvas() {
  // Static node positions for deterministic SSR rendering
  const nodes = [
    { x: 12, y: 22 }, { x: 28, y: 14 }, { x: 44, y: 28 }, { x: 62, y: 18 }, { x: 80, y: 32 },
    { x: 18, y: 48 }, { x: 36, y: 56 }, { x: 54, y: 44 }, { x: 72, y: 58 }, { x: 88, y: 50 },
    { x: 22, y: 76 }, { x: 40, y: 84 }, { x: 58, y: 72 }, { x: 76, y: 86 }, { x: 90, y: 74 },
  ];
  const links: Array<[number, number]> = [
    [0,1],[1,2],[2,3],[3,4],[0,5],[1,6],[2,7],[3,8],[4,9],
    [5,6],[6,7],[7,8],[8,9],[5,10],[6,11],[7,12],[8,13],[9,14],
    [10,11],[11,12],[12,13],[13,14],[2,8],[1,7],[6,12],[7,13],
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <defs>
        <linearGradient id="nv-link" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.55" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="nv-node">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="60%" stopColor={GREEN} stopOpacity="0.7" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <filter id="nv-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Links */}
      <g filter="url(#nv-glow)">
        {links.map(([a, b], i) => {
          const A = nodes[a]; const B = nodes[b];
          return (
            <line
              key={i}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="url(#nv-link)"
              strokeWidth="0.18"
              opacity={0.5}
            >
              <animate attributeName="opacity" values="0.15;0.7;0.15" dur={`${4 + (i % 5)}s`} repeatCount="indefinite" />
            </line>
          );
        })}
      </g>

      {/* Pulsing nodes */}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="1.6" fill="url(#nv-node)">
            <animate attributeName="r" values="1.2;2;1.2" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={n.x} cy={n.y} r="0.5" fill="#fff" opacity="0.9" />
        </g>
      ))}

      {/* Data packets traveling along selected links */}
      {links.slice(0, 8).map(([a, b], i) => {
        const A = nodes[a]; const B = nodes[b];
        return (
          <circle key={`p${i}`} r="0.55" fill={GREEN} opacity="0.95">
            <animate attributeName="cx" values={`${A.x};${B.x}`} dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${A.y};${B.y}`} dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </svg>
  );
}

/* ---------- Brand icons ---------- */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.9c-.25 1.37-1.02 2.53-2.18 3.31v2.75h3.52c2.06-1.9 3.26-4.7 3.26-8.09z" />
      <path fill="#34A853" d="M12 23c2.94 0 5.4-.97 7.2-2.64l-3.52-2.75c-.97.65-2.22 1.04-3.68 1.04-2.83 0-5.23-1.91-6.09-4.48H2.27v2.81C4.06 20.53 7.74 23 12 23z" />
      <path fill="#FBBC05" d="M5.91 14.17a6.6 6.6 0 010-4.34V7.02H2.27a11 11 0 000 9.96l3.64-2.81z" />
      <path fill="#EA4335" d="M12 5.38c1.6 0 3.04.55 4.17 1.63l3.13-3.13C17.39 2.16 14.93 1.18 12 1.18 7.74 1.18 4.06 3.65 2.27 7.02l3.64 2.81C6.77 7.29 9.17 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.13 3.02-.75.87-1.99 1.55-3.02 1.47-.13-1.12.42-2.27 1.12-3.04.78-.87 2.1-1.52 3.03-1.45zM20.5 17.36c-.55 1.26-.82 1.83-1.53 2.95-.99 1.55-2.39 3.48-4.13 3.49-1.54.02-1.94-1-4.04-.99-2.1.01-2.54 1.01-4.08.99-1.74-.02-3.07-1.76-4.06-3.31C-.1 16.3-.39 11.1 1.7 8.34c1.49-1.95 3.84-3.09 6.05-3.09 2.25 0 3.66 1.23 5.52 1.23 1.81 0 2.91-1.23 5.51-1.23 1.96 0 4.04 1.07 5.52 2.92-4.85 2.66-4.06 9.59-3.8 9.19z" />
    </svg>
  );
}
