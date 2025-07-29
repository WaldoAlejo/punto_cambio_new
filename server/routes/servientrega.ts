import express from "express";
import axios from "axios";
import https from "https";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const BASE_URL =
  "https://servientrega-ecuador-prueba.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";

const AUTH = {
  usuingreso: "PRUEBA",
  contrasenha: "s12345ABCDe",
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

interface GenerarGuiaResponse {
  guia: string;
  base64: string;
  proceso?: string;
}

interface AnularGuiaResponse {
  fetch?: {
    proceso?: string;
  };
}

async function callServientregaAPI(payload: any) {
  console.log("[Servientrega] Request Payload:", payload);
  try {
    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
      httpsAgent,
      timeout: 20000,
    });
    console.log("[Servientrega] Response:", data);
    return data;
  } catch (error: any) {
    console.error("❌ Error al consumir API Servientrega:", error.message);
    if (error.code === "ETIMEDOUT") {
      console.error("⏳ Timeout al conectar con Servientrega.");
    }
    throw new Error("Error al conectar con Servientrega");
  }
}

// =============================
// 📦 Productos
// =============================
router.post("/productos", async (_, res) => {
  try {
    const payload = { tipo: "obtener_producto", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🌎 Paises
// =============================
router.post("/paises", async (_, res) => {
  try {
    const payload = { tipo: "obtener_paises", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🏙 Ciudades
// =============================
router.post("/ciudades", async (req, res) => {
  try {
    const { codpais } = req.body;
    const payload = { tipo: "obtener_ciudades", codpais, ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 📮 Códigos Postales (NUEVO)
// =============================
router.post("/codigos-postales", async (req, res) => {
  try {
    const { codpais } = req.body;
    const payload = { tipo: "obtener_codigos_postales", codpais, ...AUTH };
    const data = await callServientregaAPI(payload);

    if (!data || !data.fetch) {
      return res
        .status(404)
        .json({ error: "No se encontraron códigos postales" });
    }

    res.json({
      fetch: data.fetch.map((item: any) => ({
        ciudad: item.city,
        codigo_postal: item.codigo_postal,
      })),
    });
  } catch (err: any) {
    console.error("❌ Error al obtener códigos postales:", err);
    res.status(500).json({ error: "Error al obtener códigos postales" });
  }
});

// =============================
// 🏢 Agencias
// =============================
router.post("/agencias", async (_, res) => {
  try {
    const payload = { tipo: "obtener_agencias_aliadas", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 📦 Empaques
// =============================
router.post("/empaques", async (_, res) => {
  try {
    const payload = { tipo: "obtener_empaqueyembalaje", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 💰 Calcular tarifa nacional/internacional
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
      codigo_postal_ori,
      codigo_postal_des,
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

    // ✅ Para internacional, se agregan códigos postales
    if (tipo === "obtener_tarifa_internacional") {
      payload.codigo_postal_ori = codigo_postal_ori || "170150";
      payload.codigo_postal_des = codigo_postal_des || "110111";
    }

    console.log("🔍 Payload enviado a Servientrega:", payload);
    const data = await callServientregaAPI(payload);
    console.log("📥 Respuesta Servientrega:", data);

    res.json(data);
  } catch (err: any) {
    console.error("❌ Error al calcular tarifa:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 📄 Generar guía
// =============================
router.post("/generar-guia", async (req, res) => {
  try {
    const payload = { tipo: "GeneracionGuia", ...req.body, ...AUTH };
    const response = (await callServientregaAPI(
      payload
    )) as GenerarGuiaResponse;

    if (response?.guia && response?.base64) {
      const { remitente, destinatario, valor_declarado, punto_atencion_id } =
        req.body;

      const remitenteDB = await prisma.servientregaRemitente.create({
        data: remitente,
      });
      const destinatarioDB = await prisma.servientregaDestinatario.create({
        data: destinatario,
      });

      await prisma.servientregaGuia.create({
        data: {
          numero_guia: response.guia,
          proceso: response.proceso ?? "Generado",
          base64_response: response.base64,
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
            data: { monto_usado: saldo.monto_usado.plus(valor_declarado ?? 0) },
          });
        }
      }
    }
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// ❌ Anular guía
// =============================
router.post("/anular-guia", async (req, res) => {
  try {
    const { guia } = req.body;
    const payload = {
      tipo: "ActualizaEstadoGuia",
      guia,
      estado: "Anulada",
      ...AUTH,
    };
    const response = (await callServientregaAPI(payload)) as AnularGuiaResponse;

    if (response?.fetch?.proceso === "Guia Actualizada") {
      await prisma.servientregaGuia.updateMany({
        where: { numero_guia: guia },
        data: { proceso: "Anulada" },
      });
    }
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 📅 Listar guías
// =============================
router.get("/guias", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const guias = await prisma.servientregaGuia.findMany({
      where: {
        created_at: {
          gte: new Date(desde as string),
          lte: new Date(hasta as string),
        },
      },
      include: { remitente: true, destinatario: true },
      orderBy: { created_at: "desc" },
    });
    res.json(guias);
  } catch (err) {
    console.error("❌ Error al obtener guías:", err);
    res.status(500).json({ error: "Error al obtener guías" });
  }
});

// =============================
// 🏢 Puntos de atención
// =============================
router.get("/remitente/puntos", async (_, res) => {
  try {
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, ciudad: true, provincia: true },
      orderBy: { ciudad: "asc" },
    });
    res.json({ success: true, puntos });
  } catch (err) {
    console.error("❌ Error al obtener puntos de atención:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error al consultar puntos de atención",
      });
  }
});

// =============================
// 💲 Saldos
// =============================
router.get("/saldo/historial", async (_, res) => {
  try {
    const historial = await prisma.servientregaSaldo.findMany({
      select: {
        id: true,
        punto_atencion_id: true,
        monto_total: true,
        creado_por: true,
        created_at: true,
        punto_atencion: { select: { nombre: true } },
      },
      orderBy: { created_at: "desc" },
    });

    res.json(
      historial.map((h) => ({
        id: h.id,
        punto_atencion_id: h.punto_atencion_id,
        punto_atencion_nombre: h.punto_atencion.nombre,
        monto_total: Number(h.monto_total),
        creado_por: h.creado_por,
        creado_en: h.created_at,
      }))
    );
  } catch (err) {
    console.error("❌ Error al obtener historial:", err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

router.get("/saldo/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    const saldo = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: puntoAtencionId },
    });

    res.json({
      disponible: saldo ? saldo.monto_total.minus(saldo.monto_usado) : 0,
    });
  } catch (err) {
    console.error("❌ Error al obtener saldo:", err);
    res.status(500).json({ error: "Error al obtener saldo" });
  }
});

router.post("/saldo", async (req, res) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;
    const saldoExistente = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id },
    });

    const actualizado = saldoExistente
      ? await prisma.servientregaSaldo.update({
          where: { punto_atencion_id },
          data: {
            monto_total: saldoExistente.monto_total.plus(monto_total),
            creado_por,
          },
        })
      : await prisma.servientregaSaldo.create({
          data: { punto_atencion_id, monto_total, monto_usado: 0, creado_por },
        });

    res.json(actualizado);
  } catch (err: any) {
    console.error("❌ Error al asignar saldo:", err);
    res.status(500).json({ error: "Error al asignar saldo" });
  }
});

// =============================
// 🌎 País fijo
// =============================
router.get("/pais", async (_, res) => {
  res.json({
    codpais: 63,
    nombrecorto: "EC",
    pais: "Ecuador",
    phone_code: "593",
  });
});

// =============================
// 🏙 Ciudades (formato oficial)
// =============================
router.get("/ciudades", async (_, res) => {
  try {
    const payload = { tipo: "obtener_ciudades", codpais: 63, ...AUTH };
    const data = await callServientregaAPI(payload);

    res.json({ fetch: data.fetch.map((item: any) => ({ city: item.city })) });
  } catch (err: any) {
    console.error("❌ Error al obtener ciudades:", err);
    res.status(500).json({ error: "Error al obtener ciudades" });
  }
});

// =============================
// ✅ Validar ciudad por punto de atención
// =============================
router.get("/validar-ciudad/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoAtencionId },
    });

    if (!punto)
      return res.status(404).json({ error: "Punto de atención no encontrado" });

    const ciudadCompleta = `${punto.ciudad.toUpperCase()}-${punto.provincia.toUpperCase()}`;
    const payload = { tipo: "obtener_ciudades", codpais: 63, ...AUTH };
    const data = await callServientregaAPI(payload);

    const existe = data.fetch.find(
      (c: any) => c.city.toUpperCase() === ciudadCompleta
    );
    if (!existe) {
      return res
        .status(400)
        .json({
          valido: false,
          mensaje: `La ciudad ${ciudadCompleta} no está en Servientrega`,
        });
    }

    res.json({ valido: true, ciudad: ciudadCompleta });
  } catch (err: any) {
    console.error("❌ Error validando ciudad:", err);
    res.status(500).json({ error: "Error validando ciudad" });
  }
});

export default router;
