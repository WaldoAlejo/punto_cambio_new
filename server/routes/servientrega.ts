import express from "express";
import axios from "axios";
import https from "https";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { subDays, startOfDay, endOfDay } from "date-fns";

const router = express.Router();

const BASE_URL =
  "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";

const AUTH = {
  usuingreso: "INTPUNTOC",
  contrasenha: "73Yes7321t",
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const UMBRAL_MINIMO_SALDO = new Prisma.Decimal(5);

// Sistema de cache simple para reducir peticiones
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }

  console.log(`📋 Usando datos en cache para: ${key}`);
  return cached.data;
}

function setCachedData(key: string, data: any, ttlMinutes: number = 30): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000, // convertir a milisegundos
  });
  console.log(`💾 Datos guardados en cache: ${key} (TTL: ${ttlMinutes}min)`);
}

// Endpoint para verificar y gestionar cache
router.get("/cache/status", async (_, res) => {
  try {
    const cacheStatus = Array.from(cache.entries()).map(([key, value]) => ({
      key,
      timestamp: new Date(value.timestamp).toISOString(),
      ttl: value.ttl,
      expired: Date.now() - value.timestamp > value.ttl,
      ageMinutes: Math.round((Date.now() - value.timestamp) / (1000 * 60)),
    }));

    res.json({
      success: true,
      cacheEntries: cacheStatus.length,
      entries: cacheStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString(),
    });
  }
});

