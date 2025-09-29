export interface TarifaRequest {
  // Origen/Destino (requeridos para nacional)
  ciu_ori: string;
  provincia_ori: string;
  ciu_des: string;
  provincia_des: string;

  // Valores del cálculo
  valor_seguro: number | string;
  valor_declarado: number | string;
  peso: number | string;
  alto: number | string;
  ancho: number | string;
  largo: number | string;

  // Opcionales
  recoleccion?: string; // "SI" | "NO"
  nombre_producto?: string; // "MERCANCIA PREMIER" | "DOCUMENTO"
  empaque?: string;

  // Internacional (opcionales; si vienen, se usa flujo internacional)
  pais_ori?: string;
  pais_des?: string;
  codigo_postal_ori?: string | number;
  codigo_postal_des?: string | number;

  // Permitir override explícito (si no se provee, se deduce)
  tipo?: "obtener_tarifa_nacional" | "obtener_tarifa_internacional";
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ServientregaValidationService {
  // Solo estos 2, según la corrección del flujo
  private static readonly PRODUCTOS_VALIDOS = [
    "MERCANCIA PREMIER",
    "DOCUMENTO",
  ];

  private static readonly PESO_MINIMO = 0.5;
  private static readonly DEFAULT_EMPAQUE = "AISLANTE DE HUMEDAD";

  /** Valida estructura y rangos de una solicitud de tarifa */
  static validateTarifaRequest(request: TarifaRequest): ValidationError[] {
    const errors: ValidationError[] = [];

    // Requeridos mínimos para ambos flujos (nacional/internacional)
    const requiredFields: (keyof TarifaRequest)[] = [
      "ciu_ori",
      "provincia_ori",
      "ciu_des",
      "provincia_des",
      "valor_seguro",
      "valor_declarado",
      "peso",
      "alto",
      "ancho",
      "largo",
    ];

    for (const field of requiredFields) {
      if (
        request[field] === undefined ||
        request[field] === null ||
        String(request[field]).toString().trim() === ""
      ) {
        errors.push({ field, message: `El campo ${field} es requerido` });
      }
    }

    // Peso mínimo
    const peso = parseFloat(String(request.peso));
    if (isNaN(peso) || peso < this.PESO_MINIMO) {
      errors.push({
        field: "peso",
        message: `El peso debe ser un número mayor o igual a ${this.PESO_MINIMO} kg`,
      });
    }

    // Dimensiones > 0
    (["alto", "ancho", "largo"] as const).forEach((dim) => {
      const v = parseFloat(String(request[dim]));
      if (isNaN(v) || v <= 0) {
        errors.push({
          field: dim,
          message: `${dim} debe ser un número mayor a 0`,
        });
      }
    });

    // Valores monetarios >= 0
    (["valor_seguro", "valor_declarado"] as const).forEach((name) => {
      const amount = parseFloat(String(request[name]));
      if (isNaN(amount) || amount < 0) {
        errors.push({
          field: name,
          message: `${name} debe ser un número mayor o igual a 0`,
        });
      }
    });

    // Validar producto si viene
    if (request.nombre_producto) {
      const normalizado = String(request.nombre_producto).trim().toUpperCase();
      if (!this.PRODUCTOS_VALIDOS.includes(normalizado)) {
        errors.push({
          field: "nombre_producto",
          message: `nombre_producto inválido. Valores permitidos: ${this.PRODUCTOS_VALIDOS.join(
            ", "
          )}`,
        });
      }
    }

    // Validar recolección si viene
    if (request.recoleccion) {
      const rec = String(request.recoleccion).trim().toUpperCase();
      if (rec !== "SI" && rec !== "NO") {
        errors.push({
          field: "recoleccion",
          message: `recoleccion debe ser "SI" o "NO"`,
        });
      }
    }

    // Para internacional sugerimos CP si se provee paises
    const isInternacional = this.isInternacional(request);
    if (isInternacional) {
      // No los marcamos como "requeridos" estrictamente aquí, pero podrías hacerlo
      // si la API los exige siempre.
      // if (!request.codigo_postal_ori) errors.push({ field: "codigo_postal_ori", message: "Obligatorio para internacional" });
      // if (!request.codigo_postal_des) errors.push({ field: "codigo_postal_des", message: "Obligatorio para internacional" });
    }

    return errors;
  }

  /** Limpia y normaliza el payload para Servientrega (strings, mayúsculas, defaults) */
  static sanitizeTarifaRequest(request: TarifaRequest): Record<string, string> {
    // Peso con mínimo
    const peso = Math.max(this.PESO_MINIMO, parseFloat(String(request.peso)));

    // Producto: default a MERCANCIA PREMIER, solo 2 permitidos
    const prodInput = (request.nombre_producto || "")
      .toString()
      .trim()
      .toUpperCase();
    const producto = this.PRODUCTOS_VALIDOS.includes(prodInput)
      ? prodInput
      : "MERCANCIA PREMIER";

    // Recolección: limpiar a SI/NO, default NO
    const recoInput = (request.recoleccion || "NO")
      .toString()
      .trim()
      .toUpperCase();
    const recoleccion = recoInput === "SI" ? "SI" : "NO";

    // Empaque por defecto
    const empaque = (request.empaque || this.DEFAULT_EMPAQUE).toString().trim();

    // Determinar tipo si no viene
    const tipo =
      request.tipo ||
      (this.isInternacional(request)
        ? "obtener_tarifa_internacional"
        : "obtener_tarifa_nacional");

    // Payload base
    const payload: Record<string, string> = {
      tipo,
      ciu_ori: String(request.ciu_ori).trim().toUpperCase(),
      provincia_ori: String(request.provincia_ori).trim().toUpperCase(),
      ciu_des: String(request.ciu_des).trim().toUpperCase(),
      provincia_des: String(request.provincia_des).trim().toUpperCase(),
      valor_seguro: String(request.valor_seguro).trim(),
      valor_declarado: String(request.valor_declarado).trim(),
      peso: String(peso),
      alto: String(request.alto).trim(),
      ancho: String(request.ancho).trim(),
      largo: String(request.largo).trim(),
      recoleccion,
      nombre_producto: producto,
      empaque,
      // (credenciales se agregan en ServientregaAPIService.callAPI)
    };

    // Campos internacionales si corresponden
    if (request.pais_ori)
      payload.pais_ori = String(request.pais_ori).trim().toUpperCase();
    if (request.pais_des)
      payload.pais_des = String(request.pais_des).trim().toUpperCase();
    if (
      request.codigo_postal_ori !== undefined &&
      request.codigo_postal_ori !== null
    ) {
      payload.codigo_postal_ori = String(request.codigo_postal_ori).trim();
    }
    if (
      request.codigo_postal_des !== undefined &&
      request.codigo_postal_des !== null
    ) {
      payload.codigo_postal_des = String(request.codigo_postal_des).trim();
    }

    return payload;
  }

  /** Intenta extraer mensajes de error devueltos por el servicio */
  static parseServientregaErrors(response: any): string[] {
    // Muchas veces el backend devuelve strings con fragmentos JSON {"proceso":"..."}
    if (typeof response === "string") {
      const errors: string[] = [];
      const regex = /\{"proceso":"([^"]+)"\}/g;
      let match;
      while ((match = regex.exec(response)) !== null) {
        errors.push(match[1]);
      }
      return errors;
    }

    // Si es objeto tipo { fetch: { proceso: "..."} } o { proceso: "..." }
    if (response && typeof response === "object") {
      const list: string[] = [];

      // Caso array de objetos con proceso
      if (Array.isArray(response)) {
        response.forEach((item) => {
          if (item?.proceso && typeof item.proceso === "string") {
            list.push(item.proceso);
          }
        });
      }

      // Caso objeto con fetch
      if (response.fetch) {
        const f = response.fetch;
        if (Array.isArray(f)) {
          f.forEach((item) => {
            if (item?.proceso && typeof item.proceso === "string") {
              list.push(item.proceso);
            }
          });
        } else if (typeof f === "object" && typeof f.proceso === "string") {
          list.push(f.proceso);
        }
      }

      // Caso objeto plano con proceso
      if (typeof response.proceso === "string") {
        list.push(response.proceso);
      }

      return list;
    }

    return [];
  }

  /** Determina si el request debe tratarse como internacional */
  private static isInternacional(req: TarifaRequest): boolean {
    // Regla: si pais_des existe y no es ECUADOR => internacional
    // (si no viene pais_des, se asume nacional)
    const destino = (req.pais_des || "").toString().trim().toUpperCase();
    const origen = (req.pais_ori || "").toString().trim().toUpperCase();

    if (destino && destino !== "ECUADOR") return true;
    // fallback por si te interesa tratar cuando origen no es Ecuador
    if (origen && origen !== "ECUADOR") return true;

    return false;
  }
}
