import * as React from "react";

const h = React.createElement;

export type CierrePayload = {
  observaciones: string;
  allowMismatch: boolean;
};

export interface CierreDialogProps {
  open: boolean;
  saving?: boolean;

  /** Texto inicial de observaciones (opcional) */
  defaultObservaciones?: string;

  /** Valor inicial para permitir diferencia */
  defaultAllowMismatch?: boolean;

  /** Llamado al cerrar/cancelar el diálogo */
  onClose: () => void;

  /** Guardar parcial: devuelve las observaciones y el flag allowMismatch */
  onGuardarParcial: (payload: CierrePayload) => void | Promise<void>;

  /** Cerrar caja: devuelve las observaciones y el flag allowMismatch */
  onCerrarCaja: (payload: CierrePayload) => void | Promise<void>;

  /** Si quieres controlar desde afuera el foco inicial */
  autoFocusTextarea?: boolean;
}

export default function CierreDialog(props: CierreDialogProps) {
  const {
    open,
    saving,
    defaultObservaciones = "",
    defaultAllowMismatch = false,
    onClose,
    onGuardarParcial,
    onCerrarCaja,
    autoFocusTextarea = true,
  } = props;

  const [observaciones, setObservaciones] =
    React.useState<string>(defaultObservaciones);
  const [allowMismatch, setAllowMismatch] =
    React.useState<boolean>(defaultAllowMismatch);

  // Sincroniza valores iniciales cuando se abre
  React.useEffect(() => {
    if (open) {
      setObservaciones(defaultObservaciones);
      setAllowMismatch(defaultAllowMismatch);
    }
  }, [open, defaultObservaciones, defaultAllowMismatch]);

  // Cerrar con Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onClickOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    // cierra si clic fuera del cuadro
    if (e.target === e.currentTarget) onClose();
  };

  const handleGuardarParcial = async () => {
    await onGuardarParcial({ observaciones, allowMismatch });
  };

  const handleCerrarCaja = async () => {
    await onCerrarCaja({ observaciones, allowMismatch });
  };

  // Subcomponentes sin JSX
  const Box = (p: {
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    role?: string;
    "aria-modal"?: boolean;
  }) =>
    h(
      "div",
      {
        style: p.style,
        onClick: p.onClick,
        role: p.role,
        "aria-modal": p["aria-modal"],
      },
      p.children
    );
  const Button = (p: {
    onClick?: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) =>
    h(
      "button",
      { onClick: p.onClick, disabled: p.disabled, style: p.style },
      p.children
    );
  const Label = (p: {
    htmlFor?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }) => h("label", { htmlFor: p.htmlFor, style: p.style }, p.children);
  const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
    h("input", p);
  const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    h("textarea", p);

  // Estilos simples
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };
  const dialogStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 560,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    overflow: "hidden",
  };
  const headerStyle: React.CSSProperties = {
    padding: 12,
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };
  const bodyStyle: React.CSSProperties = {
    padding: 12,
    display: "grid",
    gap: 12,
  };
  const footerStyle: React.CSSProperties = {
    padding: 12,
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  };

  return h(
    Box,
    {
      style: overlayStyle,
      onClick: onClickOverlay,
      role: "dialog",
      "aria-modal": true,
    },
    h(
      Box,
      { style: dialogStyle },
      // Header
      h(
        Box,
        { style: headerStyle },
        h("div", null, "Confirmar cierre de caja"),
        h(
          Button,
          {
            onClick: onClose,
            style: {
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 8,
            },
          },
          "Cerrar"
        )
      ),
      // Body
      h(
        Box,
        { style: bodyStyle },
        h(
          "div",
          { style: { display: "grid", gap: 6 } },
          h(
            Label,
            { htmlFor: "obs", style: { fontSize: 14 } },
            "Observaciones"
          ),
          h(Textarea, {
            id: "obs",
            value: observaciones,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setObservaciones(e.target.value),
            autoFocus: autoFocusTextarea,
            placeholder: "Notas del cierre, incidencias, soportes…",
            style: { minHeight: 100, padding: "8px 10px", resize: "vertical" },
          })
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          h(Input, {
            id: "allowMismatch",
            type: "checkbox",
            checked: allowMismatch,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setAllowMismatch(!!e.target.checked),
          }),
          h(
            Label,
            { htmlFor: "allowMismatch", style: { fontSize: 14 } },
            "Permitir diferencia"
          )
        )
      ),
      // Footer
      h(
        Box,
        { style: footerStyle },
        h(
          Button,
          {
            onClick: onClose,
            disabled: !!saving,
            style: {
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 8,
            },
          },
          "Cancelar"
        ),
        h(
          Button,
          {
            onClick: handleGuardarParcial,
            disabled: !!saving,
            style: {
              padding: "8px 12px",
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            },
          },
          saving ? "Guardando…" : "Guardar parcial"
        ),
        h(
          Button,
          {
            onClick: handleCerrarCaja,
            disabled: !!saving,
            style: {
              padding: "8px 12px",
              background: "#111827",
              color: "#fff",
              border: "1px solid #111827",
              borderRadius: 8,
            },
          },
          saving ? "Cerrando…" : "Cerrar caja"
        )
      )
    )
  );
}
