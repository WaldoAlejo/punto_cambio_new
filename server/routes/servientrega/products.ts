import express from "express";
import {
  ServientregaAPIService,
  ServientregaCredentials,
} from "../../services/servientregaAPIService.js";
import logger from "../../utils/logger.js";

const router = express.Router();

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

// =============================
// Helpers de credenciales y URL
// =============================
function getCredentials(): ServientregaCredentials {
  return {
    usuingreso: process.env.SERVIENTREGA_USER || "INTPUNTOC",
    contrasenha: process.env.SERVIENTREGA_PASSWORD || "73Yes7321t",
  };
}

function getApiUrl(): string {
  return (
    process.env.SERVIENTREGA_URL ||
    "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php"
  );
}

// =============================
// 🔍 DEBUG: Mostrar configuración actual
// =============================
router.get("/debug-config", (_req, res) => {
  const credentials = getCredentials();
  res.json({
    nodeEnv: process.env.NODE_ENV,
    servientrega_user: credentials.usuingreso,
    servientrega_url: getApiUrl(),
    all_env_keys: Object.keys(process.env)
      .filter((k) => k.includes("SERVIENTREGA"))
      .reduce((acc, k) => {
        acc[k] = process.env[k];
        return acc;
      }, {} as Record<string, string | undefined>),
  });
});

// =============================
// Normalización de productos
// =============================
const clean = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const DOC = "DOCUMENTOS";
const MERC = "MERCANCIA PREMIER";

function normalizarProducto(raw?: unknown): "" | typeof DOC | typeof MERC {
  const c = clean(raw);
  if (!c) return "";
  // Cualquier variante que contenga "DOC" → DOCUMENTOS
  if (c.includes("DOC")) return DOC;
  // MERCANCIA PREMIER exacto o cercano
  if (c.includes("MERCANCIA") && c.includes("PREMIER")) return MERC;
  // Ignorar INTERNACIONAL, INDUSTRIAL u otros no soportados
  return "";
}

function uniquePreserveOrder(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

// =============================
// 📦 Productos, 🏙 Ciudades, 🌎 Países, 🏢 Agencias, 📦 Empaques
// =============================

router.post("/productos", async (_req, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    // Tu servicio ya debería enviar { tipo: "obtener_producto", ...credenciales }
    const result: unknown = await apiService.obtenerProductos();

    // La doc de ejemplo devuelve:
    // {"fetch":[{"producto":"DOCUMENTO UNITARIO "},{"producto":"DOCUMENTO UNITARIO - 10AM "},{"producto":"INTERNACIONAL "},{"producto":"MERCANCIA INDUSTRIAL "},{"producto":"MERCANCIA PREMIER "}]}
    const fetchValue = isRecord(result) ? result.fetch : undefined;
    const productosValue = isRecord(result) ? result.productos : undefined;
    const rawList: unknown[] =
      (Array.isArray(fetchValue) && fetchValue) ||
      (Array.isArray(productosValue) && productosValue) ||
      (Array.isArray(result) && result) ||
      [];

    const normalizados = uniquePreserveOrder(
      rawList
        .map((item: unknown) => {
          if (isRecord(item)) {
            return normalizarProducto(item.producto ?? item.nombre_producto ?? "");
          }
          return normalizarProducto(item);
        })
        .filter((x) => x === DOC || x === MERC)
    );

    const productosFinales =
      normalizados.length > 0 ? normalizados : [MERC, DOC]; // fallback seguro

    return res.json({
      success: true,
      productos: productosFinales.map((n) => ({ nombre_producto: n })),
      // Solo en no-prod exponemos el raw para depuración
      raw_fetch: process.env.NODE_ENV === "production" ? undefined : result,
    });
  } catch (error) {
    logger.error("Error al obtener productos", { error });
    return res.status(500).json({
      success: false,
      error: "Error al obtener productos",
      details: error instanceof Error ? error.message : "Error desconocido",
      // Fallback seguro
      productos: [{ nombre_producto: MERC }, { nombre_producto: DOC }],
    });
  }
});

