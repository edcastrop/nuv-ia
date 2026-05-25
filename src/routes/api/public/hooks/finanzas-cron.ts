// Cron diario de finanzas NUVEX: regenera alertas IA (cartera vencida, CC demoradas).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/finanzas-cron")({
  server: {
    handlers: {
      POST: async () => {
        const hoy = new Date();
        let creadas = 0;

        // 1) Cartera vencida sin pago total
        const { data: cart, error: e1 } = await supabaseAdmin
          .from("cartera" as never)
          .select("id, expediente_id, fecha_vencimiento, honorarios_totales, pagado, estado_cartera");
        if (e1) return Response.json({ ok: false, error: e1.message }, { status: 500 });

        for (const c of (cart ?? []) as unknown as Array<{
          id: string; expediente_id: string; fecha_vencimiento: string;
          honorarios_totales: number; pagado: number; estado_cartera: string;
        }>) {
          if (["pago_total", "cerrado"].includes(c.estado_cartera)) continue;
          const saldo = Number(c.honorarios_totales) - Number(c.pagado);
          if (saldo <= 0) continue;
          const dias = Math.floor((hoy.getTime() - new Date(c.fecha_vencimiento).getTime()) / 86400000);
          if (dias <= 30) continue;

          const { data: existe } = await supabaseAdmin
            .from("finanzas_alertas" as never)
            .select("id")
            .eq("cartera_id", c.id)
            .eq("tipo", "cartera_vencida")
            .eq("leida", false)
            .maybeSingle();
          if (existe) continue;

          await supabaseAdmin.from("finanzas_alertas" as never).insert({
            tipo: "cartera_vencida",
            severidad: dias > 60 ? "alta" : "media",
            cartera_id: c.id,
            expediente_id: c.expediente_id,
            titulo: `Cartera vencida ${dias} días`,
            mensaje_ia: `Saldo $${Math.round(saldo).toLocaleString("es-CO")} sin pagar. Sugerido: contacto WhatsApp + recordatorio email.`,
          } as never);
          creadas++;
        }

        // 2) Cuentas de cobro enviadas > 7 días sin aprobar
        const { data: ccs } = await supabaseAdmin
          .from("cuentas_cobro" as never)
          .select("id, numero, total, fecha_envio, estado")
          .eq("estado", "enviada");
        for (const cc of (ccs ?? []) as unknown as Array<{
          id: string; numero: string; total: number; fecha_envio: string;
        }>) {
          if (!cc.fecha_envio) continue;
          const dias = Math.floor((hoy.getTime() - new Date(cc.fecha_envio).getTime()) / 86400000);
          if (dias <= 7) continue;

          const { data: existe } = await supabaseAdmin
            .from("finanzas_alertas" as never)
            .select("id")
            .eq("cuenta_cobro_id", cc.id)
            .eq("tipo", "cc_demorada")
            .eq("leida", false)
            .maybeSingle();
          if (existe) continue;

          await supabaseAdmin.from("finanzas_alertas" as never).insert({
            tipo: "cc_demorada",
            severidad: dias > 15 ? "alta" : "media",
            cuenta_cobro_id: cc.id,
            titulo: `CC ${cc.numero} sin aprobar (${dias}d)`,
            mensaje_ia: `Total $${Math.round(Number(cc.total)).toLocaleString("es-CO")}. Sugerido: reenviar a Contabilidad o escalar a Gerencia.`,
          } as never);
          creadas++;
        }

        return Response.json({ ok: true, creadas });
      },
    },
  },
});
