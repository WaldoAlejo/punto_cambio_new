export interface TarifaRequest {
    tipo?: string;
    ciu_ori: string;
    provincia_ori: string;
    ciu_des: string;
    provincia_des: string;
    valor_seguro: number | string;
    valor_declarado?: number | string;
    peso: number | string;
    alto: number | string;
    ancho: number | string;
    largo: number | string;
    recoleccion?: string;
    nombre_producto?: string;
    empaque?: string;
    pais_ori?: string;
    pais_des?: string;
    codigo_postal_ori?: string;
    codigo_postal_des?: string;
}
export interface ValidationError {
    field: string;
    message: string;
}
export declare class ServientregaValidationService {
    private static readonly PRODUCTOS_VALIDOS;
    private static readonly PESO_MINIMO;
    /**
     * Valida los campos necesarios para calcular tarifa.
     * No obliga a `empaque` ni a `valor_declarado`.
     */
    static validateTarifaRequest(request: TarifaRequest): ValidationError[];
    /**
     * Prepara el payload para el WS.
     * - No agrega `empaque` por defecto (solo si viene con valor no vacío).
     * - Normaliza mayúsculas donde aplica.
     * - `recoleccion` por defecto "NO".
     * - Asegura peso mínimo 0.5.
     * - `valor_declarado` default 0 si no viene.
     */
    static sanitizeTarifaRequest(request: TarifaRequest): Record<string, string>;
    /**
     * Extrae mensajes de error que algunos endpoints devuelven en strings con {"proceso":"..."}.
     */
    static parseServientregaErrors(response: any): string[];
    /**
     * Utilidad opcional: quitar claves vacías antes de enviar al WS.
     */
    static stripEmpty<T extends Record<string, any>>(obj: T): Partial<T>;
}
