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

const DEFAULT_EMPAQUE = "AISLANTE DE HUMEDAD";
const DEFAULT_CP_ORI = "170150";
const DEFAULT_CP_DES = "110111";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

interface GenerarGuiaResponse {
  guia: string;
  base64: string;
  proceso?: string;
}

interface AnularGuiaResponse {
  fetch?: { proceso?: string };
}

async function callServientregaAPI(payload: any) {
  console.log("📤 [Servientrega] Request:", payload);
  try {
    const { data } = await axios.post(BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
      httpsAgent,
      timeout: 20000,
    });
    console.log("📥 [Servientrega] Response:", data);
    return data;
  } catch (error: any) {
    console.error("❌ Error Servientrega:", error.message);
    throw new Error("Error al conectar con Servientrega");
  }
}

// =============================
// 📦 Productos
// =============================
router.post("/productos", async (_, res) => {
  try {
    res.json(await callServientregaAPI({ tipo: "obtener_producto", ...AUTH }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

// 📮 Códigos Postales
router.post("/codigos-postales", async (req, res) => {
  try {
    const { codpais } = req.body;
    const data = await callServientregaAPI({
      tipo: "obtener_codigos_postales",
      codpais,
      ...AUTH,
    });

    res.json({
      fetch: data.fetch.map((c: any) => ({
        ciudad: c.city,
        codigo_postal: c.codigo_postal,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener códigos postales" });
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

// 💰 Calcular Tarifa Nacional / Internacional
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
      empaque: empaque || DEFAULT_EMPAQUE,
      ...AUTH,
    };

    if (tipo === "obtener_tarifa_internacional") {
      payload.codigo_postal_ori = codigo_postal_ori || DEFAULT_CP_ORI;
      payload.codigo_postal_des = codigo_postal_des || DEFAULT_CP_DES;
    }

    const data = await callServientregaAPI(payload);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Error al calcular tarifa" });
  }
});

// 📄 Generar Guía
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

// ❌ Anular Guía
router.post("/anular-guia", async (req, res) => {
  try {
    const { guia } = req.body;
    const response = (await callServientregaAPI({
      tipo: "ActualizaEstadoGuia",
      guia,
      estado: "Anulada",
      ...AUTH,
    })) as AnularGuiaResponse;

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

// 📅 Listar Guías
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
    res.status(500).json({ error: "Error al obtener guías" });
  }
});

// 🏢 Puntos de Atención
router.get("/remitente/puntos", async (_, res) => {
  try {
    const puntos = await prisma.puntoAtencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, ciudad: true, provincia: true },
      orderBy: { ciudad: "asc" },
    });
    res.json({ success: true, puntos });
  } catch (err) {
    res.status(500).json({ error: "Error al consultar puntos de atención" });
  }
});

// 💲 Saldos
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
    res.status(500).json({ error: "Error al asignar saldo" });
  }
});

// 🌎 País fijo
router.get("/pais", async (_, res) => {
  res.json({
    codpais: 63,
    nombrecorto: "EC",
    pais: "Ecuador",
    phone_code: "593",
  });
});

// 🏙 Ciudades (formato oficial)
router.get("/ciudades", async (_, res) => {
  try {
    const data = await callServientregaAPI({
      tipo: "obtener_ciudades",
      codpais: 63,
      ...AUTH,
    });
    res.json({ fetch: data.fetch.map((c: any) => ({ city: c.city })) });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener ciudades" });
  }
});

// ✅ Validar ciudad por punto de atención
router.get("/validar-ciudad/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: puntoAtencionId },
    });

    if (!punto)
      return res.status(404).json({ error: "Punto de atención no encontrado" });

    const ciudadCompleta = `${punto.ciudad.toUpperCase()}-${punto.provincia.toUpperCase()}`;
    const data = await callServientregaAPI({
      tipo: "obtener_ciudades",
      codpais: 63,
      ...AUTH,
    });

    const existe = data.fetch.find(
      (c: any) => c.city.toUpperCase() === ciudadCompleta
    );
    if (!existe) {
      return res.status(400).json({
        valido: false,
        mensaje: `La ciudad ${ciudadCompleta} no está en Servientrega`,
      });
    }

    res.json({ valido: true, ciudad: ciudadCompleta });
  } catch (err: any) {
    res.status(500).json({ error: "Error validando ciudad" });
  }
});

export default router;
