import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
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
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={18} className="text-[#445DA3]" />
        <div>
          <h3 className="text-base font-semibold text-[#242424]">💬 Conversación del Caso</h3>
          <div className="text-[11px] text-[#242424]/60">
            Toda comunicación queda asociada al expediente. Menciona con @Jurídica, @Operaciones, @Contabilidad.
          </div>
        </div>
      </div>
      {err && <div className="text-sm text-[#B42318]">{err}</div>}
      {!canal && !err && <div className="text-sm text-[#242424]/60">Cargando conversación…</div>}
      {canal && (
        <div className="h-[520px] rounded-lg border border-[#E3E7EE] overflow-hidden">
          <CanalChat canal={canal} />
        </div>
      )}
    </Card>
  );
}
