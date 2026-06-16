import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/nuvex/ui";
import { Smartphone, QrCode, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getEstadoMfa,
  iniciarEnrolarTotp,
  confirmarEnrolarTotp,
  desactivarTotp,
} from "@/lib/seguridad.functions";

const AZUL = "#445DA3";
const VERDE = "#84B98F";

export function TotpEnrollmentSection() {
  const cargarEstado = useServerFn(getEstadoMfa);
  const iniciar = useServerFn(iniciarEnrolarTotp);
  const confirmar = useServerFn(confirmarEnrolarTotp);
  const desactivar = useServerFn(desactivarTotp);

  const [estado, setEstado] = useState<"ninguno" | "email" | "totp">("ninguno");
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string; otpauthUrl: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await cargarEstado();
      setEstado(s.metodo);
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const handleIniciar = async () => {
    setBusy(true);
    try {
      const r = await iniciar();
      setQr(r);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar el enrolamiento");
    } finally { setBusy(false); }
  };

  const handleConfirmar = async () => {
    setBusy(true);
    try {
      await confirmar({ data: { codigo } });
      toast.success("App autenticadora activada");
      setQr(null); setCodigo("");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally { setBusy(false); }
  };

  const handleDesactivar = async () => {
    if (!confirm("¿Desactivar la app autenticadora? Volverás a usar código por correo.")) return;
    setBusy(true);
    try {
      await desactivar();
      toast.success("TOTP desactivado");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white"
          style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}
        ><ShieldCheck size={14} /></span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Doble factor (MFA)</h2>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium border"
          style={{
            background: estado === "totp" ? "#EAF7EE" : "#FFF7E6",
            color: estado === "totp" ? "#1F6D3D" : "#92560A",
            borderColor: estado === "totp" ? "#84B98F" : "#FFD89A",
          }}>
          {estado === "totp" ? "App autenticadora activa" : "Solo código por correo"}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </div>
      ) : estado === "totp" ? (
        <div className="space-y-3">
          <p className="text-sm text-white/75">
            Estás usando una app autenticadora (Google Authenticator / Authy / 1Password) para verificar tu acceso. Se te pedirá el código una vez cada 24 horas.
          </p>
          <button
            onClick={handleDesactivar}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-[#F5C2C2] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#B42318] hover:bg-[#FBDADA] disabled:opacity-60"
          ><Trash2 size={13} /> Desactivar app autenticadora</button>
        </div>
      ) : qr ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <img src={qr.qrDataUrl} alt="QR TOTP" className="h-44 w-44 rounded-lg border border-white/10 bg-white p-2" />
            <div className="flex-1 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/65 flex items-center gap-1.5">
                <QrCode size={13} /> Escanea con tu app
              </div>
              <p className="text-[12px] text-white/70">
                Abre Google Authenticator, Authy o 1Password y escanea el QR. Si no puedes escanear, ingresa este código manualmente:
              </p>
              <div className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-mono break-all text-white">
                {qr.secret}
              </div>
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Código de 6 dígitos generado por la app</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="••••••"
              className="mt-1.5 w-full rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-3 text-center text-2xl tracking-[0.4em] font-semibold outline-none focus:border-[#445DA3] focus:bg-white"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmar}
              disabled={busy || codigo.length !== 6}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
            >{busy ? "Verificando…" : "Confirmar y activar"}</button>
            <button
              onClick={() => { setQr(null); setCodigo(""); }}
              disabled={busy}
              className="rounded-xl border border-white/10 bg-white px-4 py-2.5 text-sm font-medium text-white/75 hover:bg-white/[0.05]"
            >Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-white/75">
            Por defecto usamos código por correo. Activa una app autenticadora para verificar tu acceso de forma más rápida y segura — sin depender del correo.
          </p>
          <button
            onClick={handleIniciar}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow disabled:opacity-60"
            style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
          ><Smartphone size={14} /> {busy ? "Generando QR…" : "Configurar app autenticadora"}</button>
        </div>
      )}
    </Card>
  );
}
