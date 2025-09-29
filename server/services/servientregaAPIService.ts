import axios from "axios";
import https from "https";

const MAIN_URL =
  "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";
const RETAIL_URL =
  "https://servientrega-ecuador.appsiscore.com/app/ws/serviretail_cs.php";

// Evita problemas de SSL si el proveedor tiene cadenas intermedias raras
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface ServientregaCredentials {
  usuingreso: string;
  contrasenha: string;
}

export interface ServientregaAPIResponse {
  [key: string]: any;
}

type WireMode = "json" | "form";

function isEmptyUpstream(data: any): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data === "string" && data.trim() === "") return true;
  if (Array.isArray(data) && data.length === 0) return true;
  return false;
}

async function doPost(
  url: string,
  payload: Record<string, any>,
  mode: WireMode,
  timeoutMs: number
) {
  let body: any;
  let headers: any;

  if (mode === "json") {
    body = payload;
    headers = {
      "Content-Type": "application/json",
      "User-Agent": "PuntoCambio/1.0",
    };
  } else {
    const form = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => form.append(k, String(v)));
    body = form.toString();
    headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PuntoCambio/1.0",
    };
  }

  const start = Date.now();
  const res = await axios.post(url, body, {
    headers,
    httpsAgent,
    timeout: timeoutMs,
    validateStatus: (s) => s < 500,
    maxRedirects: 2,
  });
  const ms = Date.now() - start;

  // Logging útil (mantén si lo necesitas; si no, puedes reducirlo)
  console.log(
    `🔗 POST ${url} [${mode}] -> HTTP ${
      res.status
    } en ${ms}ms | vacio=${isEmptyUpstream(res.data)}`
  );

  return res;
}

export class ServientregaAPIService {
  private credentials: ServientregaCredentials;
  /**
   * Permite sobreescribir la URL “main” desde fuera (router lee .env y la setea).
   * Si no se setea, usa MAIN_URL.
   */
  public apiUrl: string = MAIN_URL;

  constructor(credentials: ServientregaCredentials) {
    this.credentials = credentials;
  }

  /**
   * Estrategia robusta para tarifas:
   *  1) MAIN JSON
   *  2) MAIN FORM
   *  3) RETAIL JSON
   *  4) RETAIL FORM
   */
  async calcularTarifa(
    payload: Record<string, any>,
    timeoutMs = 15000
  ): Promise<ServientregaAPIResponse> {
    const basePayload = { ...payload, ...this.credentials };

    // Orden de intentos
    const attempts: Array<{ url: string; mode: WireMode; label: string }> = [
      { url: this.apiUrl || MAIN_URL, mode: "json", label: "MAIN JSON" },
      { url: this.apiUrl || MAIN_URL, mode: "form", label: "MAIN FORM" },
      { url: RETAIL_URL, mode: "json", label: "RETAIL JSON" },
      { url: RETAIL_URL, mode: "form", label: "RETAIL FORM" },
    ];

    let lastErr: any = null;

    for (const att of attempts) {
      try {
        const res = await doPost(att.url, basePayload, att.mode, timeoutMs);

        // 4xx del proveedor → propaga con mensaje claro
        if (res.status >= 400) {
          const e: any = new Error(
            `HTTP ${res.status} en ${att.label}: ${JSON.stringify(res.data)}`
          );
          e.httpStatus = res.status;
          e.endpoint = att.url;
          throw e;
        }

        // Consideramos “vacío” como fallo recuperable → probamos siguiente intento
        if (isEmptyUpstream(res.data)) {
          console.warn(
            `⚠️ Respuesta vacía en ${att.label}, probando siguiente...`
          );
          lastErr = new Error("UPSTREAM_EMPTY");
          (lastErr as any).code = "UPSTREAM_EMPTY";
          (lastErr as any).endpoint = att.url;
          continue;
        }

        // ¡Listo!
        return res.data;
      } catch (err: any) {
        lastErr = err;
        // Si fue timeout o vacío, seguimos con el siguiente intento
        if (
          err?.code === "ECONNABORTED" ||
          err?.code === "UPSTREAM_EMPTY" ||
          err?.response?.status === 408
        ) {
          console.warn(`⏳/🈳 ${att.label} falló: ${err?.message || err}`);
          continue;
        }
        // Para otros errores (p.ej. 4xx con body), guarda y continua al siguiente intento
        console.warn(`❗ ${att.label} error: ${err?.message || err}`);
        continue;
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    const out: any = new Error(
      lastErr?.code === "UPSTREAM_EMPTY"
        ? "Proveedor no devolvió datos (tarifa vacía) en todos los endpoints"
        : "Error al conectar con Servientrega"
    );
    out.code = lastErr?.code || "UPSTREAM_FAILURE";
    out.httpStatus = lastErr?.httpStatus || 502;
    throw out;
  }

  // Generación de guía: aquí el proveedor tradicionalmente quiere JSON (y funciona bien).
  async generarGuia(
    payload: Record<string, any>,
    timeoutMs = 20000
  ): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "GeneracionGuia", ...payload, ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);

    if (isEmptyUpstream(res.data)) {
      const e: any = new Error("Respuesta vacía al generar guía");
      e.code = "UPSTREAM_EMPTY";
      e.httpStatus = 502;
      e.endpoint = url;
      throw e;
    }
    return res.data;
  }

  // **OJO**: el proveedor para anulación de aliados suele usar:
  //  { "tipo":"ActualizaEstadoGuia", "guia":"...", "estado":"Anulada" }
  async anularGuia(
    guia: string,
    estado = "Anulada",
    timeoutMs = 15000
  ): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = {
      tipo: "ActualizaEstadoGuia",
      guia,
      estado,
      ...this.credentials,
    };
    const res = await doPost(url, full, "json", timeoutMs);

    if (isEmptyUpstream(res.data)) {
      const e: any = new Error("Respuesta vacía al anular guía");
      e.code = "UPSTREAM_EMPTY";
      e.httpStatus = 502;
      e.endpoint = url;
      throw e;
    }
    return res.data;
  }

  // Métodos de catálogo (dejan JSON que es lo que mejor responde en aliados)
  async obtenerProductos(timeoutMs = 10000) {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_producto", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return res.data;
  }

  async obtenerPaises(timeoutMs = 10000) {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_paises", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return res.data;
  }

  async obtenerCiudades(codpais: number, timeoutMs = 10000) {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_ciudades", codpais, ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return res.data;
  }

  async obtenerAgencias(timeoutMs = 10000) {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_agencias_aliadas", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return res.data;
  }

  async obtenerEmpaques(timeoutMs = 10000) {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_empaqueyembalaje", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return res.data;
  }
}
