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
  console.log("📤 [Servientrega] Request Payload:", payload);
  try {
    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
      httpsAgent,
      timeout: 20000,
    });
    console.log("📥 [Servientrega] Response:", data);
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
// 📦 Productos, 🏙 Ciudades, 🌎 Países, 🏢 Agencias, 📦 Empaques
// =============================

router.post("/productos", async (_, res) => {
  try {
    const payload = { tipo: "obtener_producto", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/paises", async (_, res) => {
  try {
    const payload = { tipo: "obtener_paises", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ciudades", async (req, res) => {
  try {
    const { codpais } = req.body;
    const payload = { tipo: "obtener_ciudades", codpais, ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/agencias", async (_, res) => {
  try {
    const payload = { tipo: "obtener_agencias_aliadas", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/empaques", async (_, res) => {
  try {
    const payload = { tipo: "obtener_empaqueyembalaje", ...AUTH };
    res.json(await callServientregaAPI(payload));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 💰 Calcular tarifa
// =============================

router.post("/tarifa", async (req, res) => {
  try {
    const esInternacional = req.body.pais_des?.toUpperCase() !== "ECUADOR";
    const tipo = esInternacional
      ? "obtener_tarifa_internacional"
      : "obtener_tarifa_nacional";

    console.log(`🔍 Calculando tarifa (${tipo})...`);

    // Validación de ciudades solo para nacional
    if (!esInternacional) {
      const ciudadesData = await callServientregaAPI({
        tipo: "obtener_ciudades",
        codpais: 63,
        ...AUTH,
      });

      const ciudadesValidas = ciudadesData.fetch.map((c: any) =>
        c.city.toUpperCase()
      );

      const ciudadOrigen =
        `${req.body.ciu_ori}-${req.body.provincia_ori}`.toUpperCase();
      const ciudadDestino =
        `${req.body.ciu_des}-${req.body.provincia_des}`.toUpperCase();

      if (!ciudadesValidas.includes(ciudadOrigen)) {
        return res
          .status(400)
          .json({ error: `Ciudad de origen inválida: ${ciudadOrigen}` });
      }
      if (!ciudadesValidas.includes(ciudadDestino)) {
        return res
          .status(400)
          .json({ error: `Ciudad de destino inválida: ${ciudadDestino}` });
      }
    }

    // Autocompletar código postal en internacional
    let cod_postal_des = req.body.cod_postal_des || "";
    if (esInternacional && !cod_postal_des) {
      cod_postal_des = "00000"; // Código postal genérico en caso de no proporcionarse
    }

    // Construcción del payload
    const payload = {
      tipo,
      pais_ori: req.body.pais_ori?.toUpperCase(),
      ciu_ori: req.body.ciu_ori?.toUpperCase(),
      provincia_ori: req.body.provincia_ori?.toUpperCase(),
      pais_des: req.body.pais_des?.toUpperCase(),
      ciu_des: req.body.ciu_des?.toUpperCase(),
      provincia_des: req.body.provincia_des?.toUpperCase(),
      cod_postal_des,
      valor_seguro: req.body.valor_seguro?.toString() || "0",
      valor_declarado: req.body.valor_declarado?.toString() || "0",
      peso: req.body.peso?.toString() || "0",
      alto: req.body.alto?.toString() || "0",
      ancho: req.body.ancho?.toString() || "0",
      largo: req.body.largo?.toString() || "0",
      recoleccion: req.body.recoleccion || "NO",
      nombre_producto: req.body.nombre_producto?.toUpperCase(),
      empaque: req.body.empaque || "",
      ...AUTH,
    };

    console.log("🚀 [Tarifa] Payload final:", payload);

    const response = await callServientregaAPI(payload);
    res.json(response);
  } catch (err: any) {
    console.error("❌ Error en /tarifa:", err.message);
    res.status(500).json({ error: "Error al calcular tarifa" });
  }
});

// =============================
// 📄 Generar Guía
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
            data: {
              monto_usado: saldo.monto_usado.plus(valor_declarado ?? 0),
            },
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
// ❌ Anular Guía
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
    res.status(500).json({
      success: false,
      message: "Error al consultar puntos de atención",
    });
  }
});

// =============================
// 💲 Saldo
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

    const data = historial.map((h) => ({
      id: h.id,
      punto_atencion_id: h.punto_atencion_id,
      punto_atencion_nombre: h.punto_atencion.nombre,
      monto_total: Number(h.monto_total),
      creado_por: h.creado_por,
      creado_en: h.created_at,
    }));

    res.json(data);
  } catch (err) {
    console.error("❌ Error al obtener historial Servientrega:", err);
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
          data: {
            punto_atencion_id,
            monto_total,
            monto_usado: 0,
            creado_por,
          },
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
  try {
    res.json({
      codpais: 63,
      nombrecorto: "EC",
      pais: "Ecuador",
      phone_code: "593",
    });
  } catch (err: any) {
    console.error("❌ Error al obtener país:", err);
    res.status(500).json({ error: "Error al obtener país" });
  }
});

// =============================
// 🏙 Ciudades Ecuador
// =============================
router.get("/ciudades", async (_, res) => {
  try {
    const payload = { tipo: "obtener_ciudades", codpais: 63, ...AUTH };
    const data = await callServientregaAPI(payload);

    if (!data || !data.fetch) {
      return res
        .status(500)
        .json({ error: "No se obtuvo la lista de ciudades" });
    }

    res.json({
      fetch: data.fetch.map((item: any) => ({
        city: item.city,
      })),
    });
  } catch (err: any) {
    console.error("❌ Error al obtener ciudades:", err);
    res.status(500).json({ error: "Error al obtener ciudades" });
  }
});

// =============================
// ✅ Validar ciudad desde punto de atención
// =============================
router.get("/validar-ciudad/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoAtencionId },
    });

    if (!punto) {
      return res.status(404).json({ error: "Punto de atención no encontrado" });
    }

    const ciudadCompleta = `${punto.ciudad.toUpperCase()}-${punto.provincia.toUpperCase()}`;
    const payload = { tipo: "obtener_ciudades", codpais: 63, ...AUTH };
    const data = await callServientregaAPI(payload);

    const existe = data.fetch.find(
      (c: any) => c.city.toUpperCase() === ciudadCompleta
    );

    if (!existe) {
      return res.status(400).json({
        valido: false,
        mensaje: `La ciudad ${ciudadCompleta} no está registrada en Servientrega`,
      });
    }

    res.json({ valido: true, ciudad: ciudadCompleta });
  } catch (err: any) {
    console.error("❌ Error validando ciudad:", err);
    res.status(500).json({ error: "Error validando ciudad" });
  }
});

export default router;
