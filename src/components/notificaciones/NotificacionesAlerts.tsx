import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { navigateToNotification, resolveNotificationHref } from "@/lib/notificacionLinks";
import {
  enDND,
  getNotifPrefs,
  subscribeNotifPrefs,
  type NotifPrefs,
} from "@/lib/notifPreferencias";
import { reproducirSonido, precalentarAudio, type SoundKind } from "@/lib/notifSound";
import {
  esSirena,
  generarFaviconConBadge,
  aplicarFavicon,
  limpiarFaviconDinamico,
} from "@/lib/notifSirena";

const TITULO_BASE = "Nuvex";
const SIRENA_REPEAT_MS = 5 * 60_000; // 5 min

function tipoToSound(tipo: string): SoundKind {
  if (tipo === "dm" || tipo.startsWith("dm")) return "dm";
  if (tipo.includes("mencion") || tipo.includes("canal")) return "mencion";
  return "general";
}

function rutaActualCoincide(link: string | null): boolean {
  if (!link || typeof window === "undefined") return false;
  const cur = window.location.pathname + window.location.search;
  // Coincidencia exacta o el link es prefijo de la ruta actual
  return cur === link || cur.startsWith(link + "&") || cur.startsWith(link + "?");
}

/**
 * Componente invisible que vive en el layout autenticado.
 * Centraliza: toasts, sonidos sutiles, badge en título del navegador
 * y notificaciones nativas (con permiso) ante notificaciones nuevas.
 */
export function NotificacionesAlerts() {
  const { items, unread, leer } = useNotificaciones();
  const [prefs, setPrefs] = useState<NotifPrefs>(getNotifPrefs);
  // Set de IDs ya vistos por este montaje — evita re-disparar para ítems viejos.
  const vistosRef = useRef<Set<string>>(new Set());
  const inicializadoRef = useRef(false);

  // Sync prefs (cambios desde Mi Perfil → emite evento).
  useEffect(() => {
    return subscribeNotifPrefs(() => setPrefs(getNotifPrefs()));
  }, []);

  // Desbloqueo de audio + solicitud de permiso de notificaciones tras primer gesto.
  useEffect(() => {
    const h = () => {
      precalentarAudio();
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        try { Notification.requestPermission().catch(() => {}); } catch { /* noop */ }
      }
      window.removeEventListener("click", h);
      window.removeEventListener("keydown", h);
    };
    window.addEventListener("click", h);
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("click", h);
      window.removeEventListener("keydown", h);
    };
  }, []);

  // Sirena: cuántos urgentes (QA) sin leer.
  const urgentes = items.filter((n) => !n.leida && esSirena(n.tipo)).length;

  // Badge en pestaña: título parpadeante si hay urgentes + pestaña oculta,
  // y favicon dinámico con badge rojo cuando hay urgentes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${TITULO_BASE}` : TITULO_BASE;
    document.title = baseTitle;
    // Favicon
    if (urgentes > 0) {
      const d = generarFaviconConBadge(urgentes);
      if (d) aplicarFavicon(d);
    } else if (unread > 0) {
      const d = generarFaviconConBadge(unread);
      if (d) aplicarFavicon(d);
    } else {
      limpiarFaviconDinamico();
    }
    // Blink cuando la pestaña no está visible
    if (urgentes === 0) return;
    let alt = false;
    const alerta = `🔴 QA PENDIENTE (${urgentes}) — NUVIA`;
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        document.title = baseTitle;
        return;
      }
      alt = !alt;
      document.title = alt ? alerta : baseTitle;
    }, 1500);
    return () => {
      window.clearInterval(iv);
      document.title = baseTitle;
    };
  }, [unread, urgentes]);

  // Sirena: sonido repetido cada 5 min mientras haya urgentes sin leer.
  useEffect(() => {
    if (urgentes === 0) return;
    if (!prefs.sonido || enDND(prefs)) return;
    const iv = window.setInterval(() => {
      // No molestar si ya está en /qa-ai o /notificaciones con pestaña visible
      const p = typeof window !== "undefined" ? window.location.pathname : "";
      if (
        document.visibilityState === "visible" &&
        (p.startsWith("/qa-ai") || p.startsWith("/notificaciones"))
      ) return;
      reproducirSonido("mencion", prefs.volumen);
    }, SIRENA_REPEAT_MS);
    return () => window.clearInterval(iv);
  }, [urgentes, prefs]);


  // Inicialización: marca todas las existentes como "ya vistas" (no notificar al cargar).
  useEffect(() => {
    if (inicializadoRef.current) return;
    if (items.length > 0 || !items) {
      items.forEach((n) => vistosRef.current.add(n.id));
      inicializadoRef.current = true;
    }
  }, [items]);

  // Detectar nuevas notificaciones no leídas.
  useEffect(() => {
    if (!inicializadoRef.current) return;
    const nuevas = items.filter((n) => !vistosRef.current.has(n.id) && !n.leida);
    if (nuevas.length === 0) return;
    nuevas.forEach((n) => vistosRef.current.add(n.id));

    const enRutaDelMensaje = nuevas.length === 1 && rutaActualCoincide(resolveNotificationHref(nuevas[0]));
    const documentoVisible = typeof document !== "undefined" && document.visibilityState === "visible";
    const silenciar = enDND(prefs);

    // Toast (omitir si ya estás viendo exactamente ese chat/canal y pestaña visible)
    if (prefs.toast && !(enRutaDelMensaje && documentoVisible)) {
      const visibles = nuevas.slice(0, 3);
      visibles.forEach((n) => {
        toast(n.titulo, {
          description: n.mensaje ?? undefined,
          icon: <Bell className="h-4 w-4" />,
          duration: 5000,
          action: resolveNotificationHref(n)
            ? {
                label: "Abrir",
                onClick: () => {
                  void leer(n.id);
                  navigateToNotification(n);
                },
              }
            : undefined,
        });
      });
      if (nuevas.length > 3) {
        toast(`+${nuevas.length - 3} notificaciones más`, { duration: 4000 });
      }
    }

    // Sonido (solo si pestaña visible o usuario activo; respeta DND y ruta actual)
    if (prefs.sonido && !silenciar && !(enRutaDelMensaje && documentoVisible)) {
      const kind = tipoToSound(nuevas[0].tipo);
      reproducirSonido(kind, prefs.volumen);
    }

    // Notificación del navegador (solo si pestaña no visible)
    if (
      prefs.browser &&
      !silenciar &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      !documentoVisible
    ) {
      nuevas.slice(0, 3).forEach((n) => {
        try {
          const not = new Notification(n.titulo, {
            body: n.mensaje ?? "",
            tag: n.id,
            icon: "/favicon.ico",
          });
          not.onclick = () => {
            window.focus();
            if (resolveNotificationHref(n)) {
              void leer(n.id);
              navigateToNotification(n);
            }
            not.close();
          };
        } catch {
          /* noop */
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, prefs]);

  // Reset título + favicon al desmontar
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") document.title = TITULO_BASE;
      limpiarFaviconDinamico();
    };
  }, []);


  return null;
}
