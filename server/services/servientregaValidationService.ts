export interface TarifaRequest {
  ciu_ori: string;
  provincia_ori: string;
  ciu_des: string;
  provincia_des: string;
  valor_seguro: number | string;
  valor_declarado: number | string;
  peso: number | string;
  alto: number | string;
  ancho: number | string;
  largo: number | string;
  recoleccion?: string;
  nombre_producto?: string;
  empaque?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ServientregaValidationService {
  private static readonly PRODUCTOS_VALIDOS = ["MERCANCIA PREMIER", "DOCUMENTO"];
  private static readonly PESO_MINIMO = 2;

  static validateTarifaRequest(request: TarifaRequest): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validar campos requeridos
    const requiredFields = [
      'ciu_ori', 'provincia_ori', 'ciu_des', 'provincia_des',
      'valor_seguro', 'valor_declarado', 'peso', 'alto', 'ancho', 'largo'
    ];

    for (const field of requiredFields) {
      if (!request[field as keyof TarifaRequest]) {
        errors.push({
          field,
          message: `El campo ${field} es requerido`
        });
      }
    }

    // Validar peso
    const peso = parseFloat(String(request.peso));
    if (isNaN(peso) || peso < this.PESO_MINIMO) {
      errors.push({
        field: 'peso',
        message: `El peso debe ser un número mayor o igual a ${this.PESO_MINIMO} kg`
      });
    }

    // Validar dimensiones
    const dimensiones = ['alto', 'ancho', 'largo'];
    for (const dim of dimensiones) {
      const valor = parseFloat(String(request[dim as keyof TarifaRequest]));
      if (isNaN(valor) || valor <= 0) {
        errors.push({
          field: dim,
          message: `${dim} debe ser un número mayor a 0`
        });
      }
    }

    // Validar valores monetarios
    const valoresMonetarios = ['valor_seguro', 'valor_declarado'];
    for (const valor of valoresMonetarios) {
      const amount = parseFloat(String(request[valor as keyof TarifaRequest]));
      if (isNaN(amount) || amount < 0) {
        errors.push({
          field: valor,
          message: `${valor} debe ser un número mayor o igual a 0`
        });
      }
    }

    return errors;
  }

  static sanitizeTarifaRequest(request: TarifaRequest): Record<string, string> {
    const peso = Math.max(this.PESO_MINIMO, parseFloat(String(request.peso)));
    const producto = this.PRODUCTOS_VALIDOS.includes(request.nombre_producto || '') 
      ? request.nombre_producto 
      : "MERCANCIA PREMIER";

    return {
      ciu_ori: String(request.ciu_ori).toUpperCase(),
      provincia_ori: String(request.provincia_ori).toUpperCase(),
      ciu_des: String(request.ciu_des).toUpperCase(),
      provincia_des: String(request.provincia_des).toUpperCase(),
      valor_seguro: String(request.valor_seguro),
      valor_declarado: String(request.valor_declarado),
      peso: String(peso),
      alto: String(request.alto),
      ancho: String(request.ancho),
      largo: String(request.largo),
      recoleccion: request.recoleccion || "NO",
      nombre_producto: producto,
      empaque: request.empaque || ""
    };
  }

  static parseServientregaErrors(response: any): string[] {
    if (typeof response !== 'string' || !response.includes('proceso')) {
      return [];
    }

    const errors: string[] = [];
    const regex = /\{"proceso":"([^"]+)"\}/g;
    let match;
    
    while ((match = regex.exec(response)) !== null) {
      errors.push(match[1]);
    }
    
    return errors;
  }
}