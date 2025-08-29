/**
 * Utilidades para validación de tipos y transformación de datos
 * Asegura consistencia entre frontend, backend y Prisma schema
 */

import { Usuario, PuntoAtencion, Moneda } from "@/types";

/**
 * Valida y transforma datos de usuario del backend
 */
export function validateAndTransformUser(data: any): Usuario | null {
  if (!data || typeof data !== "object") {
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
  if (!validRoles.includes(data.rol)) {
    console.error(`Rol inválido: ${data.rol}`);
    return null;
  }

  return {
    id: String(data.id),
    username: String(data.username),
    nombre: String(data.nombre),
    correo: data.correo || null,
    telefono: data.telefono || null,
    rol: data.rol,
    activo: Boolean(data.activo),
    punto_atencion_id: data.punto_atencion_id || null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
    jornada_id: data.jornada_id || null,
    hasActiveJornada: Boolean(data.hasActiveJornada),
  };
}

/**
 * Valida y transforma datos de punto de atención
 */
export function validateAndTransformPuntoAtencion(
  data: any
): PuntoAtencion | null {
  if (!data || typeof data !== "object") {
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

  return {
    id: String(data.id),
    nombre: String(data.nombre),
    direccion: String(data.direccion),
    ciudad: String(data.ciudad),
    provincia: String(data.provincia),
    codigo_postal: data.codigo_postal || null,
    telefono: data.telefono || null,
    activo: Boolean(data.activo),
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

/**
 * Valida y transforma datos de moneda
 */
export function validateAndTransformMoneda(data: any): Moneda | null {
  if (!data || typeof data !== "object") {
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

  return {
    id: String(data.id),
    codigo: String(data.codigo),
    nombre: String(data.nombre),
    simbolo: String(data.simbolo),
    activo: Boolean(data.activo),
    orden_display: Number(data.orden_display) || 0,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

/**
 * Valida array de datos y transforma cada elemento
 */
export function validateAndTransformArray<T>(
  data: any[],
  transformer: (item: any) => T | null
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
export function validateApiResponse(response: any): {
  isValid: boolean;
  data: any;
  error?: string;
} {
  if (!response) {
    return { isValid: false, data: null, error: "Respuesta vacía" };
  }

  if (typeof response !== "object") {
    return { isValid: false, data: null, error: "Respuesta no es un objeto" };
  }

  // Verificar si es una respuesta de error
  if (response.error && !response.success) {
    return {
      isValid: false,
      data: null,
      error: response.error || "Error desconocido",
    };
  }

  // Verificar si tiene estructura de éxito
  if (response.success === false) {
    return {
      isValid: false,
      data: null,
      error: response.error || response.message || "Operación fallida",
    };
  }

  return { isValid: true, data: response };
}

/**
 * Sanitiza datos para envío al backend
 */
export function sanitizeForBackend(
  data: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

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
