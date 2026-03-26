// servientregaValidationService.ts

export interface TarifaRequest {
  tipo?: string; // normalmente "obtener_tarifa_nacional"
  ciu_ori: string;
  provincia_ori: string;
  ciu_des: string;
  provincia_des: string;
  valor_seguro: number | string;
  // 🔓 valor_declarado deja de ser obligatorio
  valor_declarado?: number | string;
  peso: number | string;
  alto: number | string;
  ancho: number | string;
  largo: number | string;
  recoleccion?: string; // "SI" | "NO"
  nombre_producto?: string; // e.g. "MERCANCIA PREMIER"
  empaque?: string; // opcional: solo enviar si existe
  // campos opcionales para internacional
  pais_ori?: string;
  pais_des?: string;
  codigo_postal_ori?: string;
  codigo_postal_des?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ServientregaValidationService {
    /**
     * Valida RUC, cédula y pasaporte ecuatorianos
     * Retorna true si es válido, false si no
     */
    static validarIdentificacionEcuatorianaOExtranjera(valor: string): boolean {
      if (!valor || typeof valor !== "string") return false;
      const clean = valor.trim();
      
      // Si no son solo números, validar como pasaporte genérico
      if (!/^\d+$/.test(clean)) {
        return /^[A-Z0-9]{6,12}$/i.test(clean);
      }

      const len = clean.length;
      if (len !== 10 && len !== 13) return false;

      const provincia = parseInt(clean.substring(0, 2), 10);
      if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

      const tercerDigito = parseInt(clean[2], 10);

      if (tercerDigito < 6) {
        // Persona Natural: Cédula (10) o RUC (13)
        if (len === 13 && parseInt(clean.substring(10), 10) === 0) return false;
        
        // Algoritmo de cédula (módulo 10)
        return ServientregaValidationService.validarCedula(clean.substring(0, 10));
      } else if (tercerDigito === 6) {
        // Entidad Pública
        if (len !== 13) return false;
        if (parseInt(clean.substring(9), 10) === 0) return false;
        
        const d9 = parseInt(clean[8], 10);
        const coef = [3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        for (let i = 0; i < 8; i++) {
          suma += parseInt(clean[i], 10) * coef[i];
        }
        const check = (11 - (suma % 11)) % 11;
        const finalCheck = (suma % 11) === 0 ? 0 : check;
        return finalCheck === d9;
      } else if (tercerDigito === 9) {
        // Sociedad Privada o Extranjera
        if (len !== 13) return false;
        if (parseInt(clean.substring(10), 10) === 0) return false;
        
        const d10 = parseInt(clean[9], 10);
        const coef = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let suma = 0;
        for (let i = 0; i < 9; i++) {
          suma += parseInt(clean[i], 10) * coef[i];
        }
        const check = (11 - (suma % 11)) % 11;
        const finalCheck = (suma % 11) === 0 ? 0 : check;
        return finalCheck === d10;
      }

      return false;
    }

    /**
     * Algoritmo oficial de validación de cédula ecuatoriana
     */
    static validarCedula(cedula: string): boolean {
      if (!/^\d{10}$/.test(cedula)) return false;
      const provincia = parseInt(cedula.slice(0, 2), 10);
      if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;
      const tercer = parseInt(cedula[2], 10);
      if (tercer >= 6) return false;
      let suma = 0;
      for (let i = 0; i < 9; i++) {
        let num = parseInt(cedula[i], 10);
        if (i % 2 === 0) {
          num *= 2;
          if (num > 9) num -= 9;
        }
        suma += num;
      }
      const digitoVerificador = (10 - (suma % 10)) % 10;
      return digitoVerificador === parseInt(cedula[9], 10);
    }
  // SOLO estos dos funcionan con Servientrega API
  private static readonly PRODUCTOS_VALIDOS = [
    "DOCUMENTO UNITARIO",
    "MERCANCIA PREMIER",
  ] as const;

  private static isProductoValido(
    value: string
  ): value is (typeof ServientregaValidationService.PRODUCTOS_VALIDOS)[number] {
    return ServientregaValidationService.PRODUCTOS_VALIDOS.includes(
      value as (typeof ServientregaValidationService.PRODUCTOS_VALIDOS)[number]
    );
  }

  private static readonly PESO_MINIMO = 0.5;

  /**
   * Valida los campos necesarios para calcular tarifa.
   * No obliga a `empaque` ni a `valor_declarado`.
   */
  static validateTarifaRequest(request: TarifaRequest): ValidationError[] {
    const errors: ValidationError[] = [];

    // Requeridos base (quitamos valor_declarado)
    const requiredFields: (keyof TarifaRequest)[] = [
      "ciu_ori",
      "provincia_ori",
      "ciu_des",
      "provincia_des",
      "valor_seguro",
      "peso",
      "alto",
      "ancho",
      "largo",
    ];

    for (const field of requiredFields) {
      const v = request[field];
      if (
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "")
      ) {
        errors.push({ field, message: `El campo ${field} es requerido` });
      }
    }

    // Peso
    const peso = parseFloat(String(request.peso));
    if (isNaN(peso) || peso < this.PESO_MINIMO) {
      errors.push({
        field: "peso",
        message: `El peso debe ser un número mayor o igual a ${this.PESO_MINIMO} kg`,
      });
    }

    // Dimensiones
    // Para "DOCUMENTO UNITARIO", permitir dimensiones = 0
    // Para "MERCANCIA PREMIER", requieren ser > 0
    const esDocumento =
      (request.nombre_producto || "").toUpperCase().trim() ===
      "DOCUMENTO UNITARIO";

    (["alto", "ancho", "largo"] as const).forEach((dim) => {
      const val = parseFloat(String(request[dim]));
      if (isNaN(val)) {
        errors.push({
          field: dim,
          message: `${dim} debe ser un número válido`,
        });
      } else if (!esDocumento && val <= 0) {
        // Solo para mercancía: requiere > 0
        errors.push({
          field: dim,
          message: `${dim} debe ser un número mayor a 0`,
        });
      }
      // Para documentos: permitir 0
    });

    // Valores monetarios
    // valor_seguro: requerido y >= 0
    {
      const val = parseFloat(String(request.valor_seguro));
      if (isNaN(val) || val < 0) {
        errors.push({
          field: "valor_seguro",
          message: `valor_seguro debe ser un número mayor o igual a 0`,
        });
      }
    }

    // valor_declarado: OPCIONAL; si viene, debe ser >= 0
    {
      const rawDecl = request.valor_declarado;
      const isEmpty =
        rawDecl === undefined ||
        rawDecl === null ||
        (typeof rawDecl === "string" && rawDecl.trim() === "");
      if (!isEmpty) {
        const valDecl = parseFloat(String(rawDecl));
        if (isNaN(valDecl) || valDecl < 0) {
          errors.push({
            field: "valor_declarado",
            message: `valor_declarado debe ser un número mayor o igual a 0`,
          });
        }
      }
    }

    // Producto (si viene) debe ser uno de los válidos
    if (request.nombre_producto) {
      const producto = request.nombre_producto.toUpperCase().trim();
      if (!this.isProductoValido(producto)) {
      errors.push({
        field: "nombre_producto",
        message: `nombre_producto inválido. Válidos: ${this.PRODUCTOS_VALIDOS.join(
          ", "
        )}`,
      });
      }
    }

    return errors;
  }

  /**
   * Prepara el payload para el WS.
   * - No agrega `empaque` por defecto (solo si viene con valor no vacío).
   * - Normaliza mayúsculas donde aplica.
   * - `recoleccion` por defecto "NO".
   * - Asegura peso mínimo 0.5.
   * - `valor_declarado` default 0 si no viene.
   */
  static sanitizeTarifaRequest(request: TarifaRequest): Record<string, string> {
    const peso = Math.max(
      this.PESO_MINIMO,
      parseFloat(String(request.peso ?? this.PESO_MINIMO))
    );

    const productoNormalizado = (
      request.nombre_producto || "MERCANCIA PREMIER"
    ).toUpperCase();
    const producto = this.isProductoValido(productoNormalizado)
      ? productoNormalizado
      : "MERCANCIA PREMIER";

    // Normalización monetaria segura
    const vs = parseFloat(String(request.valor_seguro ?? 0));
    const vdNum = parseFloat(String(request.valor_declarado ?? 0));
    const valor_seguro = isNaN(vs) ? 0 : vs;
    const valor_declarado = isNaN(vdNum) ? 0 : vdNum; // 👈 default 0

    const payload: Record<string, string> = {
      tipo: (request.tipo || "obtener_tarifa_nacional").toString(),
      ciu_ori: String(request.ciu_ori).toUpperCase(),
      provincia_ori: String(request.provincia_ori).toUpperCase(),
      ciu_des: String(request.ciu_des).toUpperCase(),
      provincia_des: String(request.provincia_des).toUpperCase(),
      valor_seguro: String(valor_seguro),
      valor_declarado: String(valor_declarado), // 👈 siempre se envía como número válido (0 si faltó)
      peso: String(peso),
      alto: String(request.alto),
      ancho: String(request.ancho),
      largo: String(request.largo),
      recoleccion: String(request.recoleccion || "NO").toUpperCase(),
      nombre_producto: producto,
    };

    // Solo incluye empaque si viene y no es vacío
    if (request.empaque && String(request.empaque).trim() !== "") {
      payload.empaque = String(request.empaque);
    }

    // Campos opcionales internacionales
    if (request.pais_ori) payload.pais_ori = String(request.pais_ori);
    if (request.pais_des) payload.pais_des = String(request.pais_des);
    if (request.codigo_postal_ori)
      payload.codigo_postal_ori = String(request.codigo_postal_ori);
    if (request.codigo_postal_des)
      payload.codigo_postal_des = String(request.codigo_postal_des);

    return payload;
  }

  /**
   * Extrae mensajes de error que algunos endpoints devuelven en strings con {"proceso":"..."}.
   */
  static parseServientregaErrors(response: unknown): string[] {
    if (typeof response !== "string" || !response.includes(`"proceso"`)) {
      return [];
    }
    const errors: string[] = [];
    const regex = /\{"proceso":"([^"]+)"\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(response)) !== null) {
      errors.push(match[1]);
    }
    return errors;
  }

  /**
   * Utilidad opcional: quitar claves vacías antes de enviar al WS.
   */
  static stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = obj[key];
      if (
        value !== undefined &&
        value !== null &&
        !(typeof value === "string" && value.trim() === "")
      ) {
        out[key] = value;
      }
    }
    return out;
  }
}
