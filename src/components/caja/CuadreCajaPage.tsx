import * as React from "react";
import useCuadreCaja from "../../hooks/useCuadreCaja";

// Alias corto para createElement
const h = React.createElement;

function n2(v?: number | any) {
  // Validación defensiva para evitar renderizar objetos
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = { pointId?: string };

export default function CuadreCajaPage({ pointId }: Props) {
  const [fecha, setFecha] = React.useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [allowMismatch, setAllowMismatch] = React.useState(false);

  const {
    loading,
    saving,
    error,
    cuadre,
    contabilidad,
    parciales,
    estado,
    setObservaciones,
    setFecha: setFechaHook,
    updateConteo,
    resetConteos,
    totales,
    diferencias,
    puedeCerrar,
    refresh,
    guardarParcial,
    guardarCerrado,
  } = useCuadreCaja({ fecha, pointId, withContabilidad: !!pointId });

  const hayFueraTolerancia = React.useMemo(
    () => diferencias.some((d) => d.fueraDeTolerancia),
    [diferencias]
  );

  const onGuardarParcial = async () => {
    const resp = await guardarParcial({ allowMismatch });
    if (!resp?.success && error)
      alert(`No se pudo guardar el parcial: ${error}`);
    else if (resp?.success)
      alert(`Cierre parcial guardado. ID: ${resp.cuadre_id}`);
  };

  const onGuardarCerrado = async () => {
    const resp = await guardarCerrado({ allowMismatch });
    if (!resp?.success && error) alert(`No se pudo cerrar la caja: ${error}`);
    else if (resp?.success)
      alert(`Cierre de caja realizado. ID: ${resp.cuadre_id}`);
  };

  const onRefresh = async () => {
    await refresh();
    console.log("Datos actualizados");
  };

  const onChangeFecha = (val: string) => {
    setFecha(val);
    setFechaHook(val);
  };

  // ---------- UI helpers sin JSX ----------
  const Box = (props: {
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }) => h("div", { style: props.style }, props.children);

  const Label = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
    htmlFor?: string;
  }) =>
    h("label", { style: props.style, htmlFor: props.htmlFor }, props.children);

  const Button = (props: {
    onClick?: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) =>
    h(
      "button",
      { onClick: props.onClick, disabled: props.disabled, style: props.style },
      props.children
    );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    h("input", { ...props });
  const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    h("textarea", { ...props });

  const Table = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) =>
    h(
      "table",
      {
        style: {
          width: "100%",
          fontSize: 14,
          borderCollapse: "collapse",
          ...(props.style || {}),
        },
      },
      props.children
    );
  const THead = (props: { children?: React.ReactNode }) =>
    h("thead", null, props.children);
  const TBody = (props: { children?: React.ReactNode }) =>
    h("tbody", null, props.children);
  const TR = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => h("tr", { style: props.style }, props.children);
  const TH = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => h("th", { style: props.style }, props.children);
  const TD = (props: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
    colSpan?: number;
  }) => h("td", { style: props.style, colSpan: props.colSpan }, props.children);
  const HR = (props: { style?: React.CSSProperties }) =>
    h("hr", { style: props.style });

  // ---------- Render ----------
  return h(
    Box,
    { style: { maxWidth: 1200, margin: "0 auto", padding: 16 } },
    // Filtros / Acciones
    h(
      Box,
      {
        style: {
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 12,
        },
      },
      h(
        Box,
        {
          style: {
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          },
        },
        h(
          Label,
          { style: { display: "grid", gap: 4 } },
          h("span", { style: { fontSize: 12 } }, "Fecha (GYE)"),
          h(Input, {
            id: "fecha",
            type: "date",
            value: fecha,
            onChange: (e: any) => onChangeFecha(e.target.value),
            style: { width: 180, padding: "6px 8px" },
          })
        ),
        h(
          Button,
          {
            onClick: onRefresh,
            disabled: loading,
            style: { padding: "6px 10px" },
          },
          loading ? "Actualizando…" : "Actualizar"
        )
      ),
      h(
        Box,
        { style: { display: "flex", gap: 12, alignItems: "center" } },
        h(
          Label,
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
            },
          },
          h(Input, {
            type: "checkbox",
            checked: allowMismatch,
            onChange: (e: any) => setAllowMismatch(!!e.target.checked),
          }),
          "Permitir diferencia"
        ),
        h(
          Button,
          { onClick: resetConteos, style: { padding: "6px 10px" } },
          "Reset conteos"
        )
      )
    ),

    // Error
    error
      ? h(
          Box,
          {
            style: {
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 14,
            },
          },
          error
        )
      : null,

    // Card Cuadre
    h(
      Box,
      {
        style: {
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        },
      },
      h(
        Box,
        {
          style: {
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          },
        },
        h(Box, { style: { fontWeight: 600 } }, "Cuadre de Caja"),
        h(
          Box,
          {
            style: {
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 999,
              background: hayFueraTolerancia ? "#fee2e2" : "#f3f4f6",
              color: hayFueraTolerancia ? "#991b1b" : "#111827",
            },
          },
          hayFueraTolerancia
            ? "Diferencias fuera de tolerancia"
            : "Sin diferencias relevantes"
        )
      ),

      h(
        Box,
        { style: { padding: 12 } },
        h(
          Box,
          { style: { overflowX: "auto" } },
          h(
            Table,
            null,
            h(
              THead,
              null,
              h(
                TR,
                { style: { textAlign: "left" as const } },
                h(TH, { style: { padding: "8px 4px" } }, "Moneda"),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Apertura"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Ingresos"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Egresos"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Teórico"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Conteo físico"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Billetes"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Monedas"
                ),
                h(
                  TH,
                  {
                    style: { padding: "8px 4px", textAlign: "right" as const },
                  },
                  "Diferencia"
                )
              )
            ),
            h(
              TBody,
              null,
              estado.detalles.length > 0
                ? estado.detalles.map((d) => {
                    const conteoFisico =
                      typeof d.conteo_fisico === "number" ? d.conteo_fisico : 0;
                    const saldoCierre =
                      typeof d.saldo_cierre === "number" ? d.saldo_cierre : 0;
                    const diff = conteoFisico - saldoCierre;
                    const fueraTol =
                      Math.abs(diff) >
                      (d.codigo?.toUpperCase() === "USD" ? 1 : 0.01);
                    const diffColor = fueraTol
                      ? "#dc2626"
                      : diff === 0
                      ? "#6b7280"
                      : "#b45309";
                    return h(
                      TR,
                      {
                        key: d.moneda_id,
                        style: { borderTop: "1px solid #e5e7eb" },
                      },
                      h(
                        TD,
                        { style: { padding: "8px 4px", whiteSpace: "nowrap" } },
                        h(
                          Box,
                          {
                            style: { display: "flex", flexDirection: "column" },
                          },
                          h("span", { style: { fontWeight: 600 } }, d.nombre),
                          h(
                            "span",
                            { style: { fontSize: 12, color: "#6b7280" } },
                            `${d.codigo} ${d.simbolo}`
                          )
                        )
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        n2(d.saldo_apertura)
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        n2(d.ingresos_periodo)
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        n2(d.egresos_periodo)
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                            fontWeight: 600,
                          },
                        },
                        n2(d.saldo_cierre)
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        h(Input, {
                          inputMode: "decimal",
                          value:
                            typeof d.conteo_fisico === "number" &&
                            Number.isFinite(d.conteo_fisico)
                              ? d.conteo_fisico
                              : 0,
                          onChange: (e: any) => {
                            const val = parseFloat(e.target.value);
                            updateConteo(d.moneda_id, {
                              conteo_fisico: Number.isFinite(val) ? val : 0,
                            });
                          },
                          style: {
                            width: 120,
                            padding: "6px 8px",
                            textAlign: "right",
                          },
                        })
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        h(Input, {
                          inputMode: "numeric",
                          value:
                            typeof d.billetes === "number" &&
                            Number.isFinite(d.billetes)
                              ? d.billetes
                              : 0,
                          onChange: (e: any) => {
                            const val = parseFloat(e.target.value);
                            updateConteo(d.moneda_id, {
                              billetes: Number.isFinite(val) ? val : 0,
                            });
                          },
                          style: {
                            width: 90,
                            padding: "6px 8px",
                            textAlign: "right",
                          },
                        })
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        h(Input, {
                          inputMode: "numeric",
                          value:
                            typeof d.monedas === "number" &&
                            Number.isFinite(d.monedas)
                              ? d.monedas
                              : 0,
                          onChange: (e: any) => {
                            const val = parseFloat(e.target.value);
                            updateConteo(d.moneda_id, {
                              monedas: Number.isFinite(val) ? val : 0,
                            });
                          },
                          style: {
                            width: 90,
                            padding: "6px 8px",
                            textAlign: "right",
                          },
                        })
                      ),
                      h(
                        TD,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                            fontWeight: 600,
                            color: diffColor,
                          },
                        },
                        n2(diff)
                      )
                    );
                  })
                : h(
                    TR,
                    null,
                    h(
                      TD,
                      {
                        colSpan: 9,
                        style: {
                          padding: 24,
                          textAlign: "center" as const,
                          color: "#6b7280",
                        },
                      },
                      loading ? "Cargando…" : "No hay monedas para mostrar"
                    )
                  )
            )
          )
        ),
        h(
          Box,
          { style: { marginTop: 8, fontSize: 14, color: "#6b7280" } },
          `Totales — Ingresos: ${n2(totales.ingresos)} · Egresos: ${n2(
            totales.egresos
          )} · Movs: ${totales.movimientos}`
        ),
        h(HR, { style: { margin: "16px 0", borderTop: "1px solid #e5e7eb" } }),
        h(
          Box,
          { style: { display: "grid", gap: 8 } },
          h(
            Label,
            { htmlFor: "obs", style: { fontSize: 14 } },
            "Observaciones"
          ),
          h(Textarea, {
            id: "obs",
            placeholder: "Notas del cierre, incidencias, soportes…",
            value: estado.observaciones,
            onChange: (e: any) => setObservaciones(e.target.value),
            style: { minHeight: 90, padding: "8px 10px" },
          })
        ),
        h(
          Box,
          {
            style: {
              marginTop: 16,
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            },
          },
          h(
            Box,
            { style: { fontSize: 12, color: "#6b7280" } },
            cuadre?.totales
              ? `Cambios: ${
                  typeof cuadre.totales.cambios?.cantidad === "number"
                    ? cuadre.totales.cambios.cantidad
                    : 0
                } · Transf. In: ${
                  typeof cuadre.totales.transferencias_entrada?.cantidad ===
                  "number"
                    ? cuadre.totales.transferencias_entrada.cantidad
                    : 0
                } · Transf. Out: ${
                  typeof cuadre.totales.transferencias_salida?.cantidad ===
                  "number"
                    ? cuadre.totales.transferencias_salida.cantidad
                    : 0
                }`
              : null
          ),
          h(
            Box,
            { style: { display: "flex", gap: 8 } },
            h(
              Button,
              {
                onClick: onGuardarParcial,
                disabled: saving || loading,
                style: { padding: "8px 12px" },
              },
              "Guardar parcial"
            ),
            h(
              Button,
              {
                onClick: onGuardarCerrado,
                disabled: saving || loading || !puedeCerrar,
                style: { padding: "8px 12px" },
              },
              "Cerrar caja"
            )
          )
        )
      )
    ),

    // Paneles inferiores
    h(
      Box,
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
        Box,
        {
          style: {
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          },
        },
        h(
          Box,
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
          Box,
          { style: { padding: 12 } },
          !contabilidad
            ? h(
                "p",
                { style: { fontSize: 14, color: "#6b7280" } },
                "Sin datos de contabilidad para esta vista."
              )
            : contabilidad.resumen.length === 0
            ? h(
                "p",
                { style: { fontSize: 14, color: "#6b7280" } },
                "No hay movimientos."
              )
            : h(
                Box,
                { style: { overflowX: "auto" } },
                h(
                  Table,
                  null,
                  h(
                    THead,
                    null,
                    h(
                      TR,
                      null,
                      h(
                        TH,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "left" as const,
                          },
                        },
                        "Moneda"
                      ),
                      h(
                        TH,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        "Ingresos"
                      ),
                      h(
                        TH,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        "Egresos"
                      ),
                      h(
                        TH,
                        {
                          style: {
                            padding: "8px 4px",
                            textAlign: "right" as const,
                          },
                        },
                        "Movs"
                      )
                    )
                  ),
                  h(
                    TBody,
                    null,
                    contabilidad.resumen.map((r) =>
                      h(
                        TR,
                        {
                          key: r.moneda_id,
                          style: { borderTop: "1px solid #e5e7eb" },
                        },
                        h(
                          TD,
                          { style: { padding: "8px 4px" } },
                          h(
                            Box,
                            {
                              style: {
                                display: "flex",
                                flexDirection: "column",
                              },
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
                          TD,
                          {
                            style: {
                              padding: "8px 4px",
                              textAlign: "right" as const,
                            },
                          },
                          n2(r.ingresos)
                        ),
                        h(
                          TD,
                          {
                            style: {
                              padding: "8px 4px",
                              textAlign: "right" as const,
                            },
                          },
                          n2(r.egresos)
                        ),
                        h(
                          TD,
                          {
                            style: {
                              padding: "8px 4px",
                              textAlign: "right" as const,
                            },
                          },
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
        Box,
        {
          style: {
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          },
        },
        h(
          Box,
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
          Box,
          { style: { padding: 12 } },
          !parciales || parciales.length === 0
            ? h(
                "p",
                { style: { fontSize: 14, color: "#6b7280" } },
                "No hay cierres parciales registrados."
              )
            : h(
                Box,
                { style: { display: "grid", gap: 8 } },
                parciales.map((p) =>
                  h(
                    Box,
                    {
                      key: p.id,
                      style: {
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                      },
                    },
                    h(
                      Box,
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        },
                      },
                      h(
                        Box,
                        { style: { fontSize: 14 } },
                        h(
                          Box,
                          { style: { fontWeight: 600 } },
                          p.puntoAtencion?.nombre ?? p.puntoAtencion?.id
                        ),
                        h(
                          Box,
                          { style: { color: "#6b7280", fontSize: 12 } },
                          new Date(
                            (p as any).fecha_cierre ?? (p as any).fecha
                          ).toLocaleString()
                        )
                      ),
                      h(
                        Box,
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
    )
  );
}
