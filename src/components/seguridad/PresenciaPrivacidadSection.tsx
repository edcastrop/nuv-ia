import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function PresenciaPrivacidadSection() {
  const { user } = useAuth();
  const [visible, setVisible] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("presencia_visible")
        .eq("id", user.id)
        .maybeSingle();
      const v = (data as { presencia_visible?: boolean } | null)?.presencia_visible;
      setVisible(v !== false);
    })();
  }, [user?.id]);

  const toggle = async () => {
    if (!user || visible === null) return;
    setSaving(true);
    const nuevo = !visible;
    const { error } = await supabase
      .from("profiles")
      .update({ presencia_visible: nuevo } as never)
      .eq("id", user.id);
    setSaving(false);
    if (!error) {
      setVisible(nuevo);
      // Recargar para que el cambio tome efecto en el canal de presencia.
      setTimeout(() => window.location.reload(), 300);
    }
  };

  if (visible === null) return null;

  return (
    <div className="rounded-2xl border border-[#E3E7EE] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {visible ? <Eye size={16} className="text-[#445DA3]" /> : <EyeOff size={16} className="text-[#242424]/50" />}
            <h3 className="text-[14px] font-semibold text-[#242424]">Estado en línea</h3>
          </div>
          <p className="mt-1.5 text-[12px] text-[#242424]/65 leading-relaxed">
            {visible
              ? "El equipo puede ver cuándo estás en línea y tu última conexión, similar a WhatsApp."
              : "Tu estado está oculto. El equipo siempre te verá como desconectado."}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#F7F9FB] disabled:opacity-50"
        >
          {visible ? "Ocultar mi estado" : "Mostrar mi estado"}
        </button>
      </div>
    </div>
  );
}
