import express from "express";
import {
  ServientregaAPIService,
  ServientregaCredentials,
} from "../../services/servientregaAPIService.js";

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
    console.error("Error al obtener productos:", error);
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
    console.error("Error al obtener países:", error);
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
    console.error("Error al obtener ciudades:", error);
    res.status(500).json({
      error: "Error al obtener ciudades",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/agencias", async (_req, res) => {
  try {
    console.log("🔍 Servientrega API: Obteniendo agencias...");
    const apiService = new ServientregaAPIService(getCredentials());
    apiService.apiUrl = getApiUrl();

    const result: unknown = await apiService.obtenerAgencias();
    console.log(
      "📍 Servientrega API: Respuesta completa de agencias:",
      JSON.stringify(result, null, 2)
    );

    // Log detallado del array
    const resultFetch = isRecord(result) ? result.fetch : undefined;
    const resultData = isRecord(result) ? result.data : undefined;
    const resultAgencias = isRecord(result) ? result.agencias : undefined;

    let agenciasArray: unknown[] = [];
    if (Array.isArray(resultFetch)) {
      agenciasArray = resultFetch;
      console.log(
        `✅ Found agencias in result.fetch: ${agenciasArray.length} items`
      );
    } else if (Array.isArray(resultData)) {
      agenciasArray = resultData;
      console.log(
        `✅ Found agencias in result.data: ${agenciasArray.length} items`
      );
    } else if (Array.isArray(resultAgencias)) {
      agenciasArray = resultAgencias;
      console.log(
        `✅ Found agencias in result.agencias: ${agenciasArray.length} items`
      );
    } else if (Array.isArray(result)) {
      agenciasArray = result;
      console.log(`✅ Result is direct array: ${agenciasArray.length} items`);
    }

    // Log primeros 5 items
    console.log(
      "📊 Primeras 5 agencias raw:",
      JSON.stringify(agenciasArray.slice(0, 5), null, 2)
    );

    if (!result) {
      console.error("❌ Respuesta vacía de la API de Servientrega");
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

    console.log(`✅ Agencias procesadas: ${agencias.length} encontradas`);
    console.log(`📊 Primeras 2 agencias:`, agencias.slice(0, 2));

    res.json({
      success: true,
      data: agencias,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al obtener agencias:", error);
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
    console.error("Error al obtener empaques:", error);
    res.status(500).json({
      error: "Error al obtener empaques",
      details: error instanceof Error ? error.message : "Error desconocido",
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
    console.error("Error al validar endpoint retail:", error);
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
    console.error("Error al probar endpoint retail:", error);
    res.status(500).json({
      success: false,
      error: "Error al conectar con endpoint retail",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as productsRouter };
