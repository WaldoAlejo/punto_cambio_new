import { toast } from "sonner";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object";

const getServerMessage = (data: unknown): string | undefined => {
  if (!isRecord(data)) return undefined;
  const message = data.message;
  const error = data.error;
  const details = data.details;
  if (typeof message === "string" && message.trim()) return message;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof details === "string" && details.trim()) return details;
  return undefined;
};

const isAxiosLikeError = (
  err: unknown
): err is {
  response?: { status?: number; data?: unknown };
  message?: string;
} => {
  if (!isRecord(err)) return false;
  if (!("response" in err)) return false;
  const response = (err as Record<string, unknown>).response;
  return response === undefined || isRecord(response);
};

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export class ErrorHandler {
  /**
   * Maneja errores de API de forma consistente
   */
  static handleApiError(error: unknown, context?: string): ApiError {
    const apiError: ApiError = {
      message: "Error desconocido",
      status: 500,
    };

    if (error instanceof Error) {
      apiError.message = error.message;
    } else if (typeof error === "string") {
      apiError.message = error;
    } else if (isAxiosLikeError(error)) {
      const status = error.response?.status;
      apiError.status = typeof status === "number" ? status : 500;
      apiError.message =
        getServerMessage(error.response?.data) ||
        (typeof error.message === "string" && error.message.trim()
          ? error.message
          : "Error de conexión");
    }

    // Log del error para debugging
    console.error(`Error${context ? ` en ${context}` : ""}:`, error);

    return apiError;
  }

  /**
   * Muestra un toast de error con mensaje apropiado
   */
  static showErrorToast(error: unknown, context?: string) {
    const apiError = this.handleApiError(error, context);

    let userMessage = apiError.message;

    // Personalizar mensajes según el código de estado
    switch (apiError.status) {
      case 401:
        userMessage = "Sesión expirada. Por favor, inicie sesión nuevamente.";
        break;
      case 403:
        userMessage = "No tiene permisos para realizar esta acción.";
        break;
      case 404:
        userMessage = "El recurso solicitado no fue encontrado.";
        break;
      case 500:
        userMessage = "Error interno del servidor. Intente nuevamente.";
        break;
      case 503:
        userMessage = "Servicio no disponible. Intente más tarde.";
        break;
    }

    toast.error(userMessage);
    return apiError;
  }

  /**
   * Valida si un error requiere redirección al login
   */
  static requiresReauth(error: unknown): boolean {
    const apiError = this.handleApiError(error);
    return apiError.status === 401;
  }
}

/**
 * Wrapper para operaciones asíncronas con manejo de errores
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string,
  showToast: boolean = true
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (showToast) {
      ErrorHandler.showErrorToast(error, context);
    } else {
      ErrorHandler.handleApiError(error, context);
    }
    return null;
  }
}
