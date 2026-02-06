/**
 * Servicio de validación de datos para el frontend
 * Asegura que los datos cumplan con las reglas de negocio antes de enviarlos al backend
 */

import { LIMITS, USER_ROLES } from "@/constants";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export class ValidationService {
  /**
   * Valida datos de usuario
   */
  static validateUser(userData: {
    username?: string;
    nombre?: string;
    correo?: string;
    telefono?: string;
    rol?: string;
    password?: string;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar username
    if (userData.username !== undefined) {
      if (!userData.username || userData.username.trim().length < 3) {
        errors.push("El nombre de usuario debe tener al menos 3 caracteres");
      }
      if (userData.username.length > 50) {
        errors.push("El nombre de usuario no puede exceder 50 caracteres");
      }
      if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) {
        errors.push(
          "El nombre de usuario solo puede contener letras, números y guiones bajos"
        );
      }
    }

    // Validar nombre
    if (userData.nombre !== undefined) {
      if (!userData.nombre || userData.nombre.trim().length < 2) {
        errors.push("El nombre debe tener al menos 2 caracteres");
      }
      if (userData.nombre.length > LIMITS.MAX_NAME_LENGTH) {
        errors.push(
          `El nombre no puede exceder ${LIMITS.MAX_NAME_LENGTH} caracteres`
        );
      }
    }

    // Validar correo
    if (userData.correo) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.correo)) {
        errors.push("El formato del correo electrónico no es válido");
      }
    }

    // Validar teléfono
    if (userData.telefono) {
      const phoneRegex = /^[+]?[0-9-\s()]{7,15}$/;
      if (!phoneRegex.test(userData.telefono)) {
        errors.push("El formato del teléfono no es válido");
      }
    }

    // Validar rol
    if (userData.rol !== undefined) {
      const validRoles = Object.values(USER_ROLES) as string[];
      if (typeof userData.rol !== "string" || !validRoles.includes(userData.rol)) {
        errors.push("El rol especificado no es válido");
      }
    }

    // Validar contraseña
    if (userData.password !== undefined) {
      if (userData.password.length < LIMITS.MIN_PASSWORD_LENGTH) {
        errors.push(
          `La contraseña debe tener al menos ${LIMITS.MIN_PASSWORD_LENGTH} caracteres`
        );
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(userData.password)) {
        warnings.push(
          "Se recomienda que la contraseña contenga al menos una mayúscula, una minúscula y un número"
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valida datos de moneda
   */
  static validateCurrency(currencyData: {
    codigo?: string;
    nombre?: string;
    simbolo?: string;
    orden_display?: number;
  }): ValidationResult {
    const errors: string[] = [];

    // Validar código
    if (currencyData.codigo !== undefined) {
      if (!currencyData.codigo || currencyData.codigo.trim().length !== 3) {
        errors.push("El código de moneda debe tener exactamente 3 caracteres");
      }
      if (!/^[A-Z]{3}$/.test(currencyData.codigo)) {
        errors.push("El código de moneda debe contener solo letras mayúsculas");
      }
    }

    // Validar nombre
    if (currencyData.nombre !== undefined) {
      if (!currencyData.nombre || currencyData.nombre.trim().length < 2) {
        errors.push("El nombre de la moneda debe tener al menos 2 caracteres");
      }
      if (currencyData.nombre.length > 100) {
        errors.push("El nombre de la moneda no puede exceder 100 caracteres");
      }
    }

    // Validar símbolo
    if (currencyData.simbolo !== undefined) {
      if (!currencyData.simbolo || currencyData.simbolo.trim().length === 0) {
        errors.push("El símbolo de la moneda es requerido");
      }
      if (currencyData.simbolo.length > 5) {
        errors.push("El símbolo de la moneda no puede exceder 5 caracteres");
      }
    }

    // Validar orden de display
    if (currencyData.orden_display !== undefined) {
      if (currencyData.orden_display < 0 || currencyData.orden_display > 999) {
        errors.push("El orden de display debe estar entre 0 y 999");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida datos de punto de atención
   */
  static validatePuntoAtencion(puntoData: {
    nombre?: string;
    direccion?: string;
    ciudad?: string;
    provincia?: string;
    codigo_postal?: string;
    telefono?: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Validar nombre
    if (puntoData.nombre !== undefined) {
      if (!puntoData.nombre || puntoData.nombre.trim().length < 3) {
        errors.push("El nombre del punto debe tener al menos 3 caracteres");
      }
      if (puntoData.nombre.length > LIMITS.MAX_NAME_LENGTH) {
        errors.push(
          `El nombre no puede exceder ${LIMITS.MAX_NAME_LENGTH} caracteres`
        );
      }
    }

    // Validar dirección
    if (puntoData.direccion !== undefined) {
      if (!puntoData.direccion || puntoData.direccion.trim().length < 5) {
        errors.push("La dirección debe tener al menos 5 caracteres");
      }
      if (puntoData.direccion.length > 200) {
        errors.push("La dirección no puede exceder 200 caracteres");
      }
    }

    // Validar ciudad
    if (puntoData.ciudad !== undefined) {
      if (!puntoData.ciudad || puntoData.ciudad.trim().length < 2) {
        errors.push("La ciudad debe tener al menos 2 caracteres");
      }
      if (puntoData.ciudad.length > 100) {
        errors.push("La ciudad no puede exceder 100 caracteres");
      }
    }

    // Validar provincia
    if (puntoData.provincia !== undefined) {
      if (!puntoData.provincia || puntoData.provincia.trim().length < 2) {
        errors.push("La provincia debe tener al menos 2 caracteres");
      }
      if (puntoData.provincia.length > 100) {
        errors.push("La provincia no puede exceder 100 caracteres");
      }
    }

    // Validar código postal
    if (puntoData.codigo_postal) {
      if (!/^[0-9A-Z\-\s]{3,10}$/.test(puntoData.codigo_postal)) {
        errors.push("El código postal tiene un formato inválido");
      }
    }

    // Validar teléfono
    if (puntoData.telefono) {
      const phoneRegex = /^[+]?[0-9-\s()]{7,15}$/;
      if (!phoneRegex.test(puntoData.telefono)) {
        errors.push("El formato del teléfono no es válido");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida datos de transferencia
   */
  static validateTransfer(transferData: {
    monto?: number;
    descripcion?: string;
    destino_id?: string;
    moneda_id?: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Validar monto
    if (transferData.monto !== undefined) {
      if (transferData.monto <= 0) {
        errors.push("El monto debe ser mayor a cero");
      }
      if (transferData.monto > 999999999.99) {
        errors.push("El monto excede el límite máximo permitido");
      }
      // Validar que tenga máximo 2 decimales
      if (!/^\d+(\.\d{1,2})?$/.test(transferData.monto.toString())) {
        errors.push("El monto puede tener máximo 2 decimales");
      }
    }

    // Validar descripción
    if (transferData.descripcion) {
      if (transferData.descripcion.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
        errors.push(
          `La descripción no puede exceder ${LIMITS.MAX_DESCRIPTION_LENGTH} caracteres`
        );
      }
    }

    // Validar IDs (formato UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (transferData.destino_id && !uuidRegex.test(transferData.destino_id)) {
      errors.push("El ID de destino no tiene un formato válido");
    }

    if (transferData.moneda_id && !uuidRegex.test(transferData.moneda_id)) {
      errors.push("El ID de moneda no tiene un formato válido");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida rangos de fechas
   */
  static validateDateRange(desde?: string, hasta?: string): ValidationResult {
    const errors: string[] = [];

    if (desde && hasta) {
      const fechaDesde = new Date(desde);
      const fechaHasta = new Date(hasta);

      if (fechaDesde > fechaHasta) {
        errors.push(
          "La fecha 'desde' no puede ser posterior a la fecha 'hasta'"
        );
      }

      // Validar que no sea un rango muy amplio (más de 1 año)
      const diffTime = Math.abs(fechaHasta.getTime() - fechaDesde.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 365) {
        errors.push("El rango de fechas no puede ser mayor a 1 año");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitiza una cadena de texto
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, "") // Remover caracteres potencialmente peligrosos
      .substring(0, 1000); // Limitar longitud
  }

  /**
   * Valida que un archivo tenga el tamaño y tipo correcto
   */
  static validateFile(
    file: File,
    allowedTypes: string[] = []
  ): ValidationResult {
    const errors: string[] = [];

    // Validar tamaño
    if (file.size > LIMITS.MAX_FILE_SIZE) {
      errors.push(
        `El archivo excede el tamaño máximo permitido (${
          LIMITS.MAX_FILE_SIZE / 1024 / 1024
        }MB)`
      );
    }

    // Validar tipo
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(
        `Tipo de archivo no permitido. Tipos válidos: ${allowedTypes.join(
          ", "
        )}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
