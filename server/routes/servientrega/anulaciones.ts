import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import { ServientregaAPIService } from "../../services/servientregaAPIService.js";

const router = express.Router();
const dbService = new ServientregaDBService();

// GET /api/servientrega/solicitudes-anulacion
router.get("/solicitudes-anulacion", authenticateToken, async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;

    console.log("🔍 Obteniendo solicitudes de anulación:", {
      desde,
      hasta,
      estado,
    });

    const solicitudes = await dbService.obtenerSolicitudesAnulacion({
      desde: desde as string,
      hasta: hasta as string,
      estado: estado as string,
    });

    // Transformar datos para el frontend
    const solicitudesTransformadas = solicitudes.map((solicitud) => ({
      id: solicitud.id,
      guia_id: solicitud.guia_id,
      numero_guia: solicitud.numero_guia,
      motivo_anulacion: solicitud.motivo_anulacion,
      fecha_solicitud: solicitud.fecha_solicitud,
      estado: solicitud.estado,
      solicitado_por: solicitud.solicitado_por,
      solicitado_por_nombre: solicitud.solicitado_por_nombre || "N/A",
      fecha_respuesta: solicitud.fecha_respuesta,
      respondido_por: solicitud.respondido_por,
      respondido_por_nombre: solicitud.respondido_por_nombre || "N/A",
      observaciones_respuesta: solicitud.observaciones_respuesta || "",
    }));

    res.json({
      data: solicitudesTransformadas,
      success: true,
    });
  } catch (error) {
    console.error("❌ Error al obtener solicitudes de anulación:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// POST /api/servientrega/solicitudes-anulacion
router.post("/solicitudes-anulacion", authenticateToken, async (req, res) => {
  try {
    const { guia_id, numero_guia, motivo_anulacion } = req.body;
    const usuario = (req as any).user;

    console.log("📝 Creando solicitud de anulación:", {
      guia_id,
      numero_guia,
      motivo_anulacion,
      usuario: usuario.id,
    });

    const solicitud = await dbService.crearSolicitudAnulacion({
      guia_id,
      numero_guia,
      motivo_anulacion,
      solicitado_por: usuario.id,
      solicitado_por_nombre: usuario.nombre,
    });

    res.json({
      data: solicitud,
      success: true,
      message: "Solicitud de anulación creada exitosamente",
    });
  } catch (error) {
    console.error("❌ Error al crear solicitud de anulación:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// PUT /api/servientrega/solicitudes-anulacion/:id/responder
router.put(
  "/solicitudes-anulacion/:id/responder",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { accion, observaciones } = req.body; // accion: "APROBAR" | "RECHAZAR"
      const usuario = (req as any).user;

      console.log("✅ Respondiendo solicitud de anulación:", {
        id,
        accion,
        observaciones,
        usuario: usuario.id,
      });

      // Actualizar estado de la solicitud
      const estado = accion === "APROBAR" ? "APROBADA" : "RECHAZADA";

      const solicitudActualizada = await dbService.actualizarSolicitudAnulacion(
        id,
        {
          estado,
          respondido_por: usuario.id,
          respondido_por_nombre: usuario.nombre,
          observaciones_respuesta: observaciones,
          fecha_respuesta: new Date(),
        }
      );

      // Si se aprueba, proceder con la anulación en Servientrega
      if (accion === "APROBAR") {
        try {
          await procesarAnulacionServientrega(solicitudActualizada.numero_guia);

          // Actualizar estado de la guía en la base de datos
          await dbService.anularGuia(solicitudActualizada.numero_guia);

          console.log("✅ Guía anulada exitosamente en Servientrega");
        } catch (apiError) {
          console.error("❌ Error al anular en Servientrega:", apiError);
          // La solicitud queda aprobada pero se registra el error
          await dbService.actualizarSolicitudAnulacion(id, {
            observaciones_respuesta: `${observaciones}\n\nError en API Servientrega: ${apiError}`,
          });
        }
      }

      res.json({
        data: solicitudActualizada,
        success: true,
        message: `Solicitud ${estado.toLowerCase()} exitosamente`,
      });
    } catch (error) {
      console.error("❌ Error al responder solicitud:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// Función auxiliar para procesar anulación en Servientrega
async function procesarAnulacionServientrega(numeroGuia: string) {
  const apiService = new ServientregaAPIService({
    usuingreso: process.env.SERVIENTREGA_USER || "PRUEBA",
    contrasenha: process.env.SERVIENTREGA_PASSWORD || "s12345ABCDe",
  });

  const payload = {
    tipo: "ActualizaEstadoGuia",
    guia: numeroGuia,
    estado: "Anulada",
  };

  const response = await apiService.callAPI(payload);

  if (!response.fetch?.proceso?.includes("Actualizada")) {
    throw new Error(`Error en API Servientrega: ${JSON.stringify(response)}`);
  }

  return response;
}

// POST /api/servientrega/solicitar-anulacion (alias para compatibilidad con frontend)
router.post("/solicitar-anulacion", authenticateToken, async (req, res) => {
  try {
    const { guia_id, numero_guia, motivo } = req.body;
    const usuario = (req as any).user;

    console.log("📝 Creando solicitud de anulación (alias):", {
      guia_id,
      numero_guia,
      motivo,
      usuario: usuario.id,
    });

    const solicitud = await dbService.crearSolicitudAnulacion({
      guia_id,
      numero_guia,
      motivo_anulacion: motivo,
      solicitado_por: usuario.id,
      solicitado_por_nombre: usuario.nombre,
    });

    res.json({
      data: solicitud,
      success: true,
      message: "Solicitud de anulación creada exitosamente",
    });
  } catch (error) {
    console.error("❌ Error al crear solicitud de anulación:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// POST /api/servientrega/responder-solicitud-anulacion (alias para compatibilidad con frontend)
router.post(
  "/responder-solicitud-anulacion",
  authenticateToken,
  async (req, res) => {
    try {
      const { solicitud_id, accion, comentario } = req.body;
      const usuario = (req as any).user;

      console.log("✅ Respondiendo solicitud de anulación (alias):", {
        solicitud_id,
        accion,
        comentario,
        usuario: usuario.id,
      });

      // Actualizar estado de la solicitud
      const estado = accion === "APROBAR" ? "APROBADA" : "RECHAZADA";

      const solicitudActualizada = await dbService.actualizarSolicitudAnulacion(
        solicitud_id,
        {
          estado,
          respondido_por: usuario.id,
          respondido_por_nombre: usuario.nombre,
          observaciones_respuesta: comentario,
          fecha_respuesta: new Date(),
        }
      );

      // Si se aprueba, proceder con la anulación en Servientrega
      if (accion === "APROBAR") {
        try {
          await procesarAnulacionServientrega(solicitudActualizada.numero_guia);

          // Actualizar estado de la guía en la base de datos
          await dbService.anularGuia(solicitudActualizada.numero_guia);

          console.log("✅ Guía anulada exitosamente en Servientrega");
        } catch (apiError) {
          console.error("❌ Error al anular en Servientrega:", apiError);
          // La solicitud queda aprobada pero se registra el error
          await dbService.actualizarSolicitudAnulacion(solicitud_id, {
            observaciones_respuesta: `${comentario}\n\nError en API Servientrega: ${apiError}`,
          });
        }
      }

      res.json({
        data: solicitudActualizada,
        success: true,
        message: `Solicitud ${estado.toLowerCase()} exitosamente`,
      });
    } catch (error) {
      console.error("❌ Error al responder solicitud:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export { router as anulacionesRouter };
