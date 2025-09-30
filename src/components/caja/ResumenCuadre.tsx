import * as React from "react";

const h = React.createElement;

export type ResumenMoneda = {
  moneda_id: string;
  moneda?: {
    nombre?: string | null;
    codigo?: string | null;
    simbolo?: string | null;
  } | null;
  ingresos: number;
  egresos: number;
  movimientos: number;
};

export type CierreParcial = {
  id: string;
  fecha: string | Date;
  fecha_cierre?: string | Date | null;
  estado: string;
  puntoAtencion?: { id: string; nombre?: string | null } | null;
};

export interface ResumenCuadreProps {
  resumenContable?: ResumenMoneda[];
  parciales?: CierreParcial[];
  loading?: boolean;
}

function n2(v?: number) {
  const n = Number.isFinite(v as number) ? (v as number) : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ResumenCuadre({
  resumenContable,
  parciales,
  loading,
}: ResumenCuadreProps) {
  // Contenedor principal
  return h(
    "div",
    {
      style: {
        display: "grid",
        gap: 16,
        gridTemplateColumns: "1fr",
        marginTop: 16,
      },
    },
    // Resumen contable
    h(
      "div",
      {
        style: {
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        },
      },
      h(
        "div",
        {
          style: {
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 600,
            fontSize: 14,
          },
        },
        "Resumen contable del día"
      ),
      h(
        "div",
        { style: { padding: 12 } },
        !resumenContable
          ? h(
              "p",
              { style: { fontSize: 14, color: "#6b7280" } },
              "Sin datos de contabilidad."
            )
          : resumenContable.length === 0
          ? h(
              "p",
              { style: { fontSize: 14, color: "#6b7280" } },
              loading ? "Cargando…" : "No hay movimientos."
            )
          : h(
              "div",
              { style: { overflowX: "auto" } },
              h(
                "table",
                {
                  style: {
                    width: "100%",
                    fontSize: 14,
                    borderCollapse: "collapse",
                  },
                },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h(
                      "th",
                      { style: { padding: "8px 4px", textAlign: "left" } },
                      "Moneda"
                    ),
                    h(
                      "th",
                      { style: { padding: "8px 4px", textAlign: "right" } },
                      "Ingresos"
                    ),
                    h(
                      "th",
                      { style: { padding: "8px 4px", textAlign: "right" } },
                      "Egresos"
                    ),
                    h(
                      "th",
                      { style: { padding: "8px 4px", textAlign: "right" } },
                      "Movs"
                    )
                  )
                ),
                h(
                  "tbody",
                  null,
                  resumenContable.map((r) =>
                    h(
                      "tr",
                      {
                        key: r.moneda_id,
                        style: { borderTop: "1px solid #e5e7eb" },
                      },
                      h(
                        "td",
                        { style: { padding: "8px 4px" } },
                        h(
                          "div",
                          {
                            style: { display: "flex", flexDirection: "column" },
                          },
                          h(
                            "span",
                            { style: { fontWeight: 600 } },
                            r.moneda?.nombre ?? r.moneda_id
                          ),
                          h(
                            "span",
                            { style: { fontSize: 12, color: "#6b7280" } },
                            `${r.moneda?.codigo ?? ""} ${
                              r.moneda?.simbolo ?? ""
                            }`
                          )
                        )
                      ),
                      h(
                        "td",
                        { style: { padding: "8px 4px", textAlign: "right" } },
                        n2(r.ingresos)
                      ),
                      h(
                        "td",
                        { style: { padding: "8px 4px", textAlign: "right" } },
                        n2(r.egresos)
                      ),
                      h(
                        "td",
                        { style: { padding: "8px 4px", textAlign: "right" } },
                        r.movimientos
                      )
                    )
                  )
                )
              )
            )
      )
    ),

    // Cierres parciales
    h(
      "div",
      {
        style: {
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        },
      },
      h(
        "div",
        {
          style: {
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 600,
            fontSize: 14,
          },
        },
        "Cierres parciales del día"
      ),
      h(
        "div",
        { style: { padding: 12 } },
        !parciales || parciales.length === 0
          ? h(
              "p",
              { style: { fontSize: 14, color: "#6b7280" } },
              "No hay cierres parciales registrados."
            )
          : h(
              "div",
              { style: { display: "grid", gap: 8 } },
              parciales.map((p) =>
                h(
                  "div",
                  {
                    key: p.id,
                    style: {
                      padding: 12,
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                    },
                  },
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      },
                    },
                    h(
                      "div",
                      { style: { fontSize: 14 } },
                      h(
                        "div",
                        { style: { fontWeight: 600 } },
                        p.puntoAtencion?.nombre ?? p.puntoAtencion?.id ?? ""
                      ),
                      h(
                        "div",
                        { style: { color: "#6b7280", fontSize: 12 } },
                        new Date(p.fecha_cierre ?? p.fecha).toLocaleString()
                      )
                    ),
                    h(
                      "div",
                      {
                        style: {
                          fontSize: 12,
                          padding: "2px 8px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 999,
                        },
                      },
                      p.estado
                    )
                  )
                )
              )
            )
      )
    )
  );
}
