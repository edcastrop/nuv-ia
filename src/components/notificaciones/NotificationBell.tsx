import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X, ExternalLink } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import type { Notificacion } from "@/lib/notificaciones";

const AZUL = "#445DA3";

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

function sevColor(s: string) {
  return s === "alta" ? "#991B1B" : s === "media" ? "#8A5A00" : "#1F7A45";
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
    setDetalle(n);
    setOpen(false);
    if (!n.leida) {
      void leer(n.id);
    }
  };

  const irAlEnlace = () => {
    if (!detalle?.link) return;
    const link = detalle.link;
    setDetalle(null);
    try {
      if (/^https?:\/\//i.test(link)) {
        window.location.href = link;
      } else {
        router.navigate({ to: link });
      }
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
            className="absolute right-0 mt-2 w-[380px] max-h-[480px] overflow-hidden rounded-2xl bg-white shadow-2xl z-50 flex flex-col"
            style={{ border: "1px solid #E3E7EE" }}
          >
            <div className="flex items-center justify-between border-b border-[#E3E7EE] px-4 py-3">
              <div className="text-sm font-semibold text-[#0A1226]">Notificaciones</div>
              <button
                onClick={leerTodas}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#445DA3] hover:underline disabled:opacity-40"
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
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => abrirDetalle(n)}
                        className={`w-full text-left px-4 py-3 transition hover:bg-[#F1F5FB] ${
                          !n.leida ? "bg-[#F7F9FB]" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ background: sevColor(n.severidad) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-semibold text-[#0A1226] truncate">
                                {n.titulo}
                              </span>
                              {!n.leida && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                                  style={{ background: "#E11D48" }}
                                >
                                  NUEVO
                                </span>
                              )}
                            </div>
                            {n.mensaje && (
                              <div className="mt-0.5 text-[11.5px] text-[#242424]/70 line-clamp-2">
                                {n.mensaje}
                              </div>
                            )}
                            <div className="mt-1 text-[10px] text-[#242424]/50">
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

      {detalle && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetalle(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-start justify-between gap-3 px-5 py-4"
              style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
            >
              <div className="min-w-0 flex-1 text-white">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: sevColor(detalle.severidad) }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    {TIPO_LABEL[detalle.tipo] ?? detalle.tipo} · {sevLabel(detalle.severidad)}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-semibold leading-snug">{detalle.titulo}</h2>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="rounded-lg p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase text-[#242424]/50">Fecha y hora</div>
                <div className="mt-0.5 text-[13px] text-[#0A1226]">
                  {new Date(detalle.created_at).toLocaleString()}
                </div>
              </div>

              {detalle.mensaje && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-[#242424]/50">Descripción</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-[#0A1226]">
                    {detalle.mensaje}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: detalle.leida ? "#EAF7EE" : "#FEF2F2",
                    color: detalle.leida ? "#1F7A45" : "#991B1B",
                  }}
                >
                  {detalle.leida ? "Leída" : "No leída"}
                </span>
              </div>

              {detalle.metadata && Object.keys(detalle.metadata).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-[#242424]/50">
                    Información adicional
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-[#F7F9FB] p-3 text-[11px] text-[#0A1226]">
                    {JSON.stringify(detalle.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E3E7EE] bg-[#F7F9FB] px-5 py-3">
              <button
                onClick={() => setDetalle(null)}
                className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0A1226] hover:bg-[#F1F3F8]"
              >
                Cerrar
              </button>
              {detalle.link && (
                <button
                  onClick={irAlEnlace}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{ background: AZUL }}
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
