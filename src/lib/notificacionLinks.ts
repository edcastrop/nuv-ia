import type { Notificacion } from "@/lib/notificaciones";

type NotificationLike = Pick<Notificacion, "tipo" | "link" | "metadata">;

const uuidLike = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function cleanInternalPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed;
}

export function resolveNotificationHref(n: NotificationLike): string | null {
  const meta = n.metadata ?? {};
  const tipo = String(n.tipo ?? "").toLowerCase();
  const link = cleanInternalPath(n.link ?? "");
  const auditoriaId = meta.auditoria_id ?? meta.qa_auditoria_id;
  const expedienteId = meta.expediente_id;
  const carteraId = meta.cartera_id;
  const canalId = meta.canal_id;

  if ((link === "/qa" || link === "/qa-ai") && uuidLike(auditoriaId)) return `/qa-ai/${auditoriaId}`;
  if ((link === "/qa" || link === "/qa-ai") && uuidLike(expedienteId)) return `/casos/${expedienteId}`;
  if (link === "/qa") return "/qa-ai";
  if (link) return link;

  if (uuidLike(auditoriaId)) return `/qa-ai/${auditoriaId}`;
  if (uuidLike(expedienteId)) return `/casos/${expedienteId}`;
  if (uuidLike(carteraId)) return `/cartera/${carteraId}`;
  if (uuidLike(canalId)) return tipo.includes("dm") ? `/colaboracion/dm/${canalId}` : `/colaboracion?canal=${canalId}`;
  if (tipo.includes("incidente")) return "/incidentes";
  return null;
}

export function navigateToNotification(n: NotificationLike): boolean {
  const href = resolveNotificationHref(n);
  if (!href || typeof window === "undefined") return false;

  if (/^https?:\/\//i.test(href)) {
    const target = new URL(href, window.location.origin);
    window.location.assign(target.href);
    return true;
  }

  const target = new URL(href, window.location.origin);
  window.location.assign(`${target.pathname}${target.search}${target.hash}`);
  return true;
}