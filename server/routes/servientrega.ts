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
// 🔍 Buscar remitente
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

// 💾 Guardar remitente
router.post("/remitente/guardar", async (req, res) => {
  try {
    const data = req.body;
    const remitente = await prisma.servientregaRemitente.create({ data });
    res.json(remitente);
  } catch {
    res.status(500).json({ error: "Error al guardar remitente" });
  }
});

// ✏️ Actualizar remitente
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
// 🔍 Buscar destinatario
// =============================
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

// 💾 Guardar destinatario
router.post("/destinatario/guardar", async (req, res) => {
  try {
    const data = req.body;
    const destinatario = await prisma.servientregaDestinatario.create({ data });
    res.json(destinatario);
  } catch {
    res.status(500).json({ error: "Error al guardar destinatario" });
  }
});

// ✏️ Actualizar destinatario
router.put("/destinatario/actualizar/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;
    const data = req.body;
    const destinatario = await prisma.servientregaDestinatario.update({
      where: { cedula },
      data,
    });
    res.json(destinatario);
  } catch {
    res.status(500).json({ error: "Error al actualizar destinatario" });
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
      where: {
        created_at: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
      },
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

    const data = await callServientregaAPI(payload);
    res.json(data);
  } catch {
    res.status(500).json({ error: "Error al calcular tarifa" });
  }
});

// =============================
// 📄 Generar Guía
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
    } = req.body;

    const pesoVol =
      (Number(medidas.alto) * Number(medidas.ancho) * Number(medidas.largo)) /
      5000;

    const payload = {
      tipo: "GeneracionGuia",
      nombre_producto,
      ciudad_origen: `${remitente.ciudad?.toUpperCase()}-${remitente.provincia?.toUpperCase()}`,
      cedula_remitente: remitente.identificacion,
      nombre_remitente: remitente.nombre,
      direccion_remitente: remitente.direccion,
      telefono_remitente: remitente.telefono,
      codigo_postal_remitente: remitente.codigo_postal || "170150",
      cedula_destinatario: destinatario.identificacion,
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
      ...AUTH,
    };

    const response = await callServientregaAPI(payload);

    if (response?.fetch?.proceso === "Guia Generada Correctamente") {
      const { guia, guia_64 } = response.fetch;

      const remitenteDB =
        (await prisma.servientregaRemitente.findFirst({
          where: { cedula: remitente.identificacion },
        })) || (await prisma.servientregaRemitente.create({ data: remitente }));

      const destinatarioDB =
        (await prisma.servientregaDestinatario.findFirst({
          where: { cedula: destinatario.identificacion },
        })) ||
        (await prisma.servientregaDestinatario.create({ data: destinatario }));

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
    console.error("Error al generar guía:", err);
    res
      .status(500)
      .json({ error: "Error al generar guía", detalle: err.message });
  }
});

export default router;
