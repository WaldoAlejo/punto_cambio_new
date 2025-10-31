import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import { ServientregaAPIService } from "../../services/servientregaAPIService.js";
import prisma from "../../lib/prisma.js";

const router = express.Router();
const dbService = new ServientregaDBService();

/** Helpers */
function sendError(
  res: express.Response,
  status: number,
  err: unknown,
  fallback = "Error interno del servidor"
) {
  const message = err instanceof Error ? err.message : fallback;
  return res.status(status).json({ success: false, error: fallback, message });
}

function validarAccion(accion?: string) {
  const val = String(accion || "")
    .toUpperCase()
    .trim();
  return val === "APROBAR" || val === "RECHAZAR";
}

function esAnulacionExitosa(resp: any): boolean {
  const procesoFetch = resp?.fetch?.proceso;
  if (typeof procesoFetch === "string" && /actualizad/i.test(procesoFetch))
    return true;
  const procesoPlano = resp?.proceso;
  if (typeof procesoPlano === "string" && /actualizad/i.test(procesoPlano))
    return true;
  if (typeof resp === "string") {
    const match = resp.match(/\{"proceso":"([^"]+)"\}/i);
    if (match?.[1] && /actualizad/i.test(match[1])) return true;
  }
  return false;
}

/** Obtiene credenciales desde env, valida que existan */
function getCreds() {
  const usuingreso = process.env.SERVIENTREGA_USER;
  const contrasenha = process.env.SERVIENTREGA_PASSWORD;
  if (!usuingreso || !contrasenha) {
    throw new Error(
      "Faltan variables de entorno SERVIENTREGA_USER y/o SERVIENTREGA_PASSWORD. Verifica .env.production"
    );
  }
  return { usuingreso, contrasenha };
}

/** Llama al API de Servientrega para marcar la guía como Anulada (incluye credenciales en payload) */
async function procesarAnulacionServientrega(numeroGuia: string) {
  const { usuingreso, contrasenha } = getCreds();

  // Si tu ServientregaAPIService ya inyecta credenciales, igual está bien incluirlas aquí:
  const apiService = new ServientregaAPIService({ usuingreso, contrasenha });

  const payload = {
    tipo: "ActualizaEstadoGuia",
    guia: numeroGuia,
    estado: "Anulada",
    usuingreso, // <- requerido por tu API de anulación
    contrasenha, // <- requerido por tu API de anulación
  };

  const response = await apiService.callAPI(payload);

  if (!esAnulacionExitosa(response)) {
    throw new Error(
      `Respuesta inesperada de Servientrega: ${JSON.stringify(response)}`
    );
  }
  return response;
}

/* ==============================
   GET /api/servientrega/solicitudes-anulacion
============================== */
router.get("/solicitudes-anulacion", authenticateToken, async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;

    const solicitudes = await dbService.obtenerSolicitudesAnulacion({
      desde: desde as string,
      hasta: hasta as string,
      estado: estado as string,
    });

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

    return res.json({ success: true, data: solicitudesTransformadas });
  } catch (error) {
    console.error("❌ Error al obtener solicitudes de anulación:", error);
    return sendError(res, 500, error);
  }
});

/* ==============================
   POST /api/servientrega/solicitudes-anulacion
============================== */
router.post("/solicitudes-anulacion", authenticateToken, async (req, res) => {
  try {
    const { guia_id, numero_guia, motivo_anulacion } = req.body;
    const usuario = (req as any).user;

    if (!guia_id || !numero_guia || !motivo_anulacion) {
      return res.status(400).json({
        success: false,
        error: "Parámetros inválidos",
        message: "guia_id, numero_guia y motivo_anulacion son requeridos",
      });
    }

    const solicitud = await dbService.crearSolicitudAnulacion({
      guia_id,
      numero_guia,
      motivo_anulacion,
      solicitado_por: usuario?.id || "SYSTEM",
      solicitado_por_nombre: usuario?.nombre || "Sistema",
    });

    return res.json({
      success: true,
      message: "Solicitud de anulación creada exitosamente",
      data: solicitud,
    });
  } catch (error) {
    console.error("❌ Error al crear solicitud de anulación:", error);
    return sendError(res, 500, error);
  }
});

