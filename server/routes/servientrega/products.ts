import express from "express";
import { ServientregaAPIService, ServientregaCredentials } from "../../services/servientregaAPIService.js";

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
      details: error instanceof Error ? error.message : "Error desconocido"
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
      details: error instanceof Error ? error.message : "Error desconocido"
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
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

router.post("/agencias", async (_, res) => {
  try {
    const apiService = new ServientregaAPIService(getCredentials());
    const result = await apiService.obtenerAgencias();
    res.json(result);
  } catch (error) {
    console.error("Error al obtener agencias:", error);
    res.status(500).json({ 
      error: "Error al obtener agencias",
      details: error instanceof Error ? error.message : "Error desconocido"
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
      details: error instanceof Error ? error.message : "Error desconocido"
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
      details: error instanceof Error ? error.message : "Error desconocido"
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
      data: result 
    });
  } catch (error) {
    console.error("Error al probar endpoint retail:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al conectar con endpoint retail",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

export { router as productsRouter };