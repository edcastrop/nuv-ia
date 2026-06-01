import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  contarCasoAlertasNoLeidas,
  contarColabNotifsNoLeidas,
  contarNoLeidas,
  listCasoAlertasComoNotif,
  listColabNotifsComoNotif,
  listMisNotificaciones,
  marcarCasoAlertaLeida,
  marcarColabNotifLeida,
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
    const [lst, c, alertas, cAlertas, colab, cColab] = await Promise.all([
      listMisNotificaciones(),
      contarNoLeidas(),
      listCasoAlertasComoNotif(),
      contarCasoAlertasNoLeidas(),
      listColabNotifsComoNotif(),
      contarColabNotifsNoLeidas(),
    ]);
    const merged = [...lst, ...alertas, ...colab].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setItems(merged);
    setUnread(c + cAlertas + cColab);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "colab_notificaciones", filter: `user_id=eq.${user.id}` },
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
    } else if (id.startsWith("colab:")) {
      await marcarColabNotifLeida(id.slice("colab:".length));
    } else {
      await marcarLeida(id);
    }
    await reload();
  };
  const leerTodas = async () => {
    await marcarTodasLeidas();
    const pendientesAlerta = items.filter((n) => n.id.startsWith("alerta:") && !n.leida);
    const pendientesColab = items.filter((n) => n.id.startsWith("colab:") && !n.leida);
    await Promise.all([
      ...pendientesAlerta.map((n) => marcarCasoAlertaLeida(n.id.slice("alerta:".length))),
      ...pendientesColab.map((n) => marcarColabNotifLeida(n.id.slice("colab:".length))),
    ]);
    await reload();
  };

  return { items, unread, loading, reload, leer, leerTodas };
}