router.post("/cache/clear", async (_, res) => {
  try {
    const entriesCleared = cache.size;
    cache.clear();

    res.json({
      success: true,
      message: `Cache limpiado exitosamente. ${entriesCleared} entradas eliminadas.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint para verificar configuración
router.get("/config", async (_, res) => {
  try {
    res.json({
      success: true,
      config: {
        base_url: BASE_URL,
        auth: {
          usuario: AUTH.usuingreso,
          contrasena_length: AUTH.contrasenha.length,
          contrasena_masked: AUTH.contrasenha.substring(0, 2) + "***",
        },
        https_agent: {
          rejectUnauthorized: httpsAgent.options.rejectUnauthorized,
        },
        umbral_saldo: UMBRAL_MINIMO_SALDO.toString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint de prueba para verificar conectividad
router.get("/test-connection", async (_, res) => {
  try {
    console.log("🔧 Probando conexión con Servientrega...");

    const result = await callServientregaAPI(
      {
        tipo: "obtener_producto",
        ...AUTH,
      },
      5000
    ); // Timeout corto para test rápido

    res.json({
      success: true,
      message: "Conexión exitosa con Servientrega",
      timestamp: new Date().toISOString(),
      hasData: !!result,
      dataType: typeof result,
      isArray: Array.isArray(result),
      url: BASE_URL,
    });
  } catch (error) {
    console.error("❌ Error en test de conexión:", error);
    res.status(500).json({
      success: false,
      message: "Error al conectar con Servientrega",
      error: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString(),
      url: BASE_URL,
    });
  }
});

// Endpoint de estado general de Servientrega
router.get("/status", async (_, res) => {
  try {
    console.log("📊 Verificando estado general de Servientrega...");

    const tests: Array<{
      name: string;
      status: "OK" | "ERROR";
      message: string;
    }> = [];

    // Test 1: Conectividad básica (timeout corto para diagnóstico rápido)
    try {
      await callServientregaAPI({ tipo: "obtener_producto", ...AUTH }, 5000);
      tests.push({
        name: "Conectividad API",
        status: "OK",
        message: "Conexión exitosa",
      });
    } catch (error) {
      tests.push({
        name: "Conectividad API",
        status: "ERROR",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    // Test 2: Base de datos
    try {
      const countRemitentes = await prisma.servientregaRemitente.count();
      const countDestinatarios = await prisma.servientregaDestinatario.count();
      tests.push({
        name: "Base de datos",
        status: "OK",
        message: `${countRemitentes} remitentes, ${countDestinatarios} destinatarios`,
      });
    } catch (error) {
      tests.push({
        name: "Base de datos",
        status: "ERROR",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    // Test 3: Puntos de atención
    try {
      const countPuntos = await prisma.puntoAtencion.count({
        where: { activo: true },
      });
      tests.push({
        name: "Puntos de atención",
        status: "OK",
        message: `${countPuntos} puntos activos`,
      });
    } catch (error) {
      tests.push({
        name: "Puntos de atención",
        status: "ERROR",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    const allOk = tests.every((test) => test.status === "OK");

    res.json({
      success: allOk,
      overall_status: allOk ? "HEALTHY" : "DEGRADED",
      timestamp: new Date().toISOString(),
      tests,
      endpoints_available: [
        "GET /test-connection",
        "GET /status",
        "GET /config",
        "GET /cache/status",
        "POST /cache/clear",
        "POST /productos",
        "POST /paises",
        "POST /ciudades",
        "POST /agencias",
        "POST /empaques",
        "GET /remitente/buscar/:query",
        "POST /remitente/guardar",
        "PUT /remitente/actualizar/:cedula",
        "GET /destinatario/buscar/:query",
        "POST /destinatario/guardar",
        "PUT /destinatario/actualizar/:cedula",
      ],
    });
  } catch (error) {
    console.error("❌ Error en verificación de estado:", error);
    res.status(500).json({
      success: false,
      overall_status: "ERROR",
      error: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString(),
    });
  }
});

async function callServientregaAPI(payload: any, timeoutMs: number = 15000) {
  try {
    console.log(
      "🌐 Llamando a Servientrega API con payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log(`⏱️ Timeout configurado: ${timeoutMs}ms`);

    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
      httpsAgent,
      timeout: timeoutMs,
      // Configuraciones adicionales para mejorar conectividad
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Aceptar códigos 4xx como válidos
    });

    console.log(
      "📡 Respuesta recibida de Servientrega:",
      JSON.stringify(data, null, 2)
    );
    return data;
  } catch (error) {
    console.error("❌ Error en callServientregaAPI:", error);

    if (axios.isAxiosError(error)) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        timeout: error.code === "ECONNABORTED",
        url: BASE_URL,
      };

      console.error("❌ Axios error details:", errorDetails);

      // Mensaje más específico para timeouts
      if (error.code === "ECONNABORTED") {
        throw new Error(
          `Timeout al conectar con Servientrega después de ${timeoutMs}ms`
        );
      }

      // Mensaje más específico para errores de conexión
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error(
          `No se puede conectar con Servientrega (${error.code})`
        );
      }

      throw new Error(
        `Error al conectar con Servientrega: ${error.message} (${
          error.response?.status || error.code || "Sin código"
        })`
      );
    }

    throw new Error(
      `Error al conectar con Servientrega: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`
    );
  }
}

// =============================
// 📦 Productos (Devuelve siempre [{ nombre_producto }])
// =============================
router.post("/productos", async (req, res) => {
  try {
    console.log("🔍 Iniciando carga de productos Servientrega...");

    // Verificar cache primero
    const cacheKey = "productos";
    const cachedResult = getCachedData(cacheKey);

    if (cachedResult) {
      return res.json({
        ...cachedResult,
        success: true,
        timestamp: new Date().toISOString(),
        fromCache: true,
      });
    }

    const result = await callServientregaAPI({
      tipo: "obtener_producto",
      ...AUTH,
    });

    console.log(
      "📦 Respuesta de Servientrega para productos:",
      JSON.stringify(result, null, 2)
    );

    // Guardar en cache por 60 minutos (los productos no cambian frecuentemente)
    setCachedData(cacheKey, result, 60);

    // Devolver exactamente lo que envía Servientrega
    res.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error("❌ Error al cargar productos:", error);

    // Si hay error de rate limit, intentar devolver datos en cache aunque estén expirados
    if (error instanceof Error && error.message.includes("Too many requests")) {
      const cacheKey = "productos";
      const expiredCache = cache.get(cacheKey);

      if (expiredCache) {
        console.log("⚠️ Rate limit detectado, usando cache expirado");
        return res.json({
          ...expiredCache.data,
          success: true,
          timestamp: new Date().toISOString(),
          fromCache: true,
          warning: "Datos del cache debido a límite de peticiones",
        });
      }
    }

    console.error(
      "❌ Stack trace:",
      error instanceof Error ? error.stack : "No stack available"
    );

    res.status(500).json({
      error: error instanceof Error ? error.message : "Error desconocido",
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// 🌎 Paises
router.post("/paises", async (_, res) => {
  try {
    console.log("🌍 Cargando países de Servientrega...");

    // Verificar cache primero
    const cacheKey = "paises";
    const cachedResult = getCachedData(cacheKey);

    if (cachedResult) {
      return res.json({
        ...cachedResult,
        success: true,
        timestamp: new Date().toISOString(),
        fromCache: true,
      });
    }

    const result = await callServientregaAPI({
      tipo: "obtener_paises",
      ...AUTH,
    });

    // Guardar en cache por 120 minutos (los países cambian muy poco)
    setCachedData(cacheKey, result, 120);

    res.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
      fromCache: false,
    });
  } catch (err: any) {
    console.error("❌ Error al cargar países:", err);

    // Fallback con cache expirado si hay rate limit
    if (err.message && err.message.includes("Too many requests")) {
      const cacheKey = "paises";
      const expiredCache = cache.get(cacheKey);

      if (expiredCache) {
        console.log(
          "⚠️ Rate limit detectado, usando cache expirado para países"
        );
        return res.json({
          ...expiredCache.data,
          success: true,
          timestamp: new Date().toISOString(),
          fromCache: true,
          warning: "Datos del cache debido a límite de peticiones",
        });
      }
    }

    res.status(500).json({
      error: err.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// 🏙 Ciudades
router.post("/ciudades", async (req, res) => {
  try {
    const { codpais } = req.body;
    console.log(`🏙️ Cargando ciudades para país: ${codpais}`);

    if (!codpais) {
      return res.status(400).json({
        error: "El código de país es requerido",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await callServientregaAPI({
      tipo: "obtener_ciudades",
      codpais,
      ...AUTH,
    });

    res.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Error al cargar ciudades:", err);

    res.status(500).json({
      error: err.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// 🏢 Agencias
router.post("/agencias", async (_, res) => {
  try {
    console.log("🏢 Cargando agencias de Servientrega...");
    const result = await callServientregaAPI({
      tipo: "obtener_agencias_aliadas",
      ...AUTH,
    });

    res.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Error al cargar agencias:", err);

    res.status(500).json({
      error: err.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// 📦 Empaques
router.post("/empaques", async (_, res) => {
  try {
    console.log("📦 Cargando empaques de Servientrega...");
    const result = await callServientregaAPI({
      tipo: "obtener_empaqueyembalaje",
      ...AUTH,
    });

    res.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Error al cargar empaques:", err);

    res.status(500).json({
      error: err.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================
// 🔍 Buscar remitente/destinatario (tolera cedula o identificacion)
// =============================
router.get("/remitente/buscar/:query", async (req, res) => {
  try {
    const { query } = req.params;
    console.log(`🔍 Buscando remitentes con query: "${query}"`);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: "La búsqueda debe tener al menos 2 caracteres",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const remitentes = await prisma.servientregaRemitente.findMany({
      where: {
        OR: [
          { cedula: { contains: query.trim(), mode: "insensitive" } },
          { nombre: { contains: query.trim(), mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });

    console.log(`✅ Encontrados ${remitentes.length} remitentes`);
    res.json({
      remitentes,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al buscar remitentes:", error);
    res.status(500).json({
      error: "Error al buscar remitentes",
      success: false,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/remitente/guardar", async (req, res) => {
  try {
    const data = req.body;
    console.log("💾 Guardando remitente:", data);

    // Validaciones básicas
    if (!data.nombre || (!data.cedula && !data.identificacion)) {
      return res.status(400).json({
        error: "Nombre y cédula/identificación son requeridos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Normaliza nombre identificador
    const remitenteData = {
      ...data,
      cedula: data.identificacion || data.cedula,
    };

    const remitente = await prisma.servientregaRemitente.create({
      data: remitenteData,
    });

    console.log("✅ Remitente guardado:", remitente.id);
    res.json({
      ...remitente,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Error al guardar remitente:", err);
    res.status(500).json({
      error: "Error al guardar remitente",
      success: false,
      timestamp: new Date().toISOString(),
      details: err.message,
    });
  }
});

router.put("/remitente/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const data = req.body;
    console.log(`🔄 Actualizando remitente con cédula: ${cedula}`);

    if (!cedula) {
      return res.status(400).json({
        error: "La cédula es requerida",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const remitente = await prisma.servientregaRemitente.update({
      where: { cedula },
      data,
    });

    console.log("✅ Remitente actualizado:", remitente.id);
    res.json({
      ...remitente,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al actualizar remitente:", error);
    res.status(500).json({
      error: "Error al actualizar remitente",
      success: false,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// =============================
// 📍 Obtener puntos de atención para Servientrega
// =============================
router.get("/remitente/puntos", async (req, res) => {
  try {
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
        provincia: true,
      },
      orderBy: { nombre: "asc" },
    });

    res.json({
      success: true,
      puntos: puntos,
    });
  } catch (error) {
    console.error("Error al obtener puntos de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener puntos de atención",
    });
  }
});

router.get("/destinatario/buscar/:query", async (req, res) => {
  try {
    const { query } = req.params;
    console.log(`🔍 Buscando destinatarios con query: "${query}"`);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: "La búsqueda debe tener al menos 2 caracteres",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const destinatarios = await prisma.servientregaDestinatario.findMany({
      where: {
        OR: [
          { cedula: { contains: query.trim(), mode: "insensitive" } },
          { nombre: { contains: query.trim(), mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });

    console.log(`✅ Encontrados ${destinatarios.length} destinatarios`);
    res.json({
      destinatarios,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al buscar destinatarios:", error);
    res.status(500).json({
      error: "Error al buscar destinatarios",
      success: false,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Endpoint específico para búsqueda por nombre
router.get("/destinatario/buscar-nombre/:query", async (req, res) => {
  try {
    const { query } = req.params;
    console.log(`🔍 Buscando destinatarios por nombre: "${query}"`);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: "La búsqueda debe tener al menos 2 caracteres",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }

    const destinatarios = await prisma.servientregaDestinatario.findMany({
      where: {
        nombre: { contains: query.trim(), mode: "insensitive" },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });

    console.log(
      `✅ Encontrados ${destinatarios.length} destinatarios por nombre`
    );
    res.json({
      destinatarios,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error al buscar destinatarios por nombre:", error);
    res.status(500).json({
      error: "Error al buscar destinatarios por nombre",
      success: false,
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/destinatario/guardar", async (req, res) => {
  try {
    const data = req.body;
    console.log("📥 Datos recibidos en el backend:", data);

    // Filtrar solo los campos que existen en el modelo ServientregaDestinatario
    const destinatarioData = {
      cedula: data.identificacion || data.cedula,
      nombre: data.nombre,
      direccion: data.direccion,
      ciudad: data.ciudad,
      provincia: data.provincia,
      pais: data.pais,
      telefono: data.telefono,
      email: data.email,
      codigo_postal: data.codigo_postal || null,
    };

    console.log("🔄 Datos filtrados para Prisma:", destinatarioData);

    const destinatario = await prisma.servientregaDestinatario.create({
      data: destinatarioData,
    });
    console.log("✅ Destinatario creado:", destinatario);
    res.json(destinatario);
  } catch (error) {
    console.error("❌ Error al guardar destinatario:", error);
    res.status(500).json({ error: "Error al guardar destinatario" });
  }
});

router.put("/destinatario/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const data = req.body;
    console.log("📥 Datos recibidos para actualizar:", data);

    // Filtrar solo los campos que existen en el modelo ServientregaDestinatario
    const destinatarioData = {
      cedula: data.identificacion || data.cedula,
      nombre: data.nombre,
      direccion: data.direccion,
      ciudad: data.ciudad,
      provincia: data.provincia,
      pais: data.pais,
      telefono: data.telefono,
      email: data.email,
      codigo_postal: data.codigo_postal || null,
    };

    console.log("🔄 Datos filtrados para actualizar:", destinatarioData);

    const destinatario = await prisma.servientregaDestinatario.update({
      where: { cedula },
      data: destinatarioData,
    });
    console.log("✅ Destinatario actualizado:", destinatario);
    res.json(destinatario);
  } catch (error) {
    console.error("❌ Error al actualizar destinatario:", error);
    res.status(500).json({ error: "Error al actualizar destinatario" });
  }
});

// =============================
// 💰 Saldo Servientrega
// =============================

// IMPORTANTE: Las rutas específicas deben ir ANTES que las rutas con parámetros
router.get("/saldo/historial", async (_, res) => {
  try {
    console.log("🔍 Consultando historial de saldos Servientrega...");

    // Primero intentar consulta simple sin include
    console.log("🔧 Intentando consulta simple sin include...");
    const historialSimple = await prisma.servientregaHistorialSaldo.findMany({
      orderBy: { creado_en: "desc" },
    });

    console.log(
      `📊 Registros encontrados (consulta simple): ${historialSimple.length}`
    );

    if (historialSimple.length > 0) {
      console.log(
        "📋 Primeros 3 registros (simple):",
        historialSimple.slice(0, 3)
      );
    }

    // Intentar consulta con include
    let historial: any[] = [];
    try {
      console.log("🔧 Intentando consulta con include...");
      historial = await prisma.servientregaHistorialSaldo.findMany({
        include: {
          punto_atencion: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: { creado_en: "desc" },
      });
      console.log(
        `📊 Registros encontrados (con include): ${historial.length}`
      );
    } catch (includeError) {
      console.error("❌ Error en consulta con include:", includeError);
      console.log("🔄 Usando consulta simple como fallback...");
      historial = historialSimple;
    }

    // Formatear datos para el frontend
    const historialFormateado = historial.map((item: any) => ({
      id: item.id,
      punto_atencion_nombre:
        item.punto_atencion?.nombre || item.punto_atencion_nombre,
      monto_total: Number(item.monto_total),
      creado_por: item.creado_por,
      creado_en: item.creado_en.toISOString(),
    }));

    console.log(
      `✅ Enviando ${historialFormateado.length} registros formateados al frontend`
    );
    console.log(
      "📤 Datos que se envían:",
      JSON.stringify(historialFormateado.slice(0, 2), null, 2)
    );
    res.json(historialFormateado);
  } catch (error) {
    console.error("❌ Error al obtener historial de saldo:", error);
    console.error("❌ Stack trace:", (error as Error).stack);
    res.status(500).json({
      error: "Error al obtener historial de saldo",
      detalle: (error as Error).message,
    });
  }
});

// Endpoint para verificar conexión a la base de datos
router.get("/saldo/historial/test-db", async (_, res) => {
  try {
    console.log("🔧 TEST: Verificando conexión a la base de datos...");

    // Probar consulta simple
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Conexión a DB exitosa:", result);

    // Verificar si la tabla existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ServientregaHistorialSaldo'
      );
    `;
    console.log("🔍 ¿Tabla ServientregaHistorialSaldo existe?:", tableExists);

    res.json({
      conexionDB: "OK",
      tablaExiste: tableExists,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error en test de DB:", error);
    res.status(500).json({
      error: "Error en test de DB",
      detalle: (error as Error).message,
    });
  }
});

// Endpoint de debug para verificar datos en la tabla
router.get("/saldo/historial/debug", async (_, res) => {
  try {
    console.log("🔧 DEBUG: Verificando tabla ServientregaHistorialSaldo...");

    // Verificar si la tabla existe
    let count = 0;
    let historialRaw: any[] = [];
    let puntos: any[] = [];
    let errorDetails: any = null;

    try {
      count = await prisma.servientregaHistorialSaldo.count();
      console.log(`📊 Total de registros en historial: ${count}`);
    } catch (countError) {
      console.error("❌ Error al contar registros:", countError);
      errorDetails = { countError: (countError as any).message };
    }

    try {
      historialRaw = await prisma.servientregaHistorialSaldo.findMany({
        orderBy: { creado_en: "desc" },
        take: 10,
      });
      console.log("📋 Registros raw (primeros 10):", historialRaw);
    } catch (findError) {
      console.error("❌ Error al obtener registros:", findError);
      errorDetails = { ...errorDetails, findError: (findError as any).message };
    }

    try {
      puntos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
      });
      console.log("📍 Puntos de atención activos:", puntos);
    } catch (puntosError) {
      console.error("❌ Error al obtener puntos:", puntosError);
      errorDetails = {
        ...errorDetails,
        puntosError: (puntosError as any).message,
      };
    }

    // Verificar también la tabla de saldos
    let saldos: any[] = [];
    try {
      saldos = await prisma.servientregaSaldo.findMany({
        select: {
          id: true,
          punto_atencion_id: true,
          monto_total: true,
          monto_usado: true,
        },
        take: 5,
      });
      console.log("💰 Saldos existentes:", saldos);
    } catch (saldosError) {
      console.error("❌ Error al obtener saldos:", saldosError);
      errorDetails = {
        ...errorDetails,
        saldosError: (saldosError as any).message,
      };
    }

    res.json({
      totalRegistros: count,
      registrosRaw: historialRaw,
      puntosActivos: puntos,
      saldosExistentes: saldos,
      errores: errorDetails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error general en debug:", error);
    console.error("❌ Stack trace:", (error as Error).stack);
    res.status(500).json({
      error: "Error en debug",
      detalle: (error as Error).message,
      stack: (error as Error).stack,
    });
  }
});

// Ruta con parámetro - debe ir DESPUÉS de las rutas específicas
router.get("/saldo/:punto_id", async (req, res) => {
  try {
    const { punto_id } = req.params;
    const saldo = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: punto_id },
    });
    res.json({
      disponible: saldo
        ? saldo.monto_total.minus(saldo.monto_usado).toFixed(2)
        : 0,
    });
  } catch {
    res.status(404).json({ error: "No se encontró el saldo para el punto." });
  }
});

router.get("/saldo/validar/:punto_id", async (req, res) => {
  try {
    const { punto_id } = req.params;
    const saldo = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: punto_id },
    });

    const disponible = saldo
      ? saldo.monto_total.minus(saldo.monto_usado)
      : new Prisma.Decimal(0);

    if (disponible.lt(UMBRAL_MINIMO_SALDO)) {
      return res.status(400).json({
        estado: "SALDO_BAJO",
        disponible: disponible.toFixed(2),
        mensaje: `El saldo disponible ($${disponible.toFixed(
          2
        )}) está por debajo del mínimo requerido ($${UMBRAL_MINIMO_SALDO.toFixed(
          2
        )}).`,
      });
    }

    res.json({ estado: "OK", disponible: disponible.toFixed(2) });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Error al validar saldo", detalle: err.message });
  }
});