router.post("/paises", async (_req, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result = await apiService.obtenerPaises();
    res.json(result);
  } catch (error) {
    logger.error("Error al obtener países", { error });
    res.status(500).json({
      error: "Error al obtener países",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/ciudades", async (req, res) => {
  try {
    const { codpais } = req.body;
    if (!codpais) {
      return res.status(400).json({ error: "El código de país es requerido" });
    }

    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result = await apiService.obtenerCiudades(codpais);
    res.json(result);
  } catch (error) {
    logger.error("Error al obtener ciudades", { error });
    res.status(500).json({
      error: "Error al obtener ciudades",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/agencias", async (_req, res) => {
  try {
    logger.debug("Servientrega API: Obteniendo agencias");
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result: unknown = await apiService.obtenerAgencias();
    if (process.env.DEBUG_SERVIENTREGA === "1") {
      logger.debug("Servientrega API: Respuesta de agencias", { result });
    }

    // Log detallado del array
    const resultFetch = isRecord(result) ? result.fetch : undefined;
    const resultData = isRecord(result) ? result.data : undefined;
    const resultAgencias = isRecord(result) ? result.agencias : undefined;

    let agenciasArray: unknown[] = [];
    if (Array.isArray(resultFetch)) {
      agenciasArray = resultFetch;
      logger.debug(`Found agencias in result.fetch: ${agenciasArray.length} items`);
    } else if (Array.isArray(resultData)) {
      agenciasArray = resultData;
      logger.debug(`Found agencias in result.data: ${agenciasArray.length} items`
      );
    } else if (Array.isArray(resultAgencias)) {
      agenciasArray = resultAgencias;
      logger.debug(`Found agencias in result.agencias: ${agenciasArray.length} items`);
    } else if (Array.isArray(result)) {
      agenciasArray = result;
      logger.debug(`Result is direct array: ${agenciasArray.length} items`);
    }

    // Log primeros 5 items (solo en debug)
    if (process.env.DEBUG_SERVIENTREGA === "1") {
      logger.debug("Primeras 5 agencias raw", { agencias: agenciasArray.slice(0, 5) });
    }

    if (!result) {
      logger.error("Respuesta vacía de la API de Servientrega");
      return res.status(500).json({
        success: false,
        error: "Respuesta vacía de la API de Servientrega",
        data: [],
      });
    }

    // Intentar descubrir el array de agencias en la respuesta
    let agencias: unknown[] = [];
    if (Array.isArray(result)) {
      agencias = result;
    } else if (Array.isArray(resultFetch)) {
      // ✅ Buscar explícitamente en 'fetch' (donde Servientrega devuelve agencias)
      agencias = resultFetch;
    } else if (Array.isArray(resultData)) {
      agencias = resultData;
    } else if (Array.isArray(resultAgencias)) {
      agencias = resultAgencias;
    } else {
      if (isRecord(result)) {
        for (const key of Object.keys(result)) {
          const value = result[key];
          if (Array.isArray(value)) {
            agencias = value;
            break;
          }
        }
      }
    }

    logger.info(`Agencias procesadas: ${agencias.length} encontradas`);

    res.json({
      success: true,
      data: agencias,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error al obtener agencias", { error });
    res.status(500).json({
      success: false,
      error: "Error al obtener agencias",
      details: error instanceof Error ? error.message : "Error desconocido",
      data: [],
    });
  }
});

router.post("/empaques", async (_req, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result = await apiService.obtenerEmpaques();
    res.json(result);
  } catch (error) {
    logger.error("Error al obtener empaques", { error });
    res.status(500).json({
      error: "Error al obtener empaques",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// =============================
// 🏢 Agencias de Retiro (obtener_cs)
// =============================

router.post("/agencias-retiro", async (_req, res) => {
  try {
    logger.info("Servientrega API: Obteniendo agencias de retiro (obtener_cs)");
    const credentials = getCredentials();
    logger.debug("Servientrega API: Credenciales", { user: credentials.usuingreso });
    
    const apiService = new ServientregaAPIService(credentials);
    apiService.apiUrl = getApiUrl();

    // Llamar al endpoint RETAIL con tipo "obtener_cs"
    // El endpoint RETAIL puede requerir form-data, probamos ambos formatos
    let result: unknown;
    try {
      // Primero intentamos con JSON
      result = await apiService.callAPI(
        { tipo: "obtener_cs" },
        15000,
        true // useRetailUrl = true
      );
    } catch (jsonError) {
      logger.warn("Error con JSON, intentando con form-data", { jsonError });
      // Si falla, intentamos con form-data usando el método directo
      const axios = (await import("axios")).default;
      const https = (await import("https")).default;
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      
      const form = new URLSearchParams();
      form.append("tipo", "obtener_cs");
      form.append("usuingreso", credentials.usuingreso);
      form.append("contrasenha", credentials.contrasenha);
      
      const RETAIL_URL = "https://servientrega-ecuador.appsiscore.com/app/ws/serviretail_cs.php";
      const response = await axios.post(RETAIL_URL, form.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        httpsAgent,
        timeout: 15000,
      });
      result = response.data;
    }

    logger.debug("Servientrega API: Respuesta raw de agencias de retiro", { result });

    // Extraer el array de agencias de la respuesta
    const resultFetch = isRecord(result) ? result.fetch : undefined;
    const resultData = isRecord(result) ? result.data : undefined;
    const resultAgencias = isRecord(result) ? result.agencias : undefined;

    let agenciasArray: unknown[] = [];
    if (Array.isArray(resultFetch)) {
      agenciasArray = resultFetch;
      logger.debug(`Found agencias-retiro in result.fetch: ${agenciasArray.length} items`);
    } else if (Array.isArray(resultData)) {
      agenciasArray = resultData;
      logger.debug(`Found agencias-retiro in result.data: ${agenciasArray.length} items`);
    } else if (Array.isArray(resultAgencias)) {
      agenciasArray = resultAgencias;
      logger.debug(`Found agencias-retiro in result.agencias: ${agenciasArray.length} items`);
    } else if (Array.isArray(result)) {
      agenciasArray = result;
      logger.debug(`Result is direct array: ${agenciasArray.length} items`);
    }

    // Log primeros 5 items (solo en debug)
    if (process.env.DEBUG_SERVIENTREGA === "1") {
      logger.debug("Primeras 5 agencias de retiro raw", { agencias: agenciasArray.slice(0, 5) });
    }

    if (!result || agenciasArray.length === 0) {
      logger.error("Respuesta vacía de la API de Servientrega (agencias-retiro)", { result });
      return res.status(500).json({
        success: false,
        error: "Respuesta vacía de la API de Servientrega",
        details: "El API no devolvió agencias. Verifique las credenciales o el endpoint.",
        rawResponse: result,
        data: [],
      });
    }

    // Normalizar y filtrar agencias (solo las que tienen retiro:SI)
    const agenciasNormalizadas = agenciasArray
      .map((agencia: unknown) => {
        if (!isRecord(agencia)) return null;
        
        // Solo incluir agencias con retiro:SI
        const retiro = String(agencia.retiro || "").toUpperCase().trim();
        if (retiro !== "SI") return null;
        
        return {
          nombre: String(agencia.agencia || ""),
          direccion: String(agencia.direccion || ""),
          ciudad: String(agencia.ciudad || "").trim(),
          provincia: String(agencia.provincia || "").trim(),
        };
      })
      .filter((a): a is { nombre: string; direccion: string; ciudad: string; provincia: string } => a !== null);

    logger.info(`Agencias de retiro procesadas: ${agenciasNormalizadas.length} encontradas (filtradas con retiro:SI)`);

    res.json({
      success: true,
      data: agenciasNormalizadas,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Error al obtener agencias de retiro", { error: error?.message || error });
    res.status(500).json({
      success: false,
      error: "Error al obtener agencias de retiro",
      details: error instanceof Error ? error.message : "Error desconocido",
      code: error?.code || "UNKNOWN_ERROR",
      data: [],
    });
  }
});

// =============================
// 🔍 Validar Endpoint Retail
// =============================

router.post("/validar-retail", async (req, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result = await apiService.callAPI(req.body, 15000, true);
    res.json(result);
  } catch (error) {
    logger.error("Error al validar endpoint retail", { error });
    res.status(500).json({
      error: "Error al validar endpoint retail",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.get("/test-retail", async (_req, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result = await apiService.callAPI({ tipo: "test" }, 10000, true);
    res.json({
      success: true,
      message: "Endpoint retail responde correctamente",
      data: result,
    });
  } catch (error) {
    logger.error("Error al probar endpoint retail", { error });
    res.status(500).json({
      success: false,
      error: "Error al conectar con endpoint retail",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as productsRouter };
