import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  contarNoLeidas,
  listMisNotificaciones,
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
    const [lst, c] = await Promise.all([listMisNotificaciones(), contarNoLeidas()]);
    setItems(lst);
    setUnread(c);
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
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, reload]);

  const leer = async (id: string) => {
    await marcarLeida(id);
    await reload();
  };
  const leerTodas = async () => {
    await marcarTodasLeidas();
    await reload();
  };

  return { items, unread, loading, reload, leer, leerTodas };
}
