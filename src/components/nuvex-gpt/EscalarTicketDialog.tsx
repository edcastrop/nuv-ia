import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NSelect } from "@/components/nuvia/NSelect";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function EscalarTicketDialog({
  open,
  onOpenChange,
  conversacionId,
  preFillDescripcion,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversacionId?: string | null;
  preFillDescripcion?: string;
}) {
  const [area, setArea] = useState<"juridica" | "operaciones" | "contabilidad" | "director_qa" | "soporte">("soporte");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState(preFillDescripcion ?? "");
  const [prioridad, setPrioridad] = useState<"baja" | "media" | "alta" | "urgente">("media");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (asunto.trim().length < 3 || descripcion.trim().length < 3) {
      toast.error("Completa asunto y descripción");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión no disponible");
      const { error } = await supabase.from("gpt_tickets").insert({
        user_id: userId,
        conversacion_id: conversacionId ?? null,
        area,
        asunto,
        descripcion,
        prioridad,
      });
      if (error) throw error;
      toast.success("Ticket creado correctamente");
      onOpenChange(false);
      setAsunto("");
      setDescripcion("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-0 p-0 bg-transparent shadow-none"
      >
        <div className="nuvia-glass-card p-6 sm:p-7 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold tracking-tight">
              Escalar consulta
            </DialogTitle>
            <p className="text-xs text-white/60 mt-1">
              Envía tu caso al área especializada de NUVIA.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80 uppercase tracking-wide">Área</label>
              <NSelect
                value={area}
                onValueChange={(v: string) => setArea(v as typeof area)}
                options={[
                  { value: "juridica", label: "Jurídica" },
                  { value: "operaciones", label: "Operaciones" },
                  { value: "contabilidad", label: "Contabilidad" },
                  { value: "director_qa", label: "Director Financiero QA" },
                  { value: "soporte", label: "Soporte CRM" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80 uppercase tracking-wide">Prioridad</label>
              <NSelect
                value={prioridad}
                onValueChange={(v: string) => setPrioridad(v as typeof prioridad)}
                options={[
                  { value: "baja", label: "Baja" },
                  { value: "media", label: "Media" },
                  { value: "alta", label: "Alta" },
                  { value: "urgente", label: "Urgente" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80 uppercase tracking-wide">Asunto</label>
              <input
                className="nuvia-input w-full"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                maxLength={200}
                placeholder="Describe el asunto en una línea"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/80 uppercase tracking-wide">Descripción</label>
              <textarea
                className="nuvia-input w-full min-h-[140px] resize-y py-2.5"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="Detalla el caso, contexto y qué necesitas del área."
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/80 hover:text-white hover:bg-white/10 border border-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saving}
              className="bg-gradient-to-r from-[#3B82F6] to-[#22C55E] text-white font-semibold hover:opacity-95 shadow-lg shadow-blue-500/20"
            >
              {saving ? "Enviando…" : "Crear ticket"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
