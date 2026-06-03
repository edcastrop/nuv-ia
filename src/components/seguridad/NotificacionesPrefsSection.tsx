import { useEffect, useState } from "react";
import { Bell, Volume2, MonitorSmartphone, MoonStar, PlayCircle, Info, RefreshCw } from "lucide-react";
import {
  DEFAULT_PREFS,
  getNotifPrefs,
  setNotifPrefs,
  type NotifPrefs,
} from "@/lib/notifPreferencias";
import { reproducirSonido, precalentarAudio } from "@/lib/notifSound";
import { toast } from "sonner";

function detectarNavegador(): "chrome" | "safari" | "firefox" | "edge" | "otro" {
  if (typeof navigator === "undefined") return "otro";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome") && !ua.includes("edg/")) return "chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("firefox")) return "firefox";
  return "otro";
}

function instruccionesDesbloqueo(nav: ReturnType<typeof detectarNavegador>): string[] {
  switch (nav) {
    case "chrome":
    case "edge":
      return [
        "Haz clic en el ícono 🔒 (o ⓘ) a la izquierda de la URL.",
        "Busca 'Notificaciones' y cambia a 'Permitir'.",
        "Recarga esta página y vuelve a activar el interruptor.",
      ];
    case "safari":
      return [
        "Abre Safari → Preferencias → Sitios web → Notificaciones.",
        "Busca este sitio en la lista y cambia a 'Permitir'.",
        "Recarga esta página.",
      ];
    case "firefox":
      return [
        "Haz clic en el ícono 🔒 a la izquierda de la URL.",
        "En 'Permisos' busca 'Enviar notificaciones' y quita el bloqueo.",
        "Recarga esta página.",
      ];
    default:
      return [
        "Abre la configuración de permisos del sitio en tu navegador.",
        "Cambia 'Notificaciones' a 'Permitir'.",
        "Recarga esta página.",
      ];
  }
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#EEF1F6] last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="rounded-lg p-2 bg-[#EAF1FF] text-[#445DA3]">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#242424]">{title}</div>
          <div className="text-xs text-[#242424]/60">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[#445DA3]" : "bg-[#D6DDE8]"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function NotificacionesPrefsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [permiso, setPermiso] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPrefs(getNotifPrefs());
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermiso(Notification.permission);
    } else {
      setPermiso("unsupported");
    }
  }, []);

  const upd = <K extends keyof NotifPrefs>(k: K, v: NotifPrefs[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    setNotifPrefs(next);
  };

  const pedirPermiso = async () => {
    if (!("Notification" in window)) return;
    const r = await Notification.requestPermission();
    setPermiso(r);
    if (r === "granted") {
      upd("browser", true);
      toast.success("Notificaciones del navegador activadas");
    } else {
      toast.error("Permiso denegado por el navegador");
    }
  };

  const probarSonido = () => {
    precalentarAudio();
    reproducirSonido("dm", prefs.volumen);
  };

  return (
    <section className="rounded-2xl bg-white border border-[#E3E7EE] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Bell size={16} className="text-[#445DA3]" />
        <h3 className="text-sm font-bold text-[#242424]">Notificaciones</h3>
      </div>
      <p className="text-xs text-[#242424]/60 mb-3">
        Controla cómo te avisamos cuando recibes mensajes y alertas. No invasivo: respeta tu modo "no molestar"
        y silencia automáticamente si ya estás viendo el chat.
      </p>

      <Row
        icon={<Bell size={14} />}
        title="Mostrar avisos visuales"
        desc="Toast discreto en la esquina inferior. Click para abrir el mensaje."
      >
        <Switch checked={prefs.toast} onChange={(v) => upd("toast", v)} />
      </Row>

      <Row
        icon={<Volume2 size={14} />}
        title="Sonido al recibir"
        desc="Tin corto y suave. DM agudo, menciones medio, otros bajo."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={probarSonido}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E3E7EE] bg-white px-2 py-1 text-[11px] font-medium text-[#445DA3] hover:bg-[#F7F9FB]"
          >
            <PlayCircle size={12} /> Probar
          </button>
          <Switch checked={prefs.sonido} onChange={(v) => upd("sonido", v)} />
        </div>
      </Row>

      {prefs.sonido && (
        <div className="flex items-center justify-between gap-4 py-2 pl-12">
          <span className="text-xs text-[#242424]/70">Volumen</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volumen}
            onChange={(e) => upd("volumen", Number(e.target.value))}
            className="w-40 accent-[#445DA3]"
          />
        </div>
      )}

      <Row
        icon={<MonitorSmartphone size={14} />}
        title="Notificaciones del navegador"
        desc={
          permiso === "unsupported"
            ? "Tu navegador no las soporta."
            : permiso === "granted"
              ? "Activas. Llegan aunque tengas otra pestaña abierta."
              : permiso === "denied"
                ? "Bloqueadas por el navegador. Solo tú puedes desbloquearlas desde la configuración del sitio."
                : "Te avisaremos aunque tengas otra pestaña activa."
        }
      >
        {permiso === "granted" ? (
          <Switch checked={prefs.browser} onChange={(v) => upd("browser", v)} />
        ) : permiso === "default" ? (
          <button
            onClick={pedirPermiso}
            className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-xs font-semibold text-[#445DA3] hover:bg-[#F7F9FB]"
          >
            Activar
          </button>
        ) : permiso === "denied" ? (
          <button
            onClick={() => {
              const p = ("Notification" in window ? Notification.permission : "unsupported") as NotificationPermission | "unsupported";
              setPermiso(p);
              if (p === "granted") toast.success("Notificaciones desbloqueadas");
              else toast.info("Si ya desbloqueaste el permiso, recarga la página.");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-xs font-semibold text-[#445DA3] hover:bg-[#F7F9FB]"
          >
            <RefreshCw size={12} /> Reintentar
          </button>
        ) : (
          <Switch checked={false} onChange={() => {}} />
        )}
      </Row>

      {permiso === "denied" && (
        <div className="mx-12 mt-1 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="font-semibold">¿Cómo desbloquear las notificaciones?</div>
              <ol className="list-decimal pl-4 space-y-0.5">
                {instruccionesDesbloqueo(detectarNavegador()).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
              <div className="pt-1 text-[11px] text-amber-800/80">
                Nota: en la app móvil, activa las notificaciones desde los ajustes del sistema operativo para esta app.
              </div>
            </div>
          </div>
        </div>
      )}

      <Row
        icon={<MoonStar size={14} />}
        title="No molestar (horario)"
        desc="En este rango no suenan avisos. Los toasts visuales siguen apareciendo."
      >
        <Switch checked={prefs.dndEnabled} onChange={(v) => upd("dndEnabled", v)} />
      </Row>

      {prefs.dndEnabled && (
        <div className="flex items-center justify-end gap-2 py-2 pl-12">
          <input
            type="time"
            value={prefs.dndStart}
            onChange={(e) => upd("dndStart", e.target.value)}
            className="rounded-md border border-[#E3E7EE] px-2 py-1 text-xs"
          />
          <span className="text-xs text-[#242424]/60">a</span>
          <input
            type="time"
            value={prefs.dndEnd}
            onChange={(e) => upd("dndEnd", e.target.value)}
            className="rounded-md border border-[#E3E7EE] px-2 py-1 text-xs"
          />
        </div>
      )}
    </section>
  );
}
