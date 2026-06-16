import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, ShieldCheck, Lock, Eye, EyeOff, Sparkles, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CitySelect } from "@/components/ui/CitySelect";

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
  head: () => ({ meta: [{ title: "Solicitar acceso · NUVIA — Inteligencia Financiera" }] }),
});

const BLUE = "#445DA3";
const GREEN = "#84B98F";

const ROLES_SOLICITABLES = [
  { v: "licenciado", label: "Analista Financiero Comercial" },
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
            throw new Error("Este correo ya está registrado en NUVIA. Inicia sesión o contacta al administrador.");
          }
        }
      } catch (preCheckErr) {
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
    const esReactivacion = doneMode === "reactivacion";
    return (
      <div className="min-h-screen w-full grid place-items-center text-white p-6" style={{ background: "#0A0B10" }}>
        <BgOrbs />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md rounded-[24px] border border-white/[0.08] p-10 text-center"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div
            className="mx-auto grid place-items-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: `linear-gradient(135deg, ${BLUE}, ${GREEN})`,
              boxShadow: "0 12px 30px -10px rgba(132,185,143,0.5)",
            }}
          >
            <ShieldCheck className="w-7 h-7" strokeWidth={2.4} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {esReactivacion ? "Solicitud de reactivación enviada" : "Solicitud enviada"}
          </h1>
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            {esReactivacion
              ? "Tu cuenta ya existe en NUVIA y se encuentra desvinculada. Enviamos una solicitud de reactivación al administrador. Recibirás una notificación cuando tu acceso sea restaurado."
              : <>Tu cuenta quedó en <b className="text-white">estado pendiente</b>. Un administrador NUVIA revisará y aprobará tu acceso. Recibirás una notificación cuando puedas iniciar sesión.</>}
          </p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-7 w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
          >
            Volver al inicio de sesión
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row text-white" style={{ background: "#0A0B10" }}>
      {/* LEFT — Brand */}
      <aside
        className="relative overflow-hidden lg:w-[45%] min-h-[36vh] lg:min-h-screen"
        style={{
          background:
            "radial-gradient(1100px 700px at 20% 10%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(900px 600px at 90% 90%, rgba(132,185,143,0.22), transparent 55%), linear-gradient(160deg, #0A0B10 0%, #0F121C 55%, #0A0B10 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
        <BgOrbs />
        <NeuralCanvas />

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
            transition={{ duration: 0.8, delay: 0.15 }}
            className="hidden lg:block max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-1 text-[11px] tracking-widest uppercase text-white/60 mb-6">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
              Acceso corporativo
            </div>
            <h1 className="text-5xl xl:text-6xl font-semibold leading-[1.05] tracking-tight">
              Únete a la red de{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${BLUE}, ${GREEN})` }}
              >
                inteligencia financiera.
              </span>
            </h1>
            <p className="mt-6 text-base xl:text-lg text-white/55 leading-relaxed max-w-lg font-light">
              Solicita acceso al sistema operativo NUVIA. Tu perfil será validado por administración antes de activar tu workspace.
            </p>

            <div className="mt-10 space-y-3 max-w-md">
              {[
                { t: "Cifrado de grado empresarial", c: "Tus datos protegidos con estándares bancarios." },
                { t: "Validación administrativa", c: "Cada acceso es revisado por el equipo NUVIA." },
                { t: "Plataforma especializada", c: "Herramientas exclusivas para analistas financieros." },
              ].map((b) => (
                <div
                  key={b.t}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3.5"
                >
                  <div
                    className="shrink-0 grid place-items-center w-8 h-8 rounded-lg"
                    style={{ background: `linear-gradient(135deg, ${BLUE}33, ${GREEN}33)`, border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} strokeWidth={2.4} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{b.t}</div>
                    <div className="text-[12px] text-white/50">{b.c}</div>
                  </div>
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

      {/* RIGHT — Form */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 relative">
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <Mark size={28} />
          <span className="text-sm font-semibold tracking-[0.2em]">NUVIA</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-2xl"
        >
          <div
            className="rounded-[24px] border border-white/[0.08] p-8 sm:p-10 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)] relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <div
              className="absolute inset-x-0 -top-px h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BLUE}, ${GREEN}, transparent)` }}
            />

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
                  Solicitud de acceso
                </div>
                <h2 className="mt-3 text-[28px] font-semibold tracking-tight">Crea tu workspace</h2>
                <p className="mt-1.5 text-sm text-white/50">
                  Tu cuenta quedará pendiente hasta la aprobación interna del equipo NUVIA.
                </p>
              </div>
              <div
                className="hidden sm:grid place-items-center w-11 h-11 rounded-xl shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Lock className="w-5 h-5 text-white/70" strokeWidth={2.2} />
              </div>
            </div>

            <form onSubmit={submit} className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre completo *">
                <input
                  className="nuvia-input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  placeholder="Ej. Andrés Gómez"
                />
              </Field>
              <Field label="Correo corporativo *">
                <input
                  type="email"
                  className="nuvia-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="tu@empresa.com"
                  autoComplete="email"
                />
              </Field>

              <Field label="Contraseña *">
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="nuvia-input pr-10"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="Teléfono / WhatsApp *">
                <input
                  className="nuvia-input"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  required
                  placeholder="+57 3XX XXX XXXX"
                />
              </Field>

              <Field label="Ciudad *">
                <div className="nuvia-input-wrap">
                  <CitySelect
                    value={form.ciudad}
                    onChange={(v) => setForm({ ...form, ciudad: v })}
                    required
                    placeholder="Selecciona municipio…"
                  />
                </div>
              </Field>
              <Field label="Equipo / Sede">
                <input
                  className="nuvia-input"
                  value={form.equipo}
                  onChange={(e) => setForm({ ...form, equipo: e.target.value })}
                  placeholder="Ej. Bogotá Norte"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Rol solicitado *">
                  <select
                    value={form.rol_solicitado}
                    onChange={(e) => setForm({ ...form, rol_solicitado: e.target.value })}
                    className="nuvia-input"
                  >
                    {ROLES_SOLICITABLES.map((r) => (
                      <option key={r.v} value={r.v} className="bg-[#0F121C]">{r.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {err && (
                <div className="sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {err}
                </div>
              )}

              <div
                className="sm:col-span-2 rounded-xl border border-white/10 p-4"
                style={{ background: "rgba(255,255,255,0.025)" }}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-white/85">
                  <ShieldCheck className="w-4 h-4" style={{ color: GREEN }} strokeWidth={2.4} />
                  Verificación de identidad
                </div>
                <p className="mt-1.5 text-[12.5px] text-white/50 leading-relaxed">
                  Para proteger la información financiera, todos los accesos nuevos deben completar:
                </p>
                <ul className="mt-3 grid sm:grid-cols-3 gap-2 text-[12px] text-white/70">
                  {[
                    "Verificación de correo",
                    "Código OTP por SMS/WhatsApp",
                    "Aprobación administrativa",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: GREEN }} strokeWidth={2.5} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <motion.button
                type="submit"
                disabled={busy}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="sm:col-span-2 group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(68,93,163,0.7)] hover:shadow-[0_18px_50px_-12px_rgba(132,185,143,0.5)] disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
                style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${GREEN} 100%)` }}
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  {busy ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" strokeWidth={2.4} />
                      Solicitar acceso
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
                    </>
                  )}
                </span>
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${GREEN}, ${BLUE})` }}
                />
              </motion.button>
            </form>

            <div className="mt-6 flex items-center gap-2 text-[12px] text-white/45">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Tu solicitud será revisada por el equipo administrador antes de habilitar el acceso.</span>
            </div>

            <div className="mt-5 text-center text-sm text-white/55">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="font-semibold text-white hover:underline inline-flex items-center gap-1">
                Iniciar sesión <Sparkles size={12} style={{ color: GREEN }} />
              </Link>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-white/30">
            Protegido con cifrado de grado empresarial · NUVIA Systems
          </p>
        </motion.div>
      </main>

      <style>{`
        .nuvia-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #fff;
          padding: 0.7rem 0.9rem;
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
        select.nuvia-input { appearance: none; background-image: linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.5) 50%), linear-gradient(135deg, rgba(255,255,255,0.5) 50%, transparent 50%); background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; padding-right: 2rem; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
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

function BgOrbs() {
  return (
    <>
      <motion.div
        className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full blur-[120px] opacity-40 pointer-events-none"
        style={{ background: BLUE }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full blur-[140px] opacity-30 pointer-events-none"
        style={{ background: GREEN }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

function NeuralCanvas() {
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
        <linearGradient id="reg-nv-link" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.55" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="reg-nv-node">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="60%" stopColor={GREEN} stopOpacity="0.7" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <filter id="reg-nv-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#reg-nv-glow)">
        {links.map(([a, b], i) => {
          const A = nodes[a]; const B = nodes[b];
          return (
            <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="url(#reg-nv-link)" strokeWidth="0.18" opacity={0.5}>
              <animate attributeName="opacity" values="0.15;0.7;0.15" dur={`${4 + (i % 5)}s`} repeatCount="indefinite" />
            </line>
          );
        })}
      </g>
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="1.6" fill="url(#reg-nv-node)">
            <animate attributeName="r" values="1.2;2;1.2" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={n.x} cy={n.y} r="0.5" fill="#fff" opacity="0.9" />
        </g>
      ))}
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