/* ==============================
   PUT /api/servientrega/solicitudes-anulacion/:id/responder
============================== */
router.put(
  "/solicitudes-anulacion/:id/responder",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { accion, observaciones } = req.body; // "APROBAR" | "RECHAZAR"
      const usuario = (req as any).user;

      if (!validarAccion(accion)) {
        return res.status(400).json({
          success: false,
          error: "Parámetros inválidos",
          message: 'La acción debe ser "APROBAR" o "RECHAZAR".',
        });
      }

      const estado =
        String(accion).toUpperCase() === "APROBAR" ? "APROBADA" : "RECHAZADA";

      const solicitudActualizada = await dbService.actualizarSolicitudAnulacion(
        id,
        {
          estado,
          respondido_por: usuario?.id || "SYSTEM",
          respondido_por_nombre: usuario?.nombre || "Sistema",
          observaciones_respuesta: observaciones || "",
          fecha_respuesta: new Date(),
        }
      );

      if (estado === "APROBADA") {
        try {
          // 1. Obtener datos de la guía (costo_envio, punto_atencion_id)
          const guia = await prisma.servientregaGuia.findUnique({
            where: { numero_guia: solicitudActualizada.numero_guia },
            select: {
              id: true,
              costo_envio: true,
              punto_atencion_id: true,
            },
          });

          if (!guia) {
            throw new Error(
              `Guía no encontrada: ${solicitudActualizada.numero_guia}`
            );
          }

          if (!guia.punto_atencion_id) {
            throw new Error(
              `La guía no tiene punto_atencion_id asignado: ${solicitudActualizada.numero_guia}`
            );
          }

          // 2. Procesar anulación en Servientrega API
          await procesarAnulacionServientrega(solicitudActualizada.numero_guia);
          await dbService.anularGuia(solicitudActualizada.numero_guia);

          // 3. Revertir los balances (restar del Saldo USD general, sumar al ServientregaSaldo)
          if (guia.costo_envio && guia.costo_envio.toNumber() > 0) {
            console.log(
              "💰 Revirtiendo ingreso de servicio externo por anulación de guía..."
            );
            try {
              const resultadoReversal =
                await dbService.revertirIngresoServicioExterno(
                  guia.punto_atencion_id,
                  Number(guia.costo_envio),
                  solicitudActualizada.numero_guia
                );

              console.log(
                "✅ Ingreso de servicio externo revertido exitosamente:",
                {
                  numero_guia: solicitudActualizada.numero_guia,
                  monto: Number(guia.costo_envio),
                  saldoServicioAnterior:
                    resultadoReversal.saldoServicio.anterior,
                  saldoServicioNuevo: resultadoReversal.saldoServicio.nuevo,
                  saldoGeneralAnterior: resultadoReversal.saldoGeneral.anterior,
                  saldoGeneralNuevo: resultadoReversal.saldoGeneral.nuevo,
                }
              );
            } catch (reversalError) {
              console.error(
                "⚠️ Error al revertir ingreso de servicio externo:",
                reversalError
              );
              // Registrar el error pero no fallar completamente
              await dbService.actualizarSolicitudAnulacion(id, {
                observaciones_respuesta: `${
                  observaciones || ""
                }\n\n⚠️ Aviso: Anulación exitosa en Servientrega, pero hubo un error al revertir los movimientos de balance: ${
                  reversalError instanceof Error
                    ? reversalError.message
                    : String(reversalError)
                }`,
              });
            }
          }
        } catch (apiError) {
          await dbService.actualizarSolicitudAnulacion(id, {
            observaciones_respuesta: `${
              observaciones || ""
            }\n\nError en API Servientrega: ${
              apiError instanceof Error ? apiError.message : String(apiError)
            }`,
          });
        }
      }

      return res.json({
        success: true,
        message: `Solicitud ${estado.toLowerCase()} exitosamente`,
        data: solicitudActualizada,
      });
    } catch (error) {
      console.error(
        "❌ Error al responder solicitud de anulación (alias):",
        error
      );
      return sendError(res, 500, error);
    }
  }
);

export { router as anulacionesRouter };