router.post("/saldo", async (req, res) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;
    console.log("💰 Asignando saldo:", {
      monto_total,
      creado_por,
      punto_atencion_id,
    });

    const saldo = await prisma.servientregaSaldo.upsert({
      where: { punto_atencion_id },
      update: { monto_total: new Prisma.Decimal(monto_total) },
      create: {
        monto_total: new Prisma.Decimal(monto_total),
        monto_usado: new Prisma.Decimal(0),
        creado_por,
        punto_atencion_id,
      },
    });
    console.log("✅ Saldo actualizado/creado:", saldo.id);

    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
    });
    console.log("📍 Punto encontrado:", punto?.nombre);

    const historialEntry = await prisma.servientregaHistorialSaldo.create({
      data: {
        punto_atencion_id,
        punto_atencion_nombre: punto?.nombre || "Desconocido",
        monto_total: new Prisma.Decimal(monto_total),
        creado_por,
      },
    });
    console.log("📝 Registro de historial creado:", historialEntry.id);

    res.json(saldo);
  } catch (err: any) {
    console.error("❌ Error al asignar saldo:", err);
    res
      .status(500)
      .json({ error: "Error al asignar saldo", detalle: err.message });
  }
});

// =============================
// 🔔 Solicitudes de saldo
// =============================
router.post("/solicitar-saldo", async (req, res) => {
  try {
    console.log("🔔 Nueva solicitud de saldo recibida:", req.body);
    const { punto_atencion_id, monto_requerido, observaciones } = req.body;

    if (!punto_atencion_id || !monto_requerido) {
      console.log("❌ Datos faltantes en solicitud:", {
        punto_atencion_id,
        monto_requerido,
      });
      return res.status(400).json({ error: "Datos requeridos faltantes" });
    }

    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
    });

    if (!punto) {
      console.log("❌ Punto de atención no encontrado:", punto_atencion_id);
      return res.status(404).json({ error: "Punto de atención no encontrado" });
    }

    console.log("✅ Punto de atención encontrado:", punto.nombre);

    const solicitud = await prisma.servientregaSolicitudSaldo.create({
      data: {
        punto_atencion_id,
        punto_atencion_nombre: punto.nombre,
        monto_requerido: new Prisma.Decimal(monto_requerido),
        estado: "PENDIENTE",
        observaciones: observaciones || null,
      },
    });

    console.log("✅ Solicitud creada exitosamente:", {
      id: solicitud.id,
      punto: solicitud.punto_atencion_nombre,
      monto: solicitud.monto_requerido.toString(),
      estado: solicitud.estado,
    });

    res.json({
      message: "Solicitud registrada y enviada al administrador",
      solicitud,
    });
  } catch (err) {
    console.error("❌ Error al registrar solicitud de saldo:", err);
    res.status(500).json({
      error: "Error al registrar solicitud de saldo",
      detalle: err instanceof Error ? err.message : "Error desconocido",
    });
  }
});

