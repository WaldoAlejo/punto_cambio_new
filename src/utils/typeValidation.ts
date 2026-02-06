/**
 * Utilidades para validación de tipos y transformación de datos
 * Asegura consistencia entre frontend, backend y Prisma schema
 */

import { Usuario, PuntoAtencion, Moneda } from "@/types";

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

/**
 * Valida y transforma datos de usuario del backend
 */
export function validateAndTransformUser(data: unknown): Usuario | null {
  if (!isRecord(data)) {
    return null;
  }

  // Validar campos requeridos
  const requiredFields = [
    "id",
    "username",
    "nombre",
    "rol",
    "created_at",
    "updated_at",
  ];
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`Campo requerido faltante en usuario: ${field}`);
      return null;
    }
  }

  // Validar rol
  const validRoles = [
    "SUPER_USUARIO",
    "ADMIN",
    "OPERADOR",
    "CONCESION",
    "ADMINISTRATIVO",
  ];
  const rol = data["rol"];
  if (typeof rol !== "string" || !validRoles.includes(rol)) {
    console.error(`Rol inválido: ${String(rol)}`);
    return null;
  }

  const correoRaw = data["correo"];
  const telefonoRaw = data["telefono"];
  const puntoAtencionIdRaw = data["punto_atencion_id"];
  const jornadaIdRaw = data["jornada_id"];

  return {
    id: String(data.id),
    username: String(data.username),
    nombre: String(data.nombre),
    correo: typeof correoRaw === "string" && correoRaw ? correoRaw : null,
    telefono: typeof telefonoRaw === "string" && telefonoRaw ? telefonoRaw : null,
    rol,
    activo: Boolean(data["activo"]),
    punto_atencion_id:
      puntoAtencionIdRaw ? String(puntoAtencionIdRaw) : null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
    jornada_id: jornadaIdRaw ? String(jornadaIdRaw) : null,
    hasActiveJornada: Boolean(data["hasActiveJornada"]),
  };
}

/**
 * Valida y transforma datos de punto de atención
 */
export function validateAndTransformPuntoAtencion(
  data: unknown
): PuntoAtencion | null {
  if (!isRecord(data)) {
    return null;
  }

  const requiredFields = [
    "id",
    "nombre",
    "direccion",
    "ciudad",
    "provincia",
    "created_at",
    "updated_at",
  ];
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`Campo requerido faltante en punto de atención: ${field}`);
      return null;
    }
  }

  const codigoPostalRaw = data["codigo_postal"];
  const telefonoRaw = data["telefono"];

  return {
    id: String(data.id),
    nombre: String(data.nombre),
    direccion: String(data.direccion),
    ciudad: String(data.ciudad),
    provincia: String(data.provincia),
    codigo_postal:
      typeof codigoPostalRaw === "string" && codigoPostalRaw
        ? codigoPostalRaw
        : null,
    telefono: typeof telefonoRaw === "string" && telefonoRaw ? telefonoRaw : null,
    activo: Boolean(data["activo"]),
    es_principal: Boolean(data["es_principal"] || false),
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

/**
 * Valida y transforma datos de moneda
 */
export function validateAndTransformMoneda(data: unknown): Moneda | null {
  if (!isRecord(data)) {
    return null;
  }

  const requiredFields = [
    "id",
    "codigo",
    "nombre",
    "simbolo",
    "created_at",
    "updated_at",
  ];
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`Campo requerido faltante en moneda: ${field}`);
      return null;
    }
  }

  const comportamientoCompraRaw = data["comportamiento_compra"];
  const comportamientoVentaRaw = data["comportamiento_venta"];

  const comportamientoCompra =
    comportamientoCompraRaw === "MULTIPLICA" || comportamientoCompraRaw === "DIVIDE"
      ? comportamientoCompraRaw
      : "MULTIPLICA";
  const comportamientoVenta =
    comportamientoVentaRaw === "MULTIPLICA" || comportamientoVentaRaw === "DIVIDE"
      ? comportamientoVentaRaw
      : "MULTIPLICA";

  return {
    id: String(data.id),
    codigo: String(data.codigo),
    nombre: String(data.nombre),
    simbolo: String(data.simbolo),
    activo: Boolean(data["activo"]),
    orden_display: Number(data["orden_display"]) || 0,
    comportamiento_compra: comportamientoCompra,
    comportamiento_venta: comportamientoVenta,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

/**
 * Valida array de datos y transforma cada elemento
 */
export function validateAndTransformArray<T>(
  data: unknown,
  transformer: (item: unknown) => T | null
): T[] {
  if (!Array.isArray(data)) {
    console.error("Se esperaba un array pero se recibió:", typeof data);
    return [];
  }

  return data.map(transformer).filter((item): item is T => item !== null);
}

/**
 * Valida estructura de respuesta de API
 */
export function validateApiResponse(response: unknown): {
  isValid: boolean;
  data: unknown;
  error?: string;
} {
  if (!response) {
    return { isValid: false, data: null, error: "Respuesta vacía" };
  }

  if (!isRecord(response)) {
    return { isValid: false, data: null, error: "Respuesta no es un objeto" };
  }

  // Verificar si es una respuesta de error
  if (response["error"] && !response["success"]) {
    return {
      isValid: false,
      data: null,
      error: String(response["error"] || "Error desconocido"),
    };
  }

  // Verificar si tiene estructura de éxito
  if (response["success"] === false) {
    return {
      isValid: false,
      data: null,
      error:
        String(response["error"] || response["message"] || "Operación fallida"),
    };
  }

  return { isValid: true, data: response };
}

/**
 * Sanitiza datos para envío al backend
 */
export function sanitizeForBackend(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Omitir valores undefined
    if (value === undefined) {
      continue;
    }

    // Convertir null a null explícito
    if (value === null) {
      sanitized[key] = null;
      continue;
    }

    // Sanitizar strings
    if (typeof value === "string") {
      sanitized[key] = value.trim();
      continue;
    }

    // Mantener otros tipos como están
    sanitized[key] = value;
  }

  return sanitized;
}
