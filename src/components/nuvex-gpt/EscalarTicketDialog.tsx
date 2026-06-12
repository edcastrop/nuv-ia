import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escalar consulta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <Select value={area} onValueChange={(v) => setArea(v as typeof area)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="juridica">Jurídica</SelectItem>
                <SelectItem value="operaciones">Operaciones</SelectItem>
                <SelectItem value="contabilidad">Contabilidad</SelectItem>
                <SelectItem value="director_qa">Director Financiero QA</SelectItem>
                <SelectItem value="soporte">Soporte CRM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Asunto</label>
            <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5} maxLength={4000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Enviando…" : "Crear ticket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
