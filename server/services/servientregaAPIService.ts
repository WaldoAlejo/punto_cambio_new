import axios from "axios";
import https from "https";

const BASE_URL = "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";
const RETAIL_URL = "https://servientrega-ecuador.appsiscore.com/app/ws/serviretail_cs.php";

// Para evitar problemas de SSL en desarrollo
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface ServientregaCredentials {
  usuingreso: string;
  contrasenha: string;
}

export interface ServientregaAPIResponse {
  [key: string]: any;
}

export class ServientregaAPIService {
  private credentials: ServientregaCredentials;
  public apiUrl: string = BASE_URL; // Permite forzar la URL desde fuera si es necesario

  constructor(credentials: ServientregaCredentials) {
    this.credentials = credentials;
  }

  async callAPI(
    payload: Record<string, any>, 
    timeoutMs: number = 15000, 
    useRetailUrl: boolean = false
  ): Promise<ServientregaAPIResponse> {
    try {
      // Permite forzar la URL desde la instancia
      const url = useRetailUrl ? RETAIL_URL : this.apiUrl || BASE_URL;
      const fullPayload = { ...payload, ...this.credentials };
      
      console.log(`🔗 Llamando a ${useRetailUrl ? 'RETAIL' : 'MAIN'} API:`, url);
      console.log(`📦 Payload:`, JSON.stringify(fullPayload, null, 2));
      
      const { data } = await axios.post(url, fullPayload, {
        headers: { "Content-Type": "application/json" },
        httpsAgent,
        timeout: timeoutMs,
        maxRedirects: 3,
        validateStatus: (status) => status < 500,
      });

      console.log(`📋 Respuesta:`, JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error("❌ Error al consumir API Servientrega:", error);

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error(
            `Timeout al conectar con Servientrega después de ${timeoutMs}ms`
          );
        }
        if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
          throw new Error(
            `No se puede conectar con Servientrega (${error.code})`
          );
        }
        throw new Error(`Error al conectar con Servientrega: ${error.message}`);
      }

      throw new Error("Error al conectar con Servientrega");
    }
  }

  // Métodos específicos para diferentes tipos de consultas
  async obtenerProductos(): Promise<ServientregaAPIResponse> {
    return this.callAPI({ tipo: "obtener_producto" });
  }

  async obtenerPaises(): Promise<ServientregaAPIResponse> {
    return this.callAPI({ tipo: "obtener_paises" });
  }

  async obtenerCiudades(codpais: number): Promise<ServientregaAPIResponse> {
    return this.callAPI({ tipo: "obtener_ciudades", codpais });
  }

  async obtenerAgencias(): Promise<ServientregaAPIResponse> {
    return this.callAPI({ tipo: "obtener_agencias_aliadas" });
  }

  async obtenerEmpaques(): Promise<ServientregaAPIResponse> {
    return this.callAPI({ tipo: "obtener_empaqueyembalaje" });
  }

  async calcularTarifa(payload: Record<string, any>): Promise<ServientregaAPIResponse> {
    // El payload ya debe tener todos los campos requeridos por Servientrega
    return this.callAPI(payload);
  }

  async generarGuia(payload: Record<string, any>): Promise<ServientregaAPIResponse> {
    return this.callAPI({
      tipo: "GeneracionGuia",
      ...payload
    });
  }

  async anularGuia(guia: string): Promise<ServientregaAPIResponse> {
    return this.callAPI({
      tipo: "AnulacionGuia",
      guia
    });
  }
}