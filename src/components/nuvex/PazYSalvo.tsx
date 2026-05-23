import { NUVEX } from "./constants";
import { formatCOP, formatNumber } from "../../lib/format";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import type { ClientData } from "./ClientFields";
import logoNuvex from "@/assets/logo-nuvex.png";


const NUVEX_GRADIENT = `linear-gradient(135deg, ${NUVEX.negro} 0%, ${NUVEX.azul} 100%)`;

const printShell: React.CSSProperties = {
  position: "absolute",
  left: "-99999px",
  top: 0,
  width: "794px",
  backgroundColor: "#FFFFFF",
  fontFamily: "Inter, system-ui, sans-serif",
  color: NUVEX.negro,
};

export interface PazYSalvoData {
  fechaAprobacion: string;
  fechaPago: string;
  honorariosPagados: number;
  ahorroLogrado: number;
  añosEliminados: number;
}

interface Props {
  client: ClientData;
  data: PazYSalvoData;
  /** Visible solo cuando el caso está en estado PAGADO. */
  enabled: boolean;
}

export function PazYSalvo({ client, data, enabled }: Props) {
  if (!enabled) return null;
  const elementId = "pdf-paz-y-salvo";
  const handleExport = () =>
    exportElementToPdf(
      elementId,
      `NUVEX_PazYSalvo_${sanitizeFileName(client.nombre)}.pdf`,
    );

  return (
    <>
      <button
        onClick={handleExport}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
        style={{ background: NUVEX_GRADIENT }}
      >
        Generar paz y salvo
      </button>
      <PazYSalvoDocument id={elementId} client={client} data={data} />
    </>
  );
}

