import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  contarCasoAlertasNoLeidas,
  contarNoLeidas,
  listCasoAlertasComoNotif,
  listMisNotificaciones,
  marcarCasoAlertaLeida,
  marcarLeida,
  marcarTodasLeidas,
  type Notificacion,
} from "@/lib/notificaciones";
import { useAuth } from "./useAuth";

export function useNotificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [lst, c, alertas, cAlertas] = await Promise.all([
        listMisNotificaciones(),
        contarNoLeidas(),
        listCasoAlertasComoNotif(),
        contarCasoAlertasNoLeidas(),
      ]);
      const merged = [...lst, ...alertas].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setItems(merged);
      setUnread(c + cAlertas);
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void reload();
    const instanceId = Math.random().toString(36).slice(2, 10);
    const ch = supabase
      .channel(`notif_user_${user.id}_${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones_usuario", filter: `user_id=eq.${user.id}` },
        () => { void reload(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "caso_alertas" },
        () => { void reload(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, reload]);

  const leer = async (id: string) => {
    if (id.startsWith("alerta:")) {
      await marcarCasoAlertaLeida(id.slice("alerta:".length));
    } else {
      await marcarLeida(id);
    }
    await reload();
  };
  const leerTodas = async () => {
    await marcarTodasLeidas();
    await reload();
  };

  return { items, unread, loading, reload, leer, leerTodas };
}
