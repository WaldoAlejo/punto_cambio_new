import express from "express";
import axios from "axios";
import https from "https";
import { PrismaClient, Prisma } from "@prisma/client";
import { subDays, startOfDay, endOfDay } from "date-fns";

const router = express.Router();
const prisma = new PrismaClient();

const BASE_URL =
  "https://servientrega-ecuador-prueba.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";

const AUTH = {
  usuingreso: "PRUEBA",
  contrasenha: "s12345ABCDe",
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const UMBRAL_MINIMO_SALDO = new Prisma.Decimal(5);

async function callServientregaAPI(payload: any) {
  try {
    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
      httpsAgent,
      timeout: 20000,
    });
    return data;
  } catch {
    throw new Error("Error al conectar con Servientrega");
  }
}

// =============================
// 📦 Productos (Devuelve siempre [{ nombre_producto }])
// =============================
router.post("/productos", async (_, res) => {
  try {
    const result = await callServientregaAPI({
      tipo: "obtener_producto",
      ...AUTH,
    });
    const productos = Array.isArray(result?.fetch)
      ? result.fetch
          .map((p) => ({
            nombre_producto: (p.producto || "").trim(),
          }))
          .filter((p) => p.nombre_producto.length > 0)
      : [];
    res.json({ productos });
  } catch {
    res.status(500).json({ error: "No se pudieron cargar los productos" });
  }
});

