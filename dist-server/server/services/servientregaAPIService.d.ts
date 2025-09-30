export interface ServientregaCredentials {
    usuingreso: string;
    contrasenha: string;
}
export interface ServientregaAPIResponse {
    [key: string]: any;
}
export declare class ServientregaAPIService {
    private credentials;
    /** Permite sobreescribir la URL main desde fuera (router lee .env y la setea). */
    apiUrl: string;
    constructor(credentials: ServientregaCredentials);
    /**
     * Estrategia robusta para tarifas:
     *  1) MAIN JSON
     *  2) MAIN FORM
     *  3) RETAIL JSON
     *  4) RETAIL FORM
     */
    calcularTarifa(payload: Record<string, any>, timeoutMs?: number): Promise<ServientregaAPIResponse>;
    generarGuia(payload: Record<string, any>, timeoutMs?: number): Promise<ServientregaAPIResponse>;
    anularGuia(guia: string, estado?: string, timeoutMs?: number): Promise<ServientregaAPIResponse>;
    obtenerProductos(timeoutMs?: number): Promise<any>;
    obtenerPaises(timeoutMs?: number): Promise<any>;
    obtenerCiudades(codpais: number, timeoutMs?: number): Promise<any>;
    obtenerAgencias(timeoutMs?: number): Promise<any>;
    obtenerEmpaques(timeoutMs?: number): Promise<any>;
    callAPI(payload: Record<string, any>, timeoutMs?: number, useRetailUrl?: boolean): Promise<ServientregaAPIResponse>;
}
