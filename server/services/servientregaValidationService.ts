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
  // SOLO estos dos funcionan con Servientrega API
  private static readonly PRODUCTOS_VALIDOS = [
    "DOCUMENTO UNITARIO",
    "MERCANCIA PREMIER",
  ] as const;

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
    if (
      request.nombre_producto &&
      !this.PRODUCTOS_VALIDOS.includes(
        request.nombre_producto.toUpperCase() as any
      )
    ) {
      errors.push({
        field: "nombre_producto",
        message: `nombre_producto inválido. Válidos: ${this.PRODUCTOS_VALIDOS.join(
          ", "
        )}`,
      });
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
    const producto = this.PRODUCTOS_VALIDOS.includes(productoNormalizado as any)
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
  static parseServientregaErrors(response: any): string[] {
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
  static stripEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (
        v !== undefined &&
        v !== null &&
        !(typeof v === "string" && v.trim() === "")
      ) {
        (out as any)[k] = v;
      }
    }
    return out;
  }
}
