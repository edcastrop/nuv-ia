import { useEffect, useState } from "react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { CanalChat } from "@/components/colaboracion/CanalChat";
import { getCanalDeCaso, type Canal } from "@/lib/colaboracion";
import { MessageSquare } from "lucide-react";

export function ConversacionCaso({ expedienteId, clienteNombre }: { expedienteId: string; clienteNombre: string }) {
  const [canal, setCanal] = useState<Canal | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCanalDeCaso(expedienteId, clienteNombre)
      .then((c) => { if (active) setCanal(c); })
      .catch((e) => { if (active) setErr((e as Error).message); });
    return () => { active = false; };
  }, [expedienteId, clienteNombre]);

  return (
    <NCard variant="elevated">
      <SectionHeader
        icon={<MessageSquare size={16} />}
        title="Conversación del caso"
        description="Toda comunicación queda asociada al expediente. Menciona con @Jurídica, @Operaciones, @Contabilidad."
      />
      {err && <div className="text-sm" style={{ color: "#FFB4B4" }}>{err}</div>}
      {!canal && !err && (
        <div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          Cargando conversación…
        </div>
      )}
      {canal && (
        <div
          className="h-[520px] rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--nuvia-border)" }}
        >
          <CanalChat canal={canal} />
        </div>
      )}
    </NCard>
  );
}
