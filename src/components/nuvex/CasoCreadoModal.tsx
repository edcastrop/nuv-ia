import { useNavigate } from "@tanstack/react-router";
import type { Expediente } from "@/lib/expedientes";
import { NUVEX } from "./constants";

export function CasoCreadoModal({
  expediente,
  qaEnviada = false,
  onClose,
  onSeguirSimulando,
}: {
  expediente: Expediente;
  qaEnviada?: boolean;
  onClose: () => void;
  onSeguirSimulando?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: NUVEX.verdeTextoFuerte }}>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: NUVEX.verdeFuerte }}>
            ✓
          </span>
          Caso creado correctamente
        </div>
        {qaEnviada && (
          <div className="mt-2 rounded-lg border border-[#BBE3CB] bg-[#EAF7EE] px-3 py-2 text-[12px] font-medium text-[#1F7A45]">
            ✓ Enviado automáticamente a auditoría QA — el Director Financiero recibió la notificación.
          </div>
        )}

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#242424]/60">Cliente</dt>
            <dd className="font-medium text-[#242424] text-right">{expediente.cliente_nombre || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#242424]/60">Banco</dt>
            <dd className="font-medium text-[#242424] text-right">{expediente.banco || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#242424]/60">Producto</dt>
            <dd className="font-medium text-[#242424] text-right">{expediente.producto || "—"}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => {
              onClose();
              navigate({ to: "/casos/$id", params: { id: expediente.id } });
            }}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: NUVEX.azul }}
          >
            Abrir expediente
          </button>
          <button
            onClick={() => {
              onClose();
              onSeguirSimulando?.();
            }}
            className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium text-[#242424] hover:bg-[#F7F9FB]"
            style={{ borderColor: "#E3E7EE" }}
          >
            Seguir simulando
          </button>
        </div>
      </div>
    </div>
  );
}
