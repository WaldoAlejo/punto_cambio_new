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

async function callServientregaAPI(payload: any, timeoutMs: number = 15000) {
  try {
    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
      httpsAgent,
      timeout: timeoutMs,
      maxRedirects: 3,
      validateStatus: (status) => status < 500,
    });

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

// =============================
// 📦 Productos, 🏙 Ciudades, 🌎 Países, 🏢 Agencias, 📦 Empaques
// =============================

router.post("/productos", async (_, res) => {
  try {
    const payload = { tipo: "obtener_producto", ...AUTH };
    const result = await callServientregaAPI(payload);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

router.post("/paises", async (_, res) => {
  try {
    const payload = { tipo: "obtener_paises", ...AUTH };
    const result = await callServientregaAPI(payload);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener países:", error);
    res.status(500).json({ error: "Error al obtener países" });
  }
});

router.post("/ciudades", async (req, res) => {
  try {
    const { codpais } = req.body;
    const payload = { tipo: "obtener_ciudades", codpais, ...AUTH };
    const result = await callServientregaAPI(payload);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener ciudades:", error);
    res.status(500).json({ error: "Error al obtener ciudades" });
  }
});

router.post("/agencias", async (_, res) => {
  try {
    const payload = { tipo: "obtener_agencias_aliadas", ...AUTH };
    const result = await callServientregaAPI(payload);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener agencias:", error);
    res.status(500).json({ error: "Error al obtener agencias" });
  }
});

router.post("/empaques", async (_, res) => {
  try {
    const payload = { tipo: "obtener_empaqueyembalaje", ...AUTH };
    const result = await callServientregaAPI(payload);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener empaques:", error);
    res.status(500).json({ error: "Error al obtener empaques" });
  }
});

router.post("/tarifas", async (req, res) => {
  try {
    const payload = {
      tipo: "TarifaConIva",
      ...req.body,
      ...AUTH,
    };
    const result = await callServientregaAPI(payload);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener tarifas:", error);
    res.status(500).json({ error: "Error al obtener tarifas" });
  }
});

// =============================
// 🚚 Generar y anular guías
// =============================

interface GenerarGuiaResponse {
  guia?: string;
  base64?: string;
  [key: string]: any;
}

interface AnularGuiaResponse {
  fetch?: {
    proceso?: string;
  };
  [key: string]: any;
}

router.post("/generar-guia", async (req, res) => {
  try {
    const payload = { tipo: "GeneracionGuia", ...req.body, ...AUTH };
    const response = (await callServientregaAPI(
      payload
    )) as GenerarGuiaResponse;

    if (response?.guia && response?.base64) {
      const { remitente, destinatario, punto_atencion_id } = req.body;

      // Guardar remitente y destinatario en BD
      const remitenteDB = await prisma.servientregaRemitente.create({
        data: remitente,
      });
      const destinatarioDB = await prisma.servientregaDestinatario.create({
        data: destinatario,
      });

      // Guardar guía
      await prisma.servientregaGuia.create({
        data: {
          numero_guia: response.guia,
          proceso: "Generada",
          base64_response: response.base64,
          remitente_id: remitenteDB.id,
          destinatario_id: destinatarioDB.id,
        },
      });

      // Descontar del saldo si hay punto de atención
      if (punto_atencion_id) {
        const saldo = await prisma.servientregaSaldo.findUnique({
          where: { punto_atencion_id },
        });
        if (saldo) {
          await prisma.servientregaSaldo.update({
            where: { punto_atencion_id },
            data: {
              monto_usado: saldo.monto_usado.add(
                new Prisma.Decimal(req.body.valor || 0)
              ),
            },
          });
        }
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Error al generar guía:", error);
    res.status(500).json({ error: "Error al generar guía" });
  }
});

router.post("/anular-guia", async (req, res) => {
  try {
    const { guia } = req.body;
    const payload = {
      tipo: "AnulacionGuia",
      guia,
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
  } catch (error) {
    console.error("Error al anular guía:", error);
    res.status(500).json({ error: "Error al anular guía" });
  }
});

// =============================
// 📋 Consultas y reportes
// =============================

router.get("/guias", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const guias = await prisma.servientregaGuia.findMany({
      where: {
        created_at: {
          gte: desde ? new Date(desde as string) : subDays(new Date(), 30),
          lte: hasta ? new Date(hasta as string) : new Date(),
        },
      },
      include: {
        remitente: true,
        destinatario: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.json({ guias });
  } catch (error) {
    console.error("Error al consultar guías:", error);
    res.status(500).json({ error: "Error al consultar guías" });
  }
});

router.get("/saldo/historial", async (_, res) => {
  try {
    const historial = await prisma.servientregaSaldo.findMany({
      select: {
        id: true,
        monto_total: true,
        monto_usado: true,
        created_at: true,
        updated_at: true,
        punto_atencion_id: true,
        punto_atencion: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
            provincia: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const data = historial.map((item) => ({
      ...item,
      disponible: item.monto_total.sub(item.monto_usado),
      punto_nombre: item.punto_atencion?.nombre,
      punto_ubicacion: `${item.punto_atencion?.ciudad}, ${item.punto_atencion?.provincia}`,
    }));

    res.json(data);
  } catch (error) {
    console.error("Error al obtener historial Servientrega:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

router.get("/saldo/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    const saldo = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: puntoAtencionId },
    });

    if (!saldo) {
      return res.json({ disponible: 0 });
    }

    const disponible = saldo.monto_total.sub(saldo.monto_usado);
    res.json({ disponible: disponible.toNumber() });
  } catch (error) {
    console.error("Error al obtener saldo:", error);
    res.status(500).json({ error: "Error al obtener saldo" });
  }
});

router.post("/saldo", async (req, res) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;

    const saldoExistente = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id },
    });

    const resultado = saldoExistente
      ? await prisma.servientregaSaldo.update({
          where: { punto_atencion_id },
          data: {
            monto_total: new Prisma.Decimal(monto_total),
            updated_at: new Date(),
          },
        })
      : await prisma.servientregaSaldo.create({
          data: {
            punto_atencion_id,
            monto_total: new Prisma.Decimal(monto_total),
            monto_usado: new Prisma.Decimal(0),
            creado_por,
          },
        });

    res.json({ success: true, saldo: resultado });
  } catch (error) {
    console.error("Error al gestionar saldo:", error);
    res.status(500).json({ error: "Error al gestionar saldo" });
  }
});

// =============================
// 👤 Búsqueda de Remitentes y Destinatarios
// =============================

router.get("/remitente/buscar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const remitentes = await prisma.servientregaRemitente.findMany({
      where: {
        cedula: {
          contains: cedula,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });

    res.json({ remitentes });
  } catch (error) {
    console.error("Error al buscar remitente:", error);
    res.status(500).json({ error: "Error al buscar remitente" });
  }
});

router.get("/destinatario/buscar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const destinatarios = await prisma.servientregaDestinatario.findMany({
      where: {
        cedula: {
          contains: cedula,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });

    res.json({ destinatarios });
  } catch (error) {
    console.error("Error al buscar destinatario:", error);
    res.status(500).json({ error: "Error al buscar destinatario" });
  }
});

router.get("/destinatario/buscar-nombre/:nombre", async (req, res) => {
  try {
    const { nombre } = req.params;
    const destinatarios = await prisma.servientregaDestinatario.findMany({
      where: {
        nombre: {
          contains: nombre,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { nombre: "asc" },
    });

    res.json({ destinatarios });
  } catch (error) {
    console.error("Error al buscar destinatario por nombre:", error);
    res.status(500).json({ error: "Error al buscar destinatario por nombre" });
  }
});

// =============================
// 💾 Guardar y Actualizar Remitentes/Destinatarios
// =============================

router.post("/remitente/guardar", async (req, res) => {
  try {
    const remitente = await prisma.servientregaRemitente.create({
      data: req.body,
    });
    res.json({ success: true, remitente });
  } catch (error) {
    console.error("Error al guardar remitente:", error);
    res.status(500).json({ error: "Error al guardar remitente" });
  }
});

router.put("/remitente/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const remitente = await prisma.servientregaRemitente.updateMany({
      where: { cedula },
      data: req.body,
    });
    res.json({ success: true, remitente });
  } catch (error) {
    console.error("Error al actualizar remitente:", error);
    res.status(500).json({ error: "Error al actualizar remitente" });
  }
});

