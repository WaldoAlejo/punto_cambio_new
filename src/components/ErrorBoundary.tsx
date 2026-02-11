import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
  stack?: string;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return { hasError: true, message, stack };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Keep it visible in logs
    // eslint-disable-next-line no-console
    console.error("UI crashed:", error, info);

    try {
      const payload = {
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        componentStack: info.componentStack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      };
      localStorage.setItem("pc_last_ui_error", JSON.stringify(payload));
    } catch {
      // noop
    }
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      // noop
    }
  };

  private handleCopy = async () => {
    try {
      const raw = localStorage.getItem("pc_last_ui_error") || "";
      await navigator.clipboard.writeText(raw);
    } catch {
      // noop
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? "Ocurrió un error en la pantalla";

    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-3xl mx-auto bg-white border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-700">{title}</h1>
          <p className="mt-2 text-sm text-gray-700">
            No debería mostrarse una página en blanco. Este mensaje nos ayuda a
            identificar la causa.
          </p>

          <div className="mt-4 p-3 rounded border bg-red-50 text-red-800 text-sm">
            <div className="font-semibold">Detalle</div>
            <div className="mt-1 break-words">{this.state.message}</div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              onClick={this.handleReload}
              type="button"
            >
              Recargar
            </button>
            <button
              className="px-3 py-2 rounded border border-gray-300 text-gray-800 hover:bg-gray-100"
              onClick={this.handleCopy}
              type="button"
              title="Copia el error guardado para enviarlo por WhatsApp"
            >
              Copiar error
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Clave: <span className="font-mono">pc_last_ui_error</span>
          </p>
        </div>
      </div>
    );
  }
}
