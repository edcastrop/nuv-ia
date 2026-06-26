import { useEffect, useState } from "react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { CanalChat } from "@/components/colaboracion/CanalChat";
import { getCanalDeAuditoria, type Canal } from "@/lib/colaboracion";
import { MessageSquare } from "lucide-react";

export function ConversacionAuditoria({
  auditoriaId,
  cliente,
  banco,
  participantes,
}: {
  auditoriaId: string;
  cliente: string;
  banco: string;
  participantes: Array<string | null | undefined>;
}) {
  const [canal, setCanal] = useState<Canal | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const nombre = `${cliente || "Cliente"} · ${banco || "Banco"}`;
    getCanalDeAuditoria(auditoriaId, nombre, participantes)
      .then((c) => { if (active) setCanal(c); })
      .catch((e) => { if (active) setErr((e as Error).message); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditoriaId]);

  return (
    <NCard variant="elevated">
      <SectionHeader
        icon={<MessageSquare size={16} />}
        title="Conversación de auditoría"
        description="Hilo en vivo entre auditor y analista vinculado a este dictamen. Toda comunicación queda como evidencia."
      />
      {err && <div className="text-sm" style={{ color: "#FFB4B4" }}>{err}</div>}
      {!canal && !err && (
        <div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          Cargando conversación…
        </div>
      )}
      {canal && (
        <div
          className="h-[480px] rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--nuvia-border)" }}
        >
          <CanalChat canal={canal} />
        </div>
      )}
    </NCard>
  );
}
