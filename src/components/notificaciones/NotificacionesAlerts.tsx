import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import {
  enDND,
  getNotifPrefs,
  subscribeNotifPrefs,
  type NotifPrefs,
} from "@/lib/notifPreferencias";
import { reproducirSonido, precalentarAudio, type SoundKind } from "@/lib/notifSound";

const TITULO_BASE = "Nuvex";

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
  const router = useRouter();
  const navigate = (to: string) => {
    if (/^https?:\/\//i.test(to)) {
      window.location.href = to;
    } else {
      router.navigate({ to });
    }
  };
  const [prefs, setPrefs] = useState<NotifPrefs>(getNotifPrefs);
  // Set de IDs ya vistos por este montaje — evita re-disparar para ítems viejos.
  const vistosRef = useRef<Set<string>>(new Set());
  const inicializadoRef = useRef(false);

  // Sync prefs (cambios desde Mi Perfil → emite evento).
  useEffect(() => {
    return subscribeNotifPrefs(() => setPrefs(getNotifPrefs()));
  }, []);

  // Desbloqueo de audio tras primer gesto del usuario.
  useEffect(() => {
    const h = () => {
      precalentarAudio();
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

  // Badge en pestaña: título y favicon.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${TITULO_BASE}` : TITULO_BASE;
  }, [unread]);

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

    const enRutaDelMensaje = nuevas.length === 1 && rutaActualCoincide(nuevas[0].link);
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
          action: n.link
            ? {
                label: "Abrir",
                onClick: () => {
                  void leer(n.id);
                  navigate(n.link!);
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
      try {
        const n = nuevas[0];
        const not = new Notification(n.titulo, {
          body: n.mensaje ?? "",
          tag: n.id,
          icon: "/favicon.ico",
        });
        not.onclick = () => {
          window.focus();
          if (n.link) {
            void leer(n.id);
            navigate(n.link);
          }
          not.close();
        };
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, prefs]);

  // Reset título al desmontar
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") document.title = TITULO_BASE;
    };
  }, []);


  return null;
}