router.get("/solicitar-saldo/listar", async (_, res) => {
  try {
    console.log("📋 Consultando solicitudes de saldo...");

    const solicitudes = await prisma.servientregaSolicitudSaldo.findMany({
      orderBy: { creado_en: "desc" },
    });

    console.log("📋 Solicitudes encontradas:", {
      total: solicitudes.length,
      pendientes: solicitudes.filter((s) => s.estado === "PENDIENTE").length,
      aprobadas: solicitudes.filter((s) => s.estado === "APROBADA").length,
      rechazadas: solicitudes.filter((s) => s.estado === "RECHAZADA").length,
    });

    // Log detallado de las primeras 3 solicitudes para debug
    if (solicitudes.length > 0) {
      console.log(
        "📋 Primeras solicitudes:",
        solicitudes.slice(0, 3).map((s) => ({
          id: s.id,
          punto: s.punto_atencion_nombre,
          monto: s.monto_requerido.toString(),
          estado: s.estado,
          fecha: s.creado_en,
        }))
      );
    }

    res.json(solicitudes);
  } catch (err) {
    console.error("❌ Error al listar solicitudes:", err);
    res.status(500).json({
      error: "Error al listar solicitudes",
      detalle: err instanceof Error ? err.message : "Error desconocido",
    });
  }
});