router.post("/destinatario/guardar", async (req, res) => {
  try {
    const destinatarioData = req.body;

    console.log(`📝 Guardando nuevo destinatario:`, destinatarioData);

    const destinatario = await prisma.servientregaDestinatario.create({
      data: destinatarioData,
    });

    console.log(`✅ Destinatario guardado correctamente:`, destinatario);

    res.json({
      success: true,
      destinatario,
      message: "Destinatario guardado correctamente",
    });
  } catch (error) {
    console.error("❌ Error al guardar destinatario:", error);
    console.error(
      "📋 Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    res.status(500).json({
      success: false,
      error: "Error al guardar destinatario",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.put("/destinatario/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const updateData = req.body;

    console.log(`📝 Actualizando destinatario con cédula: ${cedula}`);
    console.log(`📋 Datos a actualizar:`, updateData);

    // Verificar si el destinatario existe
    const existingDestinatario =
      await prisma.servientregaDestinatario.findFirst({
        where: { cedula },
      });

    if (!existingDestinatario) {
      console.log(`❌ Destinatario con cédula ${cedula} no encontrado`);
      return res.status(404).json({
        success: false,
        error: "Destinatario no encontrado",
      });
    }

    const destinatario = await prisma.servientregaDestinatario.updateMany({
      where: { cedula },
      data: updateData,
    });

    console.log(`✅ Destinatario actualizado correctamente:`, destinatario);

    res.json({
      success: true,
      destinatario,
      message: "Destinatario actualizado correctamente",
    });
  } catch (error) {
    console.error("❌ Error al actualizar destinatario:", error);
    console.error(
      "📋 Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    res.status(500).json({
      success: false,
      error: "Error al actualizar destinatario",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
