import express from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const BASE_URL =
  "https://servientrega-ecuador-prueba.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";

const AUTH = {
  usuingreso: "PRUEBA",
  contrasenha: "s12345ABCDe",
};

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
  try {
    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error: any) {
    console.error("❌ Error al consumir API Servientrega:", error.message);
    throw new Error("Error al conectar con Servientrega");
  }
}

// 📦 Productos
router.post("/productos", async (_, res) => {
  const payload = { tipo: "obtener_producto", ...AUTH };
  const data = await callServientregaAPI(payload);
  res.json(data);
});

// 🌎 Países
router.post("/paises", async (_, res) => {
  const payload = { tipo: "obtener_paises", ...AUTH };
  const data = await callServientregaAPI(payload);
  res.json(data);
});

// 🏙 Ciudades
router.post("/ciudades", async (req, res) => {
  const { codpais } = req.body;
  const payload = { tipo: "obtener_ciudades", codpais, ...AUTH };
  const data = await callServientregaAPI(payload);
  res.json(data);
});

// 🏢 Agencias
router.post("/agencias", async (_, res) => {
  const payload = { tipo: "obtener_agencias_aliadas", ...AUTH };
  const data = await callServientregaAPI(payload);
  res.json(data);
});

// 📦 Empaques
router.post("/empaques", async (_, res) => {
  const payload = { tipo: "obtener_empaqueyembalaje", ...AUTH };
  const data = await callServientregaAPI(payload);
  res.json(data);
});

// 💰 Tarifa
router.post("/tarifa", async (req, res) => {
  const {
    ciu_ori,
    provincia_ori,
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

  const payload = {
    tipo: "obtener_tarifa_nacional",
    ciu_ori,
    provincia_ori,
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
    ...AUTH,
  };

  const data = await callServientregaAPI(payload);
  res.json(data);
});

// 📄 Generar guía y descontar saldo del punto
router.post("/generar-guia", async (req, res) => {
  const payload = {
    tipo: "GeneracionGuia",
    ...req.body,
    ...AUTH,
  };

  const response = (await callServientregaAPI(payload)) as GenerarGuiaResponse;

  if (
    typeof response.guia === "string" &&
    typeof response.base64 === "string"
  ) {
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
          data: {
            monto_usado: saldo.monto_usado.plus(valor_declarado ?? 0),
          },
        });
      }
    }
  }

  res.json(response);
});

// ❌ Anular guía
router.post("/anular-guia", async (req, res) => {
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
});

// 📅 Obtener guías por fecha
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
      include: {
        remitente: true,
        destinatario: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.json(guias);
  } catch (error) {
    console.error("❌ Error al obtener guías:", error);
    res.status(500).json({ error: "Error al obtener guías" });
  }
});

// 🏢 Obtener puntos de atención
router.get("/remitente/puntos", async (_, res) => {
  try {
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
        provincia: true,
      },
      orderBy: { ciudad: "asc" },
    });

    res.json({ success: true, puntos });
  } catch (error) {
    console.error("❌ Error al obtener puntos de atención:", error);
    res.status(500).json({
      success: false,
      message: "Error al consultar puntos de atención",
    });
  }
});

// 🕒 Obtener historial de asignaciones de saldo Servientrega
router.get("/saldo/historial", async (_, res) => {
  try {
    const historial = await prisma.servientregaSaldo.findMany({
      select: {
        id: true,
        punto_atencion_id: true,
        monto_total: true,
        creado_por: true,
        created_at: true,
        punto_atencion: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const data = historial.map((h) => ({
      id: h.id,
      punto_atencion_id: h.punto_atencion_id,
      punto_atencion_nombre: h.punto_atencion.nombre,
      monto_total: Number(h.monto_total),
      creado_por: h.creado_por,
      creado_en: h.created_at,
    }));

    res.json(data);
  } catch (error) {
    console.error("❌ Error al obtener historial Servientrega:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// 💲 Obtener saldo por punto de atención (⚠️ ESTA DEBE IR DESPUÉS DE /saldo/historial)
router.get("/saldo/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;

    const saldo = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: puntoAtencionId },
    });

    if (!saldo) {
      return res.json({ disponible: 0 });
    }

    const disponible = saldo.monto_total.minus(saldo.monto_usado);
    res.json({ disponible });
  } catch (error) {
    console.error("❌ Error al obtener saldo:", error);
    res.status(500).json({ error: "Error al obtener saldo" });
  }
});

// 💲 Crear o actualizar saldo por punto (SUMANDO saldo si ya existe)
router.post("/saldo", async (req, res) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;

    const saldoExistente = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id },
    });

    let actualizado;

    if (saldoExistente) {
      actualizado = await prisma.servientregaSaldo.update({
        where: { punto_atencion_id },
        data: {
          monto_total: saldoExistente.monto_total.plus(monto_total),
          creado_por,
        },
      });
    } else {
      actualizado = await prisma.servientregaSaldo.create({
        data: {
          punto_atencion_id,
          monto_total,
          monto_usado: 0,
          creado_por,
        },
      });
    }

    res.json(actualizado);
  } catch (error) {
    console.error("❌ Error al asignar saldo:", error);
    res.status(500).json({ error: "Error al asignar saldo" });
  }
});

export default router;