// 🌎 Paises
router.post("/paises", async (_, res) => {
  try {
    res.json(await callServientregaAPI({ tipo: "obtener_paises", ...AUTH }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 🏙 Ciudades
router.post("/ciudades", async (req, res) => {
  try {
    const { codpais } = req.body;
    res.json(
      await callServientregaAPI({ tipo: "obtener_ciudades", codpais, ...AUTH })
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 🏢 Agencias
router.post("/agencias", async (_, res) => {
  try {
    res.json(
      await callServientregaAPI({ tipo: "obtener_agencias_aliadas", ...AUTH })
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 📦 Empaques
router.post("/empaques", async (_, res) => {
  try {
    res.json(
      await callServientregaAPI({ tipo: "obtener_empaqueyembalaje", ...AUTH })
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🔍 Buscar remitente/destinatario (tolera cedula o identificacion)
// =============================
router.get("/remitente/buscar/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const remitentes = await prisma.servientregaRemitente.findMany({
      where: {
        OR: [
          { cedula: { contains: query, mode: "insensitive" } },
          { nombre: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
    });
    res.json({ remitentes });
  } catch {
    res.status(500).json({ error: "Error al buscar remitentes" });
  }
});

router.post("/remitente/guardar", async (req, res) => {
  try {
    const data = req.body;
    // Normaliza nombre identificador
    const remitente = await prisma.servientregaRemitente.create({
      data: {
        ...data,
        cedula: data.identificacion || data.cedula,
      },
    });
    res.json(remitente);
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Error al guardar remitente", detalle: err.message });
  }
});

router.put("/remitente/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const data = req.body;
    const remitente = await prisma.servientregaRemitente.update({
      where: { cedula },
      data,
    });
    res.json(remitente);
  } catch {
    res.status(500).json({ error: "Error al actualizar remitente" });
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
    const destinatarios = await prisma.servientregaDestinatario.findMany({
      where: {
        OR: [
          { cedula: { contains: query, mode: "insensitive" } },
          { nombre: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
    });
    res.json({ destinatarios });
  } catch {
    res.status(500).json({ error: "Error al buscar destinatarios" });
  }
});

// Endpoint específico para búsqueda por nombre
router.get("/destinatario/buscar-nombre/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const destinatarios = await prisma.servientregaDestinatario.findMany({
      where: {
        nombre: { contains: query, mode: "insensitive" },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });
    res.json({ destinatarios });
  } catch {
    res.status(500).json({ error: "Error al buscar destinatarios por nombre" });
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
    let historial = [];
    try {
      console.log("🔧 Intentando consulta con include...");
      historial = await prisma.servientregaHistorialSaldo.findMany({
        include: {
          puntoAtencion: {
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
    const historialFormateado = historial.map((item) => ({
      id: item.id,
      punto_atencion_nombre:
        item.puntoAtencion?.nombre || item.punto_atencion_nombre,
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
    console.error("❌ Stack trace:", error.stack);
    res.status(500).json({
      error: "Error al obtener historial de saldo",
      detalle: error.message,
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
      detalle: error.message,
    });
  }
});

// Endpoint de debug para verificar datos en la tabla
router.get("/saldo/historial/debug", async (_, res) => {
  try {
    console.log("🔧 DEBUG: Verificando tabla ServientregaHistorialSaldo...");

    // Verificar si la tabla existe
    let count = 0;
    let historialRaw = [];
    let puntos = [];
    let errorDetails = null;

    try {
      count = await prisma.servientregaHistorialSaldo.count();
      console.log(`📊 Total de registros en historial: ${count}`);
    } catch (countError) {
      console.error("❌ Error al contar registros:", countError);
      errorDetails = { countError: countError.message };
    }

    try {
      historialRaw = await prisma.servientregaHistorialSaldo.findMany({
        orderBy: { creado_en: "desc" },
        take: 10,
      });
      console.log("📋 Registros raw (primeros 10):", historialRaw);
    } catch (findError) {
      console.error("❌ Error al obtener registros:", findError);
      errorDetails = { ...errorDetails, findError: findError.message };
    }

    try {
      puntos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
      });
      console.log("📍 Puntos de atención activos:", puntos);
    } catch (puntosError) {
      console.error("❌ Error al obtener puntos:", puntosError);
      errorDetails = { ...errorDetails, puntosError: puntosError.message };
    }

    // Verificar también la tabla de saldos
    let saldos = [];
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
      errorDetails = { ...errorDetails, saldosError: saldosError.message };
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
    console.error("❌ Stack trace:", error.stack);
    res.status(500).json({
      error: "Error en debug",
      detalle: error.message,
      stack: error.stack,
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
    const { punto_atencion_id, monto_requerido } = req.body;

    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: punto_atencion_id },
    });
    if (!punto)
      return res.status(404).json({ error: "Punto de atención no encontrado" });

    const solicitud = await prisma.servientregaSolicitudSaldo.create({
      data: {
        punto_atencion_id,
        punto_atencion_nombre: punto.nombre,
        monto_requerido: new Prisma.Decimal(monto_requerido),
        estado: "PENDIENTE",
      },
    });

    res.json({
      message: "Solicitud registrada y enviada al administrador",
      solicitud,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar solicitud de saldo" });
  }
});

router.get("/solicitar-saldo/listar", async (_, res) => {
  try {
    const solicitudes = await prisma.servientregaSolicitudSaldo.findMany({
      orderBy: { creado_en: "desc" },
    });
    res.json(solicitudes);
  } catch {
    res.status(500).json({ error: "Error al listar solicitudes" });
  }
});

router.post("/solicitar-saldo/responder", async (req, res) => {
  try {
    const { solicitud_id, estado, aprobado_por } = req.body;
    if (!["APROBADA", "RECHAZADA"].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const solicitud = await prisma.servientregaSolicitudSaldo.update({
      where: { id: solicitud_id },
      data: {
        estado,
        aprobado_por: estado === "APROBADA" ? aprobado_por : null,
        aprobado_en: new Date(),
      },
    });

    res.json({
      message: `Solicitud ${estado.toLowerCase()} correctamente`,
      solicitud,
    });
  } catch {
    res.status(500).json({ error: "Error al responder solicitud" });
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
      peso_fisico: Number(medidas.peso) || 0,
      peso_volumentrico: pesoVol || 0,
      piezas: 1,
      alto: Number(medidas.alto) || 0,
      ancho: Number(medidas.ancho) || 0,
      largo: Number(medidas.largo) || 0,
      tipo_guia: "1",
      alianza: "PRUEBAS",
      alianza_oficina: "OFICINA_PRUEBA",
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
