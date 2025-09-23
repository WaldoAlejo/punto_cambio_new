import React, { useState } from "react";

export function useConfirmationDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

  function showConfirmation(
    title: string,
    message: string,
    onConfirmCallback: () => void,
    _variant?: string
  ) {
    setTitle(title);
    setMessage(message);
    setOnConfirm(() => onConfirmCallback);
    setOpen(true);
  }

  function ConfirmationDialog() {
    if (!open) return null;
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #ccc",
          padding: 24,
          zIndex: 9999,
          position: "fixed",
          top: 100,
          left: "50%",
          transform: "translateX(-50%)",
          minWidth: 320,
        }}
      >
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        <p style={{ marginBottom: 16 }}>{message}</p>
        <button
          style={{ marginRight: 8 }}
          onClick={() => {
            setOpen(false);
            if (onConfirm) onConfirm();
          }}
        >
          Confirmar
        </button>
        <button onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    );
  }

  return { showConfirmation, ConfirmationDialog };
}
