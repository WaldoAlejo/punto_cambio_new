import * as React from "react";

const h = React.createElement;

export type DetalleEstado = {
  moneda_id: string;
  codigo?: string | null;
  nombre?: string | null;
  simbolo?: string | null;

  saldo_apertura?: number;
  ingresos_periodo?: number;
  egresos_periodo?: number;
  saldo_cierre?: number;

  conteo_fisico?: number;
  billetes?: number;
  monedas?: number;
};

export type MonedaRowProps = {
  detalle: DetalleEstado;
  onChange: (moneda_id: string, patch: Partial<DetalleEstado>) => void;
  /** Tolerancia por código de moneda (default: USD ±1, otras ±0.01) */
  getTolerance?: (codigo?: string | null) => number;
};

function n2(v?: number) {
  const n = Number.isFinite(v as number) ? (v as number) : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MonedaRow({
  detalle,
  onChange,
  getTolerance,
}: MonedaRowProps) {
  const tol =
    getTolerance?.(detalle.codigo) ??
    (detalle.codigo?.toUpperCase() === "USD" ? 1 : 0.01);

  const diff = (detalle.conteo_fisico ?? 0) - (detalle.saldo_cierre ?? 0);
  const fueraTol = Math.abs(diff) > tol;
  const diffColor = fueraTol ? "#dc2626" : diff === 0 ? "#6b7280" : "#b45309";

  const TD = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) =>
    h(
      "td",
      {
        style: {
          padding: "8px 4px",
          textAlign: "right",
          ...(props.style || {}),
        },
      },
      props.children
    );

  const LeftTD = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) =>
    h(
      "td",
      {
        style: {
          padding: "8px 4px",
          textAlign: "left",
          ...(props.style || {}),
        },
      },
      props.children
    );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    h("input", props);

  return h(
    "tr",
    { style: { borderTop: "1px solid #e5e7eb" } },
    // Moneda
    h(
      LeftTD,
      { style: { whiteSpace: "nowrap" } },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "span",
          { style: { fontWeight: 600 } },
          detalle.nombre ?? detalle.codigo ?? detalle.moneda_id
        ),
        h(
          "span",
          { style: { fontSize: 12, color: "#6b7280" } },
          `${detalle.codigo ?? ""} ${detalle.simbolo ?? ""}`
        )
      )
    ),
    // Apertura
    h(TD, null, n2(detalle.saldo_apertura)),
    // Ingresos
    h(TD, null, n2(detalle.ingresos_periodo)),
    // Egresos
    h(TD, null, n2(detalle.egresos_periodo)),
    // Teórico (saldo_cierre)
    h(TD, { style: { fontWeight: 600 } }, n2(detalle.saldo_cierre)),
    // Conteo físico (editable)
    h(
      TD,
      null,
      h(Input, {
        inputMode: "decimal",
        value: Number.isFinite(detalle.conteo_fisico)
          ? detalle.conteo_fisico
          : 0,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = parseFloat(e.target.value);
          onChange(detalle.moneda_id, {
            conteo_fisico: Number.isFinite(val) ? val : 0,
          });
        },
        style: { width: 120, padding: "6px 8px", textAlign: "right" },
      })
    ),
    // Billetes (editable)
    h(
      TD,
      null,
      h(Input, {
        inputMode: "numeric",
        value: Number.isFinite(detalle.billetes) ? detalle.billetes : 0,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = parseFloat(e.target.value);
          onChange(detalle.moneda_id, {
            billetes: Number.isFinite(val) ? val : 0,
          });
        },
        style: { width: 90, padding: "6px 8px", textAlign: "right" },
      })
    ),
    // Monedas (editable)
    h(
      TD,
      null,
      h(Input, {
        inputMode: "numeric",
        value: Number.isFinite(detalle.monedas) ? detalle.monedas : 0,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = parseFloat(e.target.value);
          onChange(detalle.moneda_id, {
            monedas: Number.isFinite(val) ? val : 0,
          });
        },
        style: { width: 90, padding: "6px 8px", textAlign: "right" },
      })
    ),
    // Diferencia (coloreada)
    h(TD, { style: { fontWeight: 600, color: diffColor } }, n2(diff))
  );
}
