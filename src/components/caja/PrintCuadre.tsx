import * as React from "react";

const h = React.createElement;

export interface PrintCuadreProps {
  open: boolean;
  onClose: () => void;
  data: {
    fecha: string;
    puntoAtencion?: string;
    detalles: Array<{
      moneda: string;
      codigo: string;
      simbolo: string;
      apertura: number;
      ingresos: number;
      egresos: number;
      teorico: number;
      conteo: number;
      diferencia: number;
    }>;
    totales: {
      ingresos: number;
      egresos: number;
      movimientos: number;
    };
  };
}

function PrintCuadre({ open, onClose, data }: PrintCuadreProps) {
  const handlePrint = () => {
    const printContent = document.getElementById("print-cuadre-content");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(
      "<html><head><title>Cuadre de Caja</title></head><body>"
    );
    win.document.write(printContent.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    win.print();
  };

  if (!open) return null;

  const Box = (p: {
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }) => h("div", { style: p.style, onClick: p.onClick }, p.children);
  const Button = (p: {
    onClick?: () => void;
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => h("button", { onClick: p.onClick, style: p.style }, p.children);

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };
  const dialogStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 700,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  };
  const headerStyle: React.CSSProperties = {
    padding: 12,
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 600,
  };
  const footerStyle: React.CSSProperties = {
    padding: 12,
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  };

  return h(
    Box,
    { style: overlayStyle },
    h(
      Box,
      { style: dialogStyle },
      // Header
      h(
        Box,
        { style: headerStyle },
        h("div", null, "Imprimir Cuadre de Caja"),
        h(
          Button,
          {
            onClick: onClose,
            style: {
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            },
          },
          "Cerrar"
        )
      ),
      // Content
      h(
        "div",
        { id: "print-cuadre-content", style: { padding: 12, fontSize: 14 } },
        h("h3", { style: { marginBottom: 8 } }, `Fecha: ${data.fecha}`),
        h("p", null, `Punto de atención: ${data.puntoAtencion || "N/D"}`),
        h("hr", { style: { margin: "12px 0" } }),
        h(
          "table",
          { style: { width: "100%", borderCollapse: "collapse" } },
          h(
            "thead",
            null,
            h(
              "tr",
              { style: { borderBottom: "1px solid #e5e7eb" } },
              [
                "Moneda",
                "Apertura",
                "Ingresos",
                "Egresos",
                "Teórico",
                "Conteo",
                "Dif.",
              ].map((th, i) =>
                h(
                  "th",
                  { key: i, style: { padding: "6px 4px", textAlign: "right" } },
                  th
                )
              )
            )
          ),
          h(
            "tbody",
            null,
            data.detalles.map((d, i) =>
              h(
                "tr",
                { key: i, style: { borderTop: "1px solid #e5e7eb" } },
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "left" } },
                  `${d.moneda} (${d.codigo} ${d.simbolo})`
                ),
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "right" } },
                  d.apertura.toFixed(2)
                ),
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "right" } },
                  d.ingresos.toFixed(2)
                ),
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "right" } },
                  d.egresos.toFixed(2)
                ),
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "right" } },
                  d.teorico.toFixed(2)
                ),
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "right" } },
                  d.conteo.toFixed(2)
                ),
                h(
                  "td",
                  { style: { padding: "6px 4px", textAlign: "right" } },
                  d.diferencia.toFixed(2)
                )
              )
            )
          )
        ),
        h("hr", { style: { margin: "12px 0" } }),
        h(
          "div",
          null,
          `Totales → Ingresos: ${data.totales.ingresos.toFixed(
            2
          )} | Egresos: ${data.totales.egresos.toFixed(2)} | Movimientos: ${
            data.totales.movimientos
          }`
        )
      ),
      // Footer
      h(
        Box,
        { style: footerStyle },
        h(
          Button,
          {
            onClick: handlePrint,
            style: {
              padding: "8px 12px",
              background: "#111827",
              color: "#fff",
              borderRadius: 8,
            },
          },
          "Imprimir"
        )
      )
    )
  );
}

export default PrintCuadre;
export { PrintCuadre };
