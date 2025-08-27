import express from "express";
import {
  ServientregaAPIService,
  ServientregaCredentials,
} from "../../services/servientregaAPIService.js";

const router = express.Router();

// Función para obtener las credenciales desde variables de entorno
function getCredentials(): ServientregaCredentials {
  return {
    usuingreso: process.env.SERVIENTREGA_USER || "INTPUNTOC",
    contrasenha: process.env.SERVIENTREGA_PASSWORD || "73Yes7321t",
  };
}

// =============================
// 📦 Productos, 🏙 Ciudades, 🌎 Países, 🏢 Agencias, 📦 Empaques
// =============================

router.post("/productos", async (_, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    const result = await apiService.obtenerProductos();
    res.json(result);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({
      error: "Error al obtener productos",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/paises", async (_, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
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

router.post("/agencias", async (_, res) => {
  try {
    console.log("🔍 Servientrega API: Obteniendo agencias...");
    const apiService = new ServientregaAPIService(getCredentials());
    const result = await apiService.obtenerAgencias();

    console.log("📍 Servientrega API: Respuesta de agencias recibida:", result);

    // Verificar si la respuesta tiene el formato esperado
    if (!result) {
      console.error("❌ Respuesta vacía de la API de Servientrega");
      return res.status(500).json({
        success: false,
        error: "Respuesta vacía de la API de Servientrega",
        data: [],
      });
    }

    // Si la respuesta tiene un array de agencias directamente
    let agencias = [];
    if (Array.isArray(result)) {
      agencias = result;
    } else if (result.data && Array.isArray(result.data)) {
      agencias = result.data;
    } else if (result.agencias && Array.isArray(result.agencias)) {
      agencias = result.agencias;
    } else {
      // Si no encontramos un array, intentar extraer las agencias del objeto
      console.log(
        "🔍 Estructura de respuesta no reconocida, intentando extraer agencias..."
      );
      console.log("📋 Claves disponibles:", Object.keys(result));

      // Buscar cualquier propiedad que sea un array
      for (const key of Object.keys(result)) {
        if (Array.isArray(result[key])) {
          console.log(
            `✅ Encontrado array en propiedad '${key}' con ${result[key].length} elementos`
          );
          agencias = result[key];
          break;
        }
      }
    }

    console.log(`✅ Agencias procesadas: ${agencias.length} encontradas`);

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

router.post("/empaques", async (_, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
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

router.get("/test-retail", async (_, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
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