function PazYSalvoDocument({
  id,
  client,
  data,
}: {
  id: string;
  client: ClientData;
  data: PazYSalvoData;
}) {
  return (
    <div id={id} style={printShell}>
      {/* Marco premium */}
      <div
        style={{
          padding: 14,
          background: NUVEX_GRADIENT,
          position: "relative",
        }}
      >
        <div style={{ background: "#fff", padding: "44px 52px 36px", border: "1px solid #E3E7EE", position: "relative", overflow: "hidden" }}>
          {/* Marca de agua institucional 5% */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
            <img src={logoNuvex} alt="" style={{ width: "75%", maxWidth: "180mm", opacity: 0.05, transform: "rotate(-28deg)", objectFit: "contain" }} draggable={false} />
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `3px solid ${NUVEX.azul}`, paddingBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src={logoNuvex} alt="NUVEX" style={{ height: 72, width: "auto" }} draggable={false} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2, color: NUVEX.negro }}>NUVEX FINANZAS INTELIGENTES</div>
                <div style={{ fontSize: 10, letterSpacing: 1.8, color: NUVEX.azul, fontWeight: 700, marginTop: 3 }}>
                  Bogotá | Bucaramanga
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 9.5, color: "#5C6770" }}>
              <div style={{ fontWeight: 800, letterSpacing: 2, color: NUVEX.negro }}>DOCUMENTO OFICIAL</div>
              <div style={{ marginTop: 2 }}>{new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>


          {/* Título */}
          <div style={{ textAlign: "center", marginTop: 38 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 4, color: NUVEX.azul }}>
              CERTIFICACIÓN
            </div>
            <h1
              style={{
                fontSize: 42,
                fontWeight: 900,
                letterSpacing: 6,
                margin: "12px 0 6px",
                color: NUVEX.negro,
              }}
            >
              PAZ Y SALVO
            </h1>
            <div
              style={{
                margin: "10px auto 0",
                width: 90,
                height: 3,
                background: NUVEX.verde,
                borderRadius: 999,
              }}
            />
          </div>

          {/* Certificación */}
          <div style={{ marginTop: 34, fontSize: 12, lineHeight: 1.75, color: NUVEX.negro, textAlign: "justify" }}>
            <div style={{ fontWeight: 800, textAlign: "center", letterSpacing: 1, marginBottom: 6 }}>
              NUVEX FINANZAS INTELIGENTES S.A.S.
            </div>
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 4, fontWeight: 800, color: NUVEX.azul, marginBottom: 18 }}>
              CERTIFICA
            </div>

            <div>
              Que el cliente{" "}
              <span style={{ fontWeight: 800 }}>{client.nombre || "—"}</span>, identificado con cédula
              de ciudadanía No. <span style={{ fontWeight: 800 }}>{client.cedula || "—"}</span>, se
              encuentra a <span style={{ fontWeight: 800 }}>PAZ Y SALVO</span> por todo concepto
              relacionado con los servicios tecnológicos y financieros prestados por{" "}
              <span style={{ fontWeight: 800 }}>NUVEX</span> respecto al proceso de optimización de su
              crédito hipotecario o leasing habitacional.
            </div>
          </div>

          {/* Bloque resultados */}
          <div
            style={{
              marginTop: 28,
              border: `1px solid ${NUVEX.verde}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div style={{ background: NUVEX.verdeClaro, padding: "10px 18px", fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: NUVEX.verdeTextoFuerte }}>
              RESULTADO DEL PROCESO
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "16px 18px", gap: "10px 24px" }}>
              <Field label="Banco" value={client.banco || "—"} />
              <Field label="N° de crédito" value={client.numeroCredito || "—"} />
              <Field label="Producto" value={client.tipoProducto || "—"} />
              <Field label="Fecha de aprobación" value={data.fechaAprobacion || "—"} />
              <Field label="Años eliminados" value={`${formatNumber(data.añosEliminados, 1)} años`} accent />
              <Field label="Ahorro logrado" value={formatCOP(data.ahorroLogrado)} accent />
              <Field label="Honorarios cancelados" value={formatCOP(data.honorariosPagados)} accent />
              <Field label="Fecha de pago" value={data.fechaPago || "—"} accent />
            </div>
          </div>

          {/* Felicitaciones */}
          <div
            style={{
              marginTop: 22,
              padding: "20px 24px",
              borderRadius: 14,
              background: `linear-gradient(135deg, ${NUVEX.verdeClaro} 0%, #FFFFFF 100%)`,
              border: `1px solid ${NUVEX.verde}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: NUVEX.verdeTextoFuerte }}>
              ¡FELICITACIONES!
            </div>
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.65, color: NUVEX.negro }}>
              Nos llena de satisfacción haber contribuido al mejoramiento de las condiciones
              financieras de tu crédito. Gracias por confiar en NUVEX Finanzas Inteligentes. El
              resultado obtenido representa una decisión inteligente que impactará positivamente tu
              economía durante los próximos años. Esperamos que este ahorro en tiempo, intereses y
              seguros contribuya al cumplimiento de tus metas financieras y familiares.
            </div>
          </div>

          {/* Referidos */}
          <div
            style={{
              marginTop: 16,
              padding: "20px 24px",
              borderRadius: 14,
              background: NUVEX_GRADIENT,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2.5, opacity: 0.95 }}>
              AYÚDANOS A AYUDAR A MÁS FAMILIAS
            </div>
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.65, opacity: 0.95 }}>
              Miles de colombianos aún desconocen que pueden optimizar su crédito hipotecario o
              leasing habitacional. Si conoces familiares, amigos o compañeros de trabajo con
              crédito de vivienda, estaremos encantados de realizar un diagnóstico financiero
              personalizado. Tu recomendación puede ayudarles a ahorrar tiempo, dinero e intereses.
            </div>
          </div>

          {/* Testimonial */}
          <div
            style={{
              marginTop: 16,
              padding: "18px 22px",
              borderRadius: 14,
              border: `1px dashed ${NUVEX.azul}`,
              background: "#F4F6FC",
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2.5, color: NUVEX.azul }}>
              TU EXPERIENCIA ES MUY VALIOSA
            </div>
            <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.65, color: NUVEX.negro }}>
              Si el servicio recibido cumplió tus expectativas, te invitamos cordialmente a
              compartir un breve video testimonial. Tu experiencia puede inspirar y ayudar a otras
              familias que hoy enfrentan los mismos desafíos financieros que tú ya lograste superar.
            </div>
          </div>

          {/* Cierre + firma */}
          <div style={{ marginTop: 26, fontSize: 11, lineHeight: 1.7, color: NUVEX.negro }}>
            Gracias por permitirnos acompañarte en este importante logro financiero.
          </div>

          <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ width: 220, borderTop: `1px solid ${NUVEX.negro}`, paddingTop: 6, fontSize: 10, color: "#5C6770", textAlign: "center" }}>
                Equipo NUVEX Finanzas Inteligentes
              </div>
            </div>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                border: `2px solid ${NUVEX.verde}`,
                color: NUVEX.verdeTextoFuerte,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                textAlign: "center",
                fontSize: 9,
                letterSpacing: 1.6,
              }}
            >
              <div>PAZ Y</div>
              <div>SALVO</div>
              <div style={{ marginTop: 4, fontSize: 8, opacity: 0.8 }}>NUVEX</div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 30,
              paddingTop: 14,
              borderTop: "1px solid #E3E7EE",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9.5,
              color: "#5C6770",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: NUVEX.negro, letterSpacing: 1 }}>NUVEX FINANZAS INTELIGENTES</div>
              <div style={{ marginTop: 2 }}>Carrera 16 # 37-48 Piso 4 · Centro de Bucaramanga</div>
              <div>Bogotá | Bucaramanga</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div>www.nuvex.com.co</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 8.5,
          fontWeight: 800,
          letterSpacing: 1.4,
          color: accent ? NUVEX.verdeTextoFuerte : "#8892A0",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 12.5,
          fontWeight: 800,
          color: accent ? NUVEX.verdeTextoFuerte : NUVEX.negro,
        }}
      >
        {value}
      </div>
    </div>
  );
}
