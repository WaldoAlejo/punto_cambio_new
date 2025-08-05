import { toast } from "sonner";

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
    let apiError: ApiError = {
      message: "Error desconocido",
      status: 500,
    };

    if (error instanceof Error) {
      apiError.message = error.message;
    } else if (typeof error === "string") {
      apiError.message = error;
    } else if (error && typeof error === "object" && "response" in error) {
      // Error de Axios
      const axiosError = error as any;
      apiError.status = axiosError.response?.status || 500;
      apiError.message =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        axiosError.message ||
        "Error de conexión";
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
