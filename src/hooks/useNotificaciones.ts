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
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    reload();
    const ch = supabase
      .channel("notif_user_" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones_usuario", filter: `user_id=eq.${user.id}` },
        () => reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "caso_alertas" },
        () => reload(),
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
    // Marcar todas las alertas visibles como leídas
    const pendientes = items.filter((n) => n.id.startsWith("alerta:") && !n.leida);
    await Promise.all(pendientes.map((n) => marcarCasoAlertaLeida(n.id.slice("alerta:".length))));
    await reload();
  };

  return { items, unread, loading, reload, leer, leerTodas };
}
