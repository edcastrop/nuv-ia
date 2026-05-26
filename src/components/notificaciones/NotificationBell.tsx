import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotificaciones } from "@/hooks/useNotificaciones";

const AZUL = "#445DA3";

export function NotificationBell() {
  const { items, unread, leer, leerTodas } = useNotificaciones();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const sevColor = (s: string) =>
    s === "alta" ? "#991B1B" : s === "media" ? "#8A5A00" : "#1F7A45";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition hover:text-white"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
        aria-label="Notificaciones"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "#E11D48" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] max-h-[480px] overflow-hidden rounded-2xl bg-white shadow-2xl z-50 flex flex-col"
          style={{ border: "1px solid #E3E7EE" }}
        >
          <div className="flex items-center justify-between border-b border-[#E3E7EE] px-4 py-3">
            <div className="text-sm font-semibold text-[#0A1226]">Notificaciones</div>
            <button
              onClick={leerTodas}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#445DA3] hover:underline"
              disabled={unread === 0}
            >
              <CheckCheck size={12} /> Marcar todas
            </button>
          </div>
          <div className="overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-[#242424]/60">Sin notificaciones</div>
            ) : (
              <ul className="divide-y divide-[#F1F3F8]">
                {items.slice(0, 30).map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 ${!n.leida ? "bg-[#F7F9FB]" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block h-2 w-2 rounded-full"
                        style={{ background: sevColor(n.severidad) }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {n.link ? (
                            <a
                              href={n.link}
                              onClick={() => { leer(n.id); setOpen(false); }}
                              className="text-[12.5px] font-semibold text-[#0A1226] hover:text-[#445DA3] truncate"
                            >
                              {n.titulo}
                            </a>
                          ) : (
                            <span className="text-[12.5px] font-semibold text-[#0A1226] truncate">{n.titulo}</span>
                          )}
                        </div>
                        {n.mensaje && (
                          <div className="mt-0.5 text-[11.5px] text-[#242424]/70 line-clamp-2">{n.mensaje}</div>
                        )}
                        <div className="mt-1 text-[10px] text-[#242424]/50">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                      {!n.leida && (
                        <button
                          onClick={() => leer(n.id)}
                          title="Marcar leída"
                          className="text-[#1F7A45] hover:opacity-70"
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-[#E3E7EE] p-2 text-center">
            <Link
              to="/notificaciones"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium hover:underline"
              style={{ color: AZUL }}
            >
              Ver todo el centro de alertas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
