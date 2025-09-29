import express from "express";
import { ServientregaDBService } from "../../services/servientregaDBService.js";

const router = express.Router();

// =============================
// 💰 Gestión de Saldos
// =============================

router.get("/saldo/historial", async (_, res) => {
  try {
    const dbService = new ServientregaDBService();
    const historial = await dbService.obtenerHistorialSaldos();

    res.json(historial);
  } catch (error) {
    console.error("Error al obtener historial Servientrega:", error);
    res.status(500).json({
      error: "Error al obtener historial",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.get("/saldo/validar/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;
    const { monto } = req.query;

    console.log(
      `🔍 Servientrega: Validando saldo para punto ${puntoAtencionId}, monto: ${monto}`
    );

    if (!puntoAtencionId) {
      return res.status(400).json({
        estado: "ERROR",
        mensaje: "El ID del punto de atención es requerido",
      });
    }

    const dbService = new ServientregaDBService();
    const saldo = await dbService.obtenerSaldo(puntoAtencionId);

    if (!saldo) {
      console.log(
        `❌ Servientrega: No se encontró saldo para punto ${puntoAtencionId}`
      );
      return res.json({
        estado: "SIN_SALDO",
        mensaje: "No hay saldo asignado para este punto de atención",
        disponible: 0,
      });
    }

    const disponible = saldo.monto_total.sub(saldo.monto_usado).toNumber();
    const montoRequerido = monto ? parseFloat(monto as string) : 0;

    console.log(
      `💰 Servientrega: Saldo disponible: ${disponible}, Monto requerido: ${montoRequerido}`
    );

    if (disponible <= 0) {
      return res.json({
        estado: "SALDO_AGOTADO",
        mensaje: "El saldo disponible se ha agotado",
        disponible: disponible,
        monto_requerido: montoRequerido,
      });
    }

    if (montoRequerido > 0 && disponible < montoRequerido) {
      return res.json({
        estado: "SALDO_INSUFICIENTE",
        mensaje: `Saldo insuficiente. Disponible: $${disponible.toFixed(
          2
        )}, Requerido: $${montoRequerido.toFixed(2)}`,
        disponible: disponible,
        monto_requerido: montoRequerido,
      });
    }

    return res.json({
      estado: "OK",
      mensaje: "Saldo suficiente para la operación",
      disponible: disponible,
      monto_requerido: montoRequerido,
      monto_total: saldo.monto_total.toNumber(),
      monto_usado: saldo.monto_usado.toNumber(),
    });
  } catch (error) {
    console.error(
      `❌ Servientrega: Error al validar saldo para punto ${req.params.puntoAtencionId}:`,
      error
    );
    res.status(500).json({
      estado: "ERROR",
      mensaje: "Error interno al validar saldo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.get("/saldo/:puntoAtencionId", async (req, res) => {
  try {
    const { puntoAtencionId } = req.params;

    console.log(
      `💰 Servientrega: Consultando saldo para punto ${puntoAtencionId}`
    );

    if (!puntoAtencionId) {
      console.error(
        "❌ Servientrega: ID de punto de atención no proporcionado"
      );
      return res
        .status(400)
        .json({ error: "El ID del punto de atención es requerido" });
    }

    const dbService = new ServientregaDBService();
    const saldo = await dbService.obtenerSaldo(puntoAtencionId);

    if (!saldo) {
      console.log(
        `💰 Servientrega: No se encontró saldo para punto ${puntoAtencionId}, devolviendo 0`
      );
      return res.json({ disponible: 0 });
    }

    const disponible = saldo.monto_total.sub(saldo.monto_usado);
    const resultado = {
      disponible: disponible.toNumber(),
      monto_total: saldo.monto_total.toNumber(),
      monto_usado: saldo.monto_usado.toNumber(),
    };

    console.log(
      `✅ Servientrega: Saldo para punto ${puntoAtencionId}:`,
      resultado
    );
    res.json(resultado);
  } catch (error) {
    console.error(
      `❌ Servientrega: Error al obtener saldo para punto ${req.params.puntoAtencionId}:`,
      error
    );
    res.status(500).json({
      error: "Error al obtener saldo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.post("/saldo", async (req, res) => {
  try {
    const { monto_total, creado_por, punto_atencion_id } = req.body;

    // Validaciones
    if (!punto_atencion_id) {
      return res
        .status(400)
        .json({ error: "El ID del punto de atención es requerido" });
    }

    if (!monto_total || isNaN(parseFloat(monto_total))) {
      return res
        .status(400)
        .json({ error: "El monto total debe ser un número válido" });
    }

    const dbService = new ServientregaDBService();
    const resultado = await dbService.gestionarSaldo({
      punto_atencion_id,
      monto_total: parseFloat(monto_total),
      creado_por,
    });

    res.json({
      success: true,
      saldo: {
        ...resultado,
        monto_total: resultado.monto_total.toNumber(),
        monto_usado: resultado.monto_usado.toNumber(),
      },
    });
  } catch (error) {
    console.error("Error al gestionar saldo:", error);
    res.status(500).json({
      success: false,
      error: "Error al gestionar saldo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// =============================
// 📋 Solicitudes de Saldo
// =============================

router.post("/solicitar-saldo", async (req, res) => {
  try {
    const { punto_atencion_id, monto_solicitado, observaciones, creado_por } =
      req.body;

    // Validaciones
    if (!punto_atencion_id) {
      return res
        .status(400)
        .json({ error: "El ID del punto de atención es requerido" });
    }

    if (!monto_solicitado || isNaN(parseFloat(monto_solicitado))) {
      return res
        .status(400)
        .json({ error: "El monto solicitado debe ser un número válido" });
    }

    const dbService = new ServientregaDBService();
    const solicitud = await dbService.crearSolicitudSaldo({
      punto_atencion_id,
      monto_solicitado: parseFloat(monto_solicitado),
      observaciones: observaciones || "",
      creado_por: creado_por || "Sistema",
    });

    res.json({
      success: true,
      solicitud,
      message: "Solicitud de saldo creada correctamente",
    });
  } catch (error) {
    console.error("Error al crear solicitud de saldo:", error);
    res.status(500).json({
      success: false,
      error: "Error al crear solicitud de saldo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.get("/solicitar-saldo/listar", async (req, res) => {
  try {
    const { estado, punto_atencion_id } = req.query;

    const dbService = new ServientregaDBService();
    const solicitudes = await dbService.listarSolicitudesSaldo({
      estado: estado as string,
      punto_atencion_id: punto_atencion_id as string,
    });

    res.json({
      success: true,
      solicitudes,
    });
  } catch (error) {
    console.error("Error al listar solicitudes de saldo:", error);
    res.status(500).json({
      success: false,
      error: "Error al listar solicitudes de saldo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

router.put("/solicitar-saldo/:id/estado", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, aprobado_por } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ error: "El ID de la solicitud es requerido" });
    }

    if (!["PENDIENTE", "APROBADA", "RECHAZADA"].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const dbService = new ServientregaDBService();
    const solicitud = await dbService.actualizarEstadoSolicitudSaldo(
      id,
      estado,
      aprobado_por
    );

    res.json({
      success: true,
      solicitud,
      message: `Solicitud ${estado.toLowerCase()} correctamente`,
    });
  } catch (error) {
    console.error("Error al actualizar estado de solicitud:", error);
    res.status(500).json({
      success: false,
      error: "Error al actualizar estado de solicitud",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export { router as balancesRouter };
