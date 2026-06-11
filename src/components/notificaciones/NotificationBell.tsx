import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X, ExternalLink } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import type { Notificacion } from "@/lib/notificaciones";

const TIPO_LABEL: Record<string, string> = {
  usuario_aprobado: "Usuario aprobado",
  usuario_bloqueado: "Usuario bloqueado",
  usuario_reactivado: "Usuario reactivado",
  usuario_desvinculado: "Usuario desvinculado",
  caso_aprobado: "Caso aprobado",
  caso_negado: "Caso negado",
  caso_radicado: "Caso radicado",
  cuenta_cobro_pendiente: "Cuenta de cobro pendiente",
  comision_liberada: "Comisión liberada",
  documento_pendiente: "Documento pendiente",
  alerta_qa: "Alerta QA",
  alerta_juridica: "Alerta jurídica",
  mensaje_interno: "Mensaje interno",
};

function sevColor(s: string): string {
  if (s === "alta") return "var(--nuvia-danger)";
  if (s === "media") return "var(--nuvia-warning)";
  return "var(--nuvia-success)";
}

function sevLabel(s: string) {
  return s === "alta" ? "Alta" : s === "media" ? "Media" : "Baja";
}

export function NotificationBell() {
  const { items, unread, leer, leerTodas } = useNotificaciones();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detalle, setDetalle] = useState<Notificacion | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const abrirDetalle = (n: Notificacion) => {
    if (!n.leida) void leer(n.id);
    setOpen(false);
    if (n.link) {
      const link = n.link;
      try {
        if (/^https?:\/\//i.test(link)) window.location.href = link;
        else router.navigate({ to: link });
      } catch {
        window.location.href = link;
      }
      return;
    }
    setDetalle(n);
  };

  const irAlEnlace = () => {
    if (!detalle?.link) return;
    const link = detalle.link;
    setDetalle(null);
    try {
      if (/^https?:\/\//i.test(link)) window.location.href = link;
      else router.navigate({ to: link });
    } catch {
      window.location.href = link;
    }
  };

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition hover:text-white"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--nuvia-border)",
          }}
          aria-label="Notificaciones"
        >
          <Bell size={16} />
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: "var(--nuvia-danger)" }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div
            className="glass-modal absolute right-0 mt-2 w-[380px] max-h-[480px] overflow-hidden z-50 flex flex-col"
            style={{ color: "var(--nuvia-text-primary)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--nuvia-border)" }}
            >
              <div className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                Notificaciones
              </div>
              <button
                onClick={leerTodas}
                className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline disabled:opacity-40"
                style={{ color: "var(--nuvia-accent-blue)" }}
                disabled={unread === 0}
              >
                <CheckCheck size={12} /> Marcar todas
              </button>
            </div>
            <div className="overflow-y-auto scrollbar-thin">
              {items.length === 0 ? (
                <div
                  className="p-8 text-center text-[12px]"
                  style={{ color: "var(--nuvia-text-secondary)" }}
                >
                  Sin notificaciones
                </div>
              ) : (
                <ul style={{ borderColor: "var(--nuvia-border)" }} className="divide-y divide-white/[0.06]">
                  {items.slice(0, 30).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => abrirDetalle(n)}
                        className="w-full text-left px-4 py-3 transition hover:bg-white/[0.04]"
                        style={{
                          background: !n.leida ? "rgba(68,93,163,0.08)" : "transparent",
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ background: sevColor(n.severidad) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[12.5px] font-semibold truncate"
                                style={{ color: "var(--nuvia-text-primary)" }}
                              >
                                {n.titulo}
                              </span>
                              {!n.leida && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                                  style={{ background: "var(--nuvia-danger)" }}
                                >
                                  NUEVO
                                </span>
                              )}
                            </div>
                            {n.mensaje && (
                              <div
                                className="mt-0.5 text-[11.5px] line-clamp-2"
                                style={{ color: "var(--nuvia-text-secondary)" }}
                              >
                                {n.mensaje}
                              </div>
                            )}
                            <div
                              className="mt-1 text-[10px]"
                              style={{ color: "var(--nuvia-text-secondary)", opacity: 0.7 }}
                            >
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              className="p-2 text-center"
              style={{ borderTop: "1px solid var(--nuvia-border)" }}
            >
              <Link
                to="/notificaciones"
                onClick={() => setOpen(false)}
                className="text-[11px] font-medium hover:underline"
                style={{ color: "var(--nuvia-accent-blue)" }}
              >
                Ver todo el centro de alertas →
              </Link>
            </div>
          </div>
        )}
      </div>

      {detalle && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDetalle(null)}
        >
          <div
            className="glass-modal w-full max-w-lg overflow-hidden"
            style={{ color: "var(--nuvia-text-primary)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-start justify-between gap-3 px-5 py-4"
              style={{ background: "var(--nuvia-gradient-primary)" }}
            >
              <div className="min-w-0 flex-1 text-white">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: sevColor(detalle.severidad) }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/85">
                    {TIPO_LABEL[detalle.tipo] ?? detalle.tipo} · {sevLabel(detalle.severidad)}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-semibold leading-snug">{detalle.titulo}</h2>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="rounded-lg p-1 text-white/85 transition hover:bg-white/15 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <div
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: "var(--nuvia-text-secondary)" }}
                >
                  Fecha y hora
                </div>
                <div
                  className="mt-0.5 text-[13px]"
                  style={{ color: "var(--nuvia-text-primary)" }}
                >
                  {new Date(detalle.created_at).toLocaleString()}
                </div>
              </div>

              {detalle.mensaje && (
                <div>
                  <div
                    className="text-[10px] font-semibold uppercase"
                    style={{ color: "var(--nuvia-text-secondary)" }}
                  >
                    Descripción
                  </div>
                  <div
                    className="mt-0.5 whitespace-pre-wrap text-[13px]"
                    style={{ color: "var(--nuvia-text-primary)" }}
                  >
                    {detalle.mensaje}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: detalle.leida
                      ? "rgba(132,185,143,0.16)"
                      : "rgba(255,107,107,0.16)",
                    color: detalle.leida
                      ? "var(--nuvia-success)"
                      : "var(--nuvia-danger)",
                    border: "1px solid var(--nuvia-border)",
                  }}
                >
                  {detalle.leida ? "Leída" : "No leída"}
                </span>
              </div>

              {detalle.metadata && Object.keys(detalle.metadata).length > 0 && (
                <div>
                  <div
                    className="text-[10px] font-semibold uppercase"
                    style={{ color: "var(--nuvia-text-secondary)" }}
                  >
                    Información adicional
                  </div>
                  <pre
                    className="mt-1 max-h-40 overflow-auto rounded-lg p-3 text-[11px] scrollbar-thin"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--nuvia-border)",
                      color: "var(--nuvia-text-primary)",
                    }}
                  >
                    {JSON.stringify(detalle.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div
              className="flex items-center justify-end gap-2 px-5 py-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderTop: "1px solid var(--nuvia-border)",
              }}
            >
              <button
                onClick={() => setDetalle(null)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/[0.06]"
                style={{
                  border: "1px solid var(--nuvia-border)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--nuvia-text-primary)",
                }}
              >
                Cerrar
              </button>
              {detalle.link && (
                <button
                  onClick={irAlEnlace}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-95"
                  style={{
                    background: "var(--nuvia-gradient-primary)",
                    boxShadow: "var(--nuvia-shadow-sm)",
                  }}
                >
                  <ExternalLink size={12} /> Ir al detalle
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
