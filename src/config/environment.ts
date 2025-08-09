/**
 * Configuración centralizada de variables de entorno
 */

interface EnvironmentConfig {
  API_URL: string;
  NODE_ENV: string;
  IS_DEVELOPMENT: boolean;
  IS_PRODUCTION: boolean;
  APP_NAME: string;
  APP_VERSION: string;
}

// Validar variables de entorno requeridas
const requiredEnvVars = ["VITE_API_URL"] as const;

function validateEnvironment(): void {
  const missing = requiredEnvVars.filter((envVar) => !import.meta.env[envVar]);

  if (missing.length > 0) {
    console.error("Variables de entorno faltantes:", missing);
    throw new Error(
      `Variables de entorno requeridas faltantes: ${missing.join(", ")}`
    );
  }
}

// Validar en desarrollo
if (import.meta.env.DEV) {
  validateEnvironment();
}

export const env: EnvironmentConfig = {
  API_URL: import.meta.env.VITE_API_URL || "http://35.238.95.118/api",
  NODE_ENV: import.meta.env.NODE_ENV || "development",
  IS_DEVELOPMENT: import.meta.env.DEV || false,
  IS_PRODUCTION: import.meta.env.PROD || false,
  APP_NAME: import.meta.env.VITE_APP_NAME || "Punto Cambio",
  APP_VERSION: import.meta.env.VITE_APP_VERSION || "1.0.0",
};

// Logging de configuración en desarrollo
if (env.IS_DEVELOPMENT) {
  console.log("🔧 Configuración de entorno:", {
    API_URL: env.API_URL,
    NODE_ENV: env.NODE_ENV,
    APP_NAME: env.APP_NAME,
    APP_VERSION: env.APP_VERSION,
  });
}
