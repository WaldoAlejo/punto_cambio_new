/**
 * Utilidad para verificar la salud del sistema
 * Verifica conectividad con el backend y estado de servicios críticos
 */

import axiosInstance from "@/services/axiosInstance";
import { env } from "@/config/environment";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    backend: boolean;
    auth: boolean;
    database: boolean;
  };
  details: {
    backend?: string;
    auth?: string;
    database?: string;
  };
  timestamp: string;
}

export class HealthCheckService {
  /**
   * Ejecuta verificación completa de salud del sistema
   */
  static async checkSystemHealth(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      status: "healthy",
      checks: {
        backend: false,
        auth: false,
        database: false,
      },
      details: {},
      timestamp: new Date().toISOString(),
    };

    // Verificar backend
    try {
      const response = await axiosInstance.get("/health", { timeout: 5000 });
      if (response.status === 200) {
        result.checks.backend = true;
        result.details.backend = "Backend respondiendo correctamente";
      }
    } catch (error) {
      result.checks.backend = false;
      result.details.backend = `Error de conectividad: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`;
    }

    // Verificar autenticación (si hay token)
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const response = await axiosInstance.get("/auth/verify", {
          timeout: 5000,
        });
        if (response.status === 200 && response.data.valid) {
          result.checks.auth = true;
          result.details.auth = "Token válido";
        } else {
          result.checks.auth = false;
          result.details.auth = "Token inválido o expirado";
        }
      } catch (error) {
        result.checks.auth = false;
        result.details.auth = `Error de autenticación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`;
      }
    } else {
      result.checks.auth = true; // No hay token, pero no es un error
      result.details.auth = "Sin sesión activa";
    }

    // Verificar base de datos (a través de una consulta simple)
    try {
      const response = await axiosInstance.get("/currencies", {
        timeout: 5000,
      });
      if (response.status === 200) {
        result.checks.database = true;
        result.details.database = "Base de datos respondiendo";
      }
    } catch (error) {
      result.checks.database = false;
      result.details.database = `Error de base de datos: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`;
    }

    // Determinar estado general
    const healthyChecks = Object.values(result.checks).filter(Boolean).length;
    const totalChecks = Object.keys(result.checks).length;

    if (healthyChecks === totalChecks) {
      result.status = "healthy";
    } else if (healthyChecks >= totalChecks / 2) {
      result.status = "degraded";
    } else {
      result.status = "unhealthy";
    }

    return result;
  }

  /**
   * Verificación rápida solo del backend
   */
  static async quickHealthCheck(): Promise<boolean> {
    try {
      const response = await axiosInstance.get("/health", { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Verifica si el usuario tiene una sesión válida
   */
  static async checkAuthStatus(): Promise<{
    isAuthenticated: boolean;
    user: unknown | null;
    error?: string;
  }> {
    const token = localStorage.getItem("authToken");

    if (!token) {
      return {
        isAuthenticated: false,
        user: null,
        error: "No hay token de sesión",
      };
    }

    try {
      const response = await axiosInstance.get("/auth/verify", {
        timeout: 5000,
      });

      if (response.data.valid && response.data.user) {
        return {
          isAuthenticated: true,
          user: response.data.user,
        };
      } else {
        return {
          isAuthenticated: false,
          user: null,
          error: "Token inválido",
        };
      }
    } catch (error) {
      return {
        isAuthenticated: false,
        user: null,
        error: error instanceof Error ? error.message : "Error de verificación",
      };
    }
  }

  /**
   * Verifica la conectividad con servicios externos
   */
  static async checkExternalServices(): Promise<{
    servientrega: boolean;
    details: Record<string, string>;
  }> {
    const result = {
      servientrega: false,
      details: {} as Record<string, string>,
    };

    // Verificar Servientrega
    try {
      const response = await axiosInstance.post(
        "/servientrega/productos",
        {},
        { timeout: 10000 }
      );
      if (response.status === 200) {
        result.servientrega = true;
        result.details.servientrega = "Servientrega disponible";
      }
    } catch (error) {
      result.servientrega = false;
      result.details.servientrega = `Servientrega no disponible: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`;
    }

    return result;
  }

  /**
   * Obtiene información del sistema
   */
  static getSystemInfo(): {
    environment: string;
    version: string;
    apiUrl: string;
    userAgent: string;
    timestamp: string;
  } {
    return {
      environment: env.NODE_ENV,
      version: env.APP_VERSION,
      apiUrl: env.API_URL,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Genera un reporte completo del sistema
   */
  static async generateSystemReport(): Promise<{
    health: HealthCheckResult;
    externalServices: Awaited<
      ReturnType<typeof HealthCheckService.checkExternalServices>
    >;
    systemInfo: ReturnType<typeof HealthCheckService.getSystemInfo>;
    authStatus: Awaited<ReturnType<typeof HealthCheckService.checkAuthStatus>>;
  }> {
    const [health, externalServices, authStatus] = await Promise.all([
      this.checkSystemHealth(),
      this.checkExternalServices(),
      this.checkAuthStatus(),
    ]);

    return {
      health,
      externalServices,
      systemInfo: this.getSystemInfo(),
      authStatus,
    };
  }
}
