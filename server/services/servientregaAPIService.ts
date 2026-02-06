import axios from "axios";
import https from "https";

const log = (...args: unknown[]) => {
  console.warn(...args);
};

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
  [key: string]: unknown;
}

type WireMode = "json" | "form";

function isEmptyUpstream(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data === "string" && data.trim() === "") return true;
  if (Array.isArray(data) && data.length === 0) return true;
  return false;
}

// 👉 Quita BOM/whitespace y trata de parsear JSON si viene como string
function normalizeUpstream<T = unknown>(raw: unknown): T {
  try {
    if (typeof raw !== "string") return raw as T;
    // quitar BOM UTF-8 y espacios
    const trimmed = raw.replace(/^\uFEFF/, "").trim();
    if (trimmed === "") return trimmed as unknown as T;
    const first = trimmed[0];
    if (first === "{" || first === "[") {
      return JSON.parse(trimmed) as T;
    }
    return trimmed as unknown as T;
  } catch {
    // si no se puede parsear, devuelvo el original
    return raw as T;
  }
}

type UpstreamError = Error & {
  code?: string;
  httpStatus?: number;
  endpoint?: string;
};

function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function getErrorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function getAxiosStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const response = (err as { response?: unknown }).response;
  if (!response || typeof response !== "object") return undefined;
  const status = (response as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function createUpstreamError(
  message: string,
  extras?: { code?: string; httpStatus?: number; endpoint?: string }
): UpstreamError {
  const err = new Error(message) as UpstreamError;
  if (extras?.code) err.code = extras.code;
  if (extras?.httpStatus) err.httpStatus = extras.httpStatus;
  if (extras?.endpoint) err.endpoint = extras.endpoint;
  return err;
}

async function doPost(
  url: string,
  payload: Record<string, unknown>,
  mode: WireMode,
  timeoutMs: number
) {
  let body: Record<string, unknown> | string;
  let headers: Record<string, string>;

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

  // Logging útil (moderado)
  log(
    `🔗 POST ${url} [${mode}] -> HTTP ${
      res.status
    } en ${ms}ms | vacio=${isEmptyUpstream(res.data)}`
  );

  return res;
}

export class ServientregaAPIService {
  private credentials: ServientregaCredentials;
  /** Permite sobreescribir la URL main desde fuera (router lee .env y la setea). */
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
    payload: Record<string, unknown>,
    timeoutMs = 15000
  ): Promise<ServientregaAPIResponse> {
    const basePayload = { ...payload, ...this.credentials };

    const attempts: Array<{ url: string; mode: WireMode; label: string }> = [
      { url: this.apiUrl || MAIN_URL, mode: "json", label: "MAIN JSON" },
      { url: this.apiUrl || MAIN_URL, mode: "form", label: "MAIN FORM" },
      { url: RETAIL_URL, mode: "json", label: "RETAIL JSON" },
      { url: RETAIL_URL, mode: "form", label: "RETAIL FORM" },
    ];

    let lastErr: UpstreamError | null = null;

    for (const att of attempts) {
      try {
        const res = await doPost(att.url, basePayload, att.mode, timeoutMs);
        const data = normalizeUpstream<ServientregaAPIResponse>(res.data);

        if (res.status >= 400) {
          throw createUpstreamError(
            `HTTP ${res.status} en ${att.label}: ${JSON.stringify(data)}`,
            { httpStatus: res.status, endpoint: att.url }
          );
        }

        if (isEmptyUpstream(data)) {
          console.warn(
            `⚠️ Respuesta vacía en ${att.label}, probando siguiente...`
          );
          lastErr = createUpstreamError("UPSTREAM_EMPTY", {
            code: "UPSTREAM_EMPTY",
            endpoint: att.url,
          });
          continue;
        }

        return data;
      } catch (err: unknown) {
        lastErr = (err instanceof Error ? (err as UpstreamError) : null) ?? lastErr;

        const code = getErrorCode(err);
        const status = getAxiosStatus(err);
        const message = getErrorMessage(err);

        if (
          code === "ECONNABORTED" ||
          code === "UPSTREAM_EMPTY" ||
          status === 408
        ) {
          console.warn(`⏳/🈳 ${att.label} falló: ${message}`);
          continue;
        }
        console.warn(`❗ ${att.label} error: ${message}`);
        continue;
      }
    }

    const out = createUpstreamError(
      lastErr?.code === "UPSTREAM_EMPTY"
        ? "Proveedor no devolvió datos (tarifa vacía) en todos los endpoints"
        : "Error al conectar con Servientrega"
    );
    out.code = lastErr?.code || "UPSTREAM_FAILURE";
    out.httpStatus = lastErr?.httpStatus || 502;
    throw out;
  }

  // Generación de guía (JSON)
  async generarGuia(
    payload: Record<string, unknown>,
    timeoutMs = 20000
  ): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "GeneracionGuia", ...payload, ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    const data = normalizeUpstream<ServientregaAPIResponse>(res.data);

    if (isEmptyUpstream(data)) {
      throw createUpstreamError("Respuesta vacía al generar guía", {
        code: "UPSTREAM_EMPTY",
        httpStatus: 502,
        endpoint: url,
      });
    }
    return data;
  }

  // Anulación / actualización de estado
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
    const data = normalizeUpstream<ServientregaAPIResponse>(res.data);

    if (isEmptyUpstream(data)) {
      throw createUpstreamError("Respuesta vacía al anular guía", {
        code: "UPSTREAM_EMPTY",
        httpStatus: 502,
        endpoint: url,
      });
    }
    return data;
  }

  // Catálogos (JSON)
  async obtenerProductos(timeoutMs = 10000): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_producto", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return normalizeUpstream<ServientregaAPIResponse>(res.data);
  }

  async obtenerPaises(timeoutMs = 10000): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_paises", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return normalizeUpstream<ServientregaAPIResponse>(res.data);
  }

  async obtenerCiudades(
    codpais: number,
    timeoutMs = 10000
  ): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_ciudades", codpais, ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return normalizeUpstream<ServientregaAPIResponse>(res.data);
  }

  async obtenerAgencias(timeoutMs = 10000): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_agencias_aliadas", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return normalizeUpstream<ServientregaAPIResponse>(res.data);
  }

  async obtenerEmpaques(timeoutMs = 10000): Promise<ServientregaAPIResponse> {
    const url = this.apiUrl || MAIN_URL;
    const full = { tipo: "obtener_empaqueyembalaje", ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    return normalizeUpstream<ServientregaAPIResponse>(res.data);
  }

  // =========================================================
  // 🔁 Compatibilidad: callAPI(payload, timeoutMs?, useRetailUrl?)
  // =========================================================
  public async callAPI(
    payload: Record<string, unknown>,
    timeoutMs: number = 15000,
    useRetailUrl: boolean = false
  ): Promise<ServientregaAPIResponse> {
    const tipo = (payload?.tipo || "").toString();

    if (tipo === "obtener_tarifa_nacional") {
      return this.calcularTarifa(payload, timeoutMs);
    }

    if (tipo === "GeneracionGuia") {
      return this.generarGuia(payload, Math.max(timeoutMs, 20000));
    }

    if (tipo === "ActualizaEstadoGuia" || tipo === "AnulacionGuia") {
      const guia = payload.guia ?? payload?.Guia ?? payload?.numero_guia;
      const estado = payload.estado || "Anulada";
      if (!guia) {
        throw new Error(
          "Falta 'guia' en payload para ActualizaEstadoGuia/AnulacionGuia"
        );
      }
      return this.anularGuia(String(guia), String(estado), timeoutMs);
    }

    if (tipo === "obtener_producto") return this.obtenerProductos(timeoutMs);
    if (tipo === "obtener_paises") return this.obtenerPaises(timeoutMs);
    if (tipo === "obtener_ciudades") {
      const codpais = Number(payload?.codpais ?? payload?.pais ?? 0);
      if (!codpais) throw new Error("Falta 'codpais' para obtener_ciudades");
      return this.obtenerCiudades(codpais, timeoutMs);
    }
    if (tipo === "obtener_agencias_aliadas")
      return this.obtenerAgencias(timeoutMs);
    if (tipo === "obtener_empaqueyembalaje")
      return this.obtenerEmpaques(timeoutMs);

    // Genérico: POST JSON a MAIN o RETAIL (según useRetailUrl)
    const url = useRetailUrl ? RETAIL_URL : this.apiUrl || MAIN_URL;
    const full = { ...payload, ...this.credentials };
    const res = await doPost(url, full, "json", timeoutMs);
    const data = normalizeUpstream<ServientregaAPIResponse>(res.data);

    if (isEmptyUpstream(data)) {
      throw createUpstreamError("Respuesta vacía del proveedor", {
        code: "UPSTREAM_EMPTY",
        httpStatus: 502,
        endpoint: url,
      });
    }
    return data;
  }
}