// Endpoint para verificar estructura de la tabla
router.get("/solicitar-saldo/check-schema", async (_, res) => {
  try {
    console.log("🔧 Verificando estructura de la tabla...");

    // Intentar crear una solicitud de prueba para verificar que el campo observaciones existe
    const testData = {
      punto_atencion_id: "test",
      punto_atencion_nombre: "Test",
      monto_requerido: new Prisma.Decimal(1),
      estado: "PENDIENTE",
      observaciones: "Test de estructura",
    };

    // Solo verificar que la estructura es válida, no crear realmente
    const schemaCheck = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'ServientregaSolicitudSaldo'
      ORDER BY ordinal_position;
    `;

    res.json({
      success: true,
      message: "Estructura de tabla verificada",
      columns: schemaCheck,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Error verificando estructura:", err);
    res.status(500).json({
      error: "Error verificando estructura",
      detalle: err instanceof Error ? err.message : "Error desconocido",
    });
  }
});

// Endpoint de debug para verificar solicitudes
router.get("/solicitar-saldo/debug", async (_, res) => {
  try {
    console.log("🔧 Debug: Verificando solicitudes de saldo...");

    // Contar total de solicitudes
    const totalSolicitudes = await prisma.servientregaSolicitudSaldo.count();

    // Obtener todas las solicitudes
    const todasSolicitudes = await prisma.servientregaSolicitudSaldo.findMany({
      orderBy: { creado_en: "desc" },
      take: 10, // Solo las últimas 10
    });

    // Contar por estado
    const porEstado = await prisma.servientregaSolicitudSaldo.groupBy({
      by: ["estado"],
      _count: {
        estado: true,
      },
    });

    const resultado = {
      success: true,
      timestamp: new Date().toISOString(),
      totalSolicitudes,
      porEstado: porEstado.reduce((acc, item) => {
        acc[item.estado] = item._count.estado;
        return acc;
      }, {} as Record<string, number>),
      ultimasSolicitudes: todasSolicitudes.map((s) => ({
        id: s.id,
        punto: s.punto_atencion_nombre,
        monto: s.monto_requerido.toString(),
        estado: s.estado,
        observaciones: s.observaciones,
        creado_en: s.creado_en,
        aprobado_por: s.aprobado_por,
        aprobado_en: s.aprobado_en,
      })),
    };

    console.log("🔧 Debug resultado:", resultado);
    res.json(resultado);
  } catch (err) {
    console.error("❌ Error en debug:", err);
    res.status(500).json({
      error: "Error en debug",
      detalle: err instanceof Error ? err.message : "Error desconocido",
    });
  }
});

router.post("/solicitar-saldo/responder", async (req, res) => {
  try {
    console.log("🔄 Procesando respuesta a solicitud:", req.body);
    const { solicitud_id, estado, aprobado_por } = req.body;

    if (!["APROBADA", "RECHAZADA"].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    if (!solicitud_id || !aprobado_por) {
      return res.status(400).json({ error: "Datos requeridos faltantes" });
    }

    // Obtener la solicitud original
    const solicitudOriginal =
      await prisma.servientregaSolicitudSaldo.findUnique({
        where: { id: solicitud_id },
      });

    if (!solicitudOriginal) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (solicitudOriginal.estado !== "PENDIENTE") {
      return res.status(400).json({ error: "La solicitud ya fue procesada" });
    }

    console.log("✅ Solicitud encontrada:", {
      id: solicitudOriginal.id,
      punto: solicitudOriginal.punto_atencion_nombre,
      monto: solicitudOriginal.monto_requerido.toString(),
      estado_actual: solicitudOriginal.estado,
    });

    // Actualizar la solicitud
    const solicitud = await prisma.servientregaSolicitudSaldo.update({
      where: { id: solicitud_id },
      data: {
        estado,
        aprobado_por,
        aprobado_en: new Date(),
      },
    });

    console.log("✅ Solicitud actualizada:", {
      id: solicitud.id,
      nuevo_estado: solicitud.estado,
      aprobado_por: solicitud.aprobado_por,
    });

    // Si se aprueba, asignar el saldo automáticamente
    if (estado === "APROBADA") {
      try {
        console.log("💰 Asignando saldo automáticamente...");

        // Obtener saldo actual
        const saldoActual = await prisma.servientregaSaldo.findUnique({
          where: { punto_atencion_id: solicitudOriginal.punto_atencion_id },
        });

        const nuevoMontoTotal = saldoActual
          ? saldoActual.monto_total.add(solicitudOriginal.monto_requerido)
          : solicitudOriginal.monto_requerido;

        // Actualizar o crear saldo
        await prisma.servientregaSaldo.upsert({
          where: { punto_atencion_id: solicitudOriginal.punto_atencion_id },
          update: {
            monto_total: nuevoMontoTotal,
          },
          create: {
            punto_atencion_id: solicitudOriginal.punto_atencion_id,
            monto_total: solicitudOriginal.monto_requerido,
            monto_usado: new Prisma.Decimal(0),
            creado_por: aprobado_por,
          },
        });

        // Registrar en historial
        await prisma.servientregaHistorialSaldo.create({
          data: {
            punto_atencion_id: solicitudOriginal.punto_atencion_id,
            punto_atencion_nombre: solicitudOriginal.punto_atencion_nombre,
            monto_total: solicitudOriginal.monto_requerido,
            creado_por: aprobado_por,
          },
        });

        console.log("✅ Saldo asignado exitosamente:", {
          punto: solicitudOriginal.punto_atencion_nombre,
          monto_asignado: solicitudOriginal.monto_requerido.toString(),
          nuevo_monto_total: nuevoMontoTotal.toString(),
          saldo_disponible: nuevoMontoTotal
            .sub(saldoActual?.monto_usado || new Prisma.Decimal(0))
            .toString(),
        });
      } catch (saldoError) {
        console.error("❌ Error al asignar saldo:", saldoError);
        // No fallar la respuesta, pero registrar el error
      }
    }

    res.json({
      success: true,
      message: `Solicitud ${estado.toLowerCase()} correctamente`,
      solicitud,
      saldo_asignado: estado === "APROBADA",
    });
  } catch (err) {
    console.error("❌ Error al responder solicitud:", err);
    res.status(500).json({
      error: "Error al responder solicitud",
      detalle: err instanceof Error ? err.message : "Error desconocido",
    });
  }
});

// =============================
// 📄 Listar guías generadas
// =============================
router.get("/guias", async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    const fechaDesde = desde
      ? startOfDay(new Date(desde as string))
      : subDays(new Date(), 7);
    const fechaHasta = hasta
      ? endOfDay(new Date(hasta as string))
      : endOfDay(new Date());

    const guias = await prisma.servientregaGuia.findMany({
      where: { created_at: { gte: fechaDesde, lte: fechaHasta } },
      include: { remitente: true, destinatario: true },
      orderBy: { created_at: "desc" },
    });

    res.json(guias);
  } catch {
    res.status(500).json({ error: "Error al listar guías" });
  }
});

// =============================
// ❌ Anular guía
// =============================
router.post("/anular-guia", async (req, res) => {
  try {
    const { guia } = req.body;

    const response = await callServientregaAPI({
      tipo: "ActualizaEstadoGuia",
      guia,
      estado: "Anulada",
      ...AUTH,
    });

    if (response?.fetch?.proceso === "Guia Actualizada") {
      return res.json({ message: "Guía anulada correctamente" });
    }

    res
      .status(400)
      .json({ error: "No se pudo anular la guía", detalle: response });
  } catch {
    res.status(500).json({ error: "Error al anular guía" });
  }
});

// =============================
// 💰 Tarifa
// =============================
router.post("/tarifa", async (req, res) => {
  try {
    const {
      pais_ori,
      ciu_ori,
      provincia_ori,
      pais_des,
      ciu_des,
      provincia_des,
      valor_seguro,
      valor_declarado,
      peso,
      alto,
      ancho,
      largo,
      recoleccion,
      nombre_producto,
      empaque,
    } = req.body;

    const tipo =
      pais_des?.toUpperCase() !== "ECUADOR"
        ? "obtener_tarifa_internacional"
        : "obtener_tarifa_nacional";

    const payload: any = {
      tipo,
      pais_ori: pais_ori?.toUpperCase(),
      ciu_ori: ciu_ori?.toUpperCase(),
      provincia_ori: provincia_ori?.toUpperCase(),
      pais_des: pais_des?.toUpperCase(),
      ciu_des: ciu_des?.toUpperCase(),
      provincia_des: provincia_des?.toUpperCase(),
      valor_seguro: String(valor_seguro || "0"),
      valor_declarado: String(valor_declarado || "0"),
      peso: String(peso || "0"),
      alto: String(alto || "0"),
      ancho: String(ancho || "0"),
      largo: String(largo || "0"),
      recoleccion: recoleccion || "NO",
      nombre_producto: nombre_producto || "",
      empaque: empaque || "",
      ...AUTH,
    };

    res.json(await callServientregaAPI(payload));
  } catch {
    res.status(500).json({ error: "Error al calcular tarifa" });
  }
});

// =============================
// 📄 Generar Guía (100% robusto con normalización)
// =============================
router.post("/generar-guia", async (req, res) => {
  try {
    console.log(
      "📥 Datos recibidos para generar guía:",
      JSON.stringify(req.body, null, 2)
    );

    // Detectar si es el formato nuevo (directo) o el formato antiguo (anidado)
    const esFormatoNuevo = req.body.tipo === "GeneracionGuia";

    if (esFormatoNuevo) {
      // Formato nuevo: usar directamente el payload
      console.log("🔄 Usando formato nuevo de generación de guía");
      const payload = req.body;

      const response = await callServientregaAPI(payload);
      console.log(
        "📥 Respuesta de Servientrega:",
        JSON.stringify(response, null, 2)
      );

      // Procesar respuesta
      if (response?.fetch?.proceso === "Guia Generada Correctamente") {
        return res.json(response);
      } else {
        return res.status(400).json({
          error: "No se pudo generar la guía",
          detalle: response,
        });
      }
    }

    // Formato antiguo (mantener compatibilidad)
    const {
      nombre_producto,
      remitente,
      destinatario,
      contenido,
      retiro_oficina,
      nombre_agencia_retiro_oficina,
      pedido,
      factura,
      medidas,
      resumen_costos,
      punto_atencion_id,
      empaque = {},
    } = req.body;

    // Normaliza campos de identificador para tolerar "cedula" o "identificacion"
    const remitente_id = remitente?.identificacion || remitente?.cedula;
    const destinatario_id =
      destinatario?.identificacion || destinatario?.cedula;

    if (punto_atencion_id) {
      const saldo = await prisma.servientregaSaldo.findUnique({
        where: { punto_atencion_id },
      });
      const disponible = saldo
        ? saldo.monto_total.minus(saldo.monto_usado)
        : new Prisma.Decimal(0);
      const costo = new Prisma.Decimal(resumen_costos?.total || 0);

      if (disponible.lt(costo)) {
        return res.status(400).json({
          error: `Saldo insuficiente. Disponible: $${disponible.toFixed(
            2
          )}, requerido: $${costo.toFixed(2)}.`,
        });
      }
    }

    const pesoVol =
      (Number(medidas.alto) * Number(medidas.ancho) * Number(medidas.largo)) /
      5000;

    const payload = {
      tipo: "GeneracionGuia",
      nombre_producto,
      ciudad_origen: `${remitente.ciudad?.toUpperCase()}-${remitente.provincia?.toUpperCase()}`,
      cedula_remitente: remitente_id,
      nombre_remitente: remitente.nombre,
      direccion_remitente: remitente.direccion,
      telefono_remitente: remitente.telefono,
      codigo_postal_remitente: remitente.codigo_postal || "170150",
      cedula_destinatario: destinatario_id,
      nombre_destinatario: destinatario.nombre,
      direccion_destinatario:
        retiro_oficina === "SI"
          ? nombre_agencia_retiro_oficina
          : destinatario.direccion,
      telefono_destinatario: destinatario.telefono,
      ciudad_destinatario: `${destinatario.ciudad?.toUpperCase()}-${destinatario.provincia?.toUpperCase()}`,
      pais_destinatario: destinatario.pais || "ECUADOR",
      codigo_postal_destinatario: destinatario.codigo_postal || "000000",
      contenido: contenido || nombre_producto,
      retiro_oficina: retiro_oficina || "NO",
      nombre_agencia_retiro_oficina:
        retiro_oficina === "SI" ? nombre_agencia_retiro_oficina : "",
      pedido: pedido || "PRUEBA",
      factura: factura || "PRUEBA",
      valor_declarado: Number(medidas.valor_declarado) || 0,
      valor_asegurado: Number(medidas.valor_seguro) || 0,
      peso_fisico: Math.max(Number(medidas.peso) || 1, 1),
      peso_volumentrico: pesoVol || 0,
      piezas: 1,
      alto: Math.max(Number(medidas.alto) || 10, 1),
      ancho: Math.max(Number(medidas.ancho) || 10, 1),
      largo: Math.max(Number(medidas.largo) || 10, 1),
      tipo_guia: "1",
      // Campos obligatorios para el entorno de pruebas de Servientrega
      alianza: "PRUEBAS",
      alianza_oficina:
        retiro_oficina === "SI" && nombre_agencia_retiro_oficina
          ? nombre_agencia_retiro_oficina
          : "DON JUAN_INICIAL_XR",
      mail_remite: remitente.email || "correo@ejemplo.com",
      empaque,
      ...AUTH,
    };

    const response = await callServientregaAPI(payload);

    if (response?.fetch?.proceso === "Guia Generada Correctamente") {
      const { guia, guia_64 } = response.fetch;

      const remitenteDB =
        (await prisma.servientregaRemitente.findFirst({
          where: { cedula: remitente_id },
        })) ||
        (await prisma.servientregaRemitente.create({
          data: { ...remitente, cedula: remitente_id },
        }));

      const destinatarioDB =
        (await prisma.servientregaDestinatario.findFirst({
          where: { cedula: destinatario_id },
        })) ||
        (await prisma.servientregaDestinatario.create({
          data: { ...destinatario, cedula: destinatario_id },
        }));

      await prisma.servientregaGuia.create({
        data: {
          numero_guia: guia,
          proceso: response.fetch.proceso,
          base64_response: guia_64,
          remitente_id: remitenteDB.id,
          destinatario_id: destinatarioDB.id,
        },
      });

      if (punto_atencion_id) {
        const saldo = await prisma.servientregaSaldo.findUnique({
          where: { punto_atencion_id },
        });
        if (saldo) {
          await prisma.servientregaSaldo.update({
            where: { punto_atencion_id },
            data: {
              monto_usado: saldo.monto_usado.plus(
                new Prisma.Decimal(resumen_costos?.total || 0)
              ),
            },
          });
        }
      }

      return res.json({
        guia,
        base64: guia_64,
        proceso: response.fetch.proceso,
      });
    }

    res
      .status(400)
      .json({ error: "No se pudo generar la guía", detalle: response });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Error al generar guía", detalle: err.message });
  }
});

export default router;
