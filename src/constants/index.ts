/**
 * Constantes globales de la aplicación
 */

// Roles de usuario
export const USER_ROLES = {
  SUPER_USUARIO: "SUPER_USUARIO",
  ADMIN: "ADMIN",
  OPERADOR: "OPERADOR",
  CONCESION: "CONCESION",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Estados de transacciones (alineado con Prisma)
export const TRANSACTION_STATES = {
  PENDIENTE: "PENDIENTE",
  COMPLETADO: "COMPLETADO",
  CANCELADO: "CANCELADO",
} as const;

// Tipos de operación (alineado con Prisma)
export const OPERATION_TYPES = {
  COMPRA: "COMPRA",
  VENTA: "VENTA",
} as const;

// Tipos de movimiento (alineado con Prisma)
export const MOVEMENT_TYPES = {
  INGRESO: "INGRESO",
  EGRESO: "EGRESO",
  TRANSFERENCIA_ENTRANTE: "TRANSFERENCIA_ENTRANTE",
  TRANSFERENCIA_SALIENTE: "TRANSFERENCIA_SALIENTE",
  CAMBIO_DIVISA: "CAMBIO_DIVISA",
} as const;

// Estados de transferencia (alineado con Prisma)
export const TRANSFER_STATES = {
  PENDIENTE: "PENDIENTE",
  APROBADO: "APROBADO",
  RECHAZADO: "RECHAZADO",
} as const;

// Tipos de transferencia (alineado con Prisma)
export const TRANSFER_TYPES = {
  ENTRE_PUNTOS: "ENTRE_PUNTOS",
  DEPOSITO_MATRIZ: "DEPOSITO_MATRIZ",
  RETIRO_GERENCIA: "RETIRO_GERENCIA",
  DEPOSITO_GERENCIA: "DEPOSITO_GERENCIA",
} as const;

// Estados de jornada (alineado con Prisma)
export const JORNADA_STATES = {
  ACTIVO: "ACTIVO",
  ALMUERZO: "ALMUERZO",
  COMPLETADO: "COMPLETADO",
  CANCELADO: "CANCELADO",
} as const;

// Motivos de salida (alineado con Prisma)
export const SALIDA_MOTIVOS = {
  BANCO: "BANCO",
  DILIGENCIA_PERSONAL: "DILIGENCIA_PERSONAL",
  TRAMITE_GOBIERNO: "TRAMITE_GOBIERNO",
  EMERGENCIA_MEDICA: "EMERGENCIA_MEDICA",
  OTRO: "OTRO",
} as const;

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Configuración de fechas
export const DATE_FORMATS = {
  DISPLAY: "dd/MM/yyyy",
  DISPLAY_WITH_TIME: "dd/MM/yyyy HH:mm",
  API: "yyyy-MM-dd",
  API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Error de conexión. Verifique su conexión a internet.",
  UNAUTHORIZED: "No tiene permisos para realizar esta acción.",
  SESSION_EXPIRED:
    "Su sesión ha expirado. Por favor, inicie sesión nuevamente.",
  SERVER_ERROR: "Error interno del servidor. Intente nuevamente más tarde.",
  VALIDATION_ERROR: "Los datos ingresados no son válidos.",
  NOT_FOUND: "El recurso solicitado no fue encontrado.",
} as const;

// Mensajes de éxito comunes
export const SUCCESS_MESSAGES = {
  CREATED: "Registro creado exitosamente.",
  UPDATED: "Registro actualizado exitosamente.",
  DELETED: "Registro eliminado exitosamente.",
  SAVED: "Cambios guardados exitosamente.",
} as const;

// Configuración de la aplicación
export const APP_CONFIG = {
  NAME: "Punto Cambio",
  VERSION: "1.0.0",
  COMPANY: "Tu Empresa",
  SUPPORT_EMAIL: "soporte@tuempresa.com",
  SUPPORT_PHONE: "+1234567890",
} as const;

// Límites y validaciones
export const LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_UPLOAD_FILES: 10,
  MIN_PASSWORD_LENGTH: 8,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_NAME_LENGTH: 100,
} as const;

// Códigos de moneda comunes
export const CURRENCY_CODES = {
  USD: "USD",
  EUR: "EUR",
  COP: "COP",
  VES: "VES",
} as const;

// Configuración de timeouts
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 segundos
  DEBOUNCE_SEARCH: 300, // 300ms
  TOAST_DURATION: 5000, // 5 segundos
} as const;

// Claves de localStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: "authToken",
  SELECTED_POINT: "puntoAtencionSeleccionado",
  USER_PREFERENCES: "userPreferences",
  THEME: "theme",
} as const;
