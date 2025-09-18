/**
 * Configuración centralizada de variables de entorno (Vite)
 * - Robusta frente a variables faltantes
 * - Helpers para parsear listas/booleanos/números
 * - Limpia la API_URL (sin trailing slash)
 */

type MaybeStr = string | undefined;

/** Helpers seguros */
const toString = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const toBool = (v: unknown, fallback = false): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
  }
  return fallback;
};

const toNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Lista segura: evita `.split` sobre undefined */
export const toList = (val?: string, sep = ","): string[] =>
  toString(val, "")
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);

/** Quita trailing slashes de una URL base */
const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, "");

/** Tipado de la configuración expuesta a la app */
interface EnvironmentConfig {
  API_URL: string;
  NODE_ENV: string;
  IS_DEVELOPMENT: boolean;
  IS_PRODUCTION: boolean;
  APP_NAME: string;
  APP_VERSION: string;
}

/** Validación en desarrollo (no rompas prod por una env faltante) */
const requiredEnvVars = ["VITE_API_URL"] as const;

function validateEnvironment(): void {
  const missing = requiredEnvVars.filter((k) => !import.meta.env[k]);
  if (missing.length > 0) {
    // Log claro, pero error solo en dev
    console.error("Variables de entorno faltantes:", missing);
    throw new Error(
      `Variables de entorno requeridas faltantes: ${missing.join(", ")}`
    );
  }
}

if (import.meta.env.DEV) {
  try {
    validateEnvironment();
  } catch (e) {
    // Deja el throw en dev para corregir rápido
    throw e;
  }
}

/** Construcción segura de valores */
const rawApi: MaybeStr = import.meta.env.VITE_API_URL;
const defaultApi = "http://34.70.184.11:3001/api";
const API_URL = stripTrailingSlash(toString(rawApi, defaultApi));

export const env: EnvironmentConfig = {
  API_URL,
  NODE_ENV: toString(import.meta.env.NODE_ENV, "development"),
  IS_DEVELOPMENT: Boolean(import.meta.env.DEV),
  IS_PRODUCTION: Boolean(import.meta.env.PROD),
  APP_NAME: toString(import.meta.env.VITE_APP_NAME, "Punto Cambio"),
  APP_VERSION: toString(import.meta.env.VITE_APP_VERSION, "1.0.0"),
};

/** Logging útil en dev */
if (env.IS_DEVELOPMENT) {
  console.log("🔧 Configuración de entorno:", {
    API_URL: env.API_URL,
    NODE_ENV: env.NODE_ENV,
    APP_NAME: env.APP_NAME,
    APP_VERSION: env.APP_VERSION,
  });
}

/** Exporta helpers por si los necesitas en otros módulos */
export const envHelpers = { toList, toBool, toNumber, stripTrailingSlash };
