import express from "express";
import { authenticateToken, requireRole } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import { ServientregaAPIService } from "../../services/servientregaAPIService.js";
import prisma from "../../lib/prisma.js";

const router = express.Router();
const SERVIENTREGA_OPERATIONAL_ROLES = [
  "OPERADOR",
  "CONCESION",
  "ADMIN",
  "SUPER_USUARIO",
] as const;
const dbService = new ServientregaDBService();

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

type AuthedRequest = express.Request & {
  user?: {
    id?: string;
    nombre?: string;
  };
};

type HttpError = Error & { status?: number };

function httpError(status: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

/** Helpers */
function sendError(
  res: express.Response,
  status: number,
  err: unknown,
  fallback = "Error interno del servidor"
) {
  const message = err instanceof Error ? err.message : fallback;
  const finalStatus = (err as HttpError)?.status ?? status;
  return res
    .status(finalStatus)
    .json({ success: false, error: finalStatus < 500 ? message : fallback, message });
}

function validarAccion(accion?: string) {
  const val = String(accion || "")
    .toUpperCase()
    .trim();
  return val === "APROBAR" || val === "RECHAZAR";
}

function esAnulacionExitosa(resp: unknown): boolean {
  const procesoFetch =
    isRecord(resp) && isRecord(resp.fetch) ? resp.fetch.proceso : undefined;
  if (typeof procesoFetch === "string" && /actualizad/i.test(procesoFetch))
    return true;
  const procesoPlano = isRecord(resp) ? resp.proceso : undefined;
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
  const apiService = new ServientregaAPIService({ usuingreso, contrasenha });

  const payload = {
    tipo: "ActualizaEstadoGuia",
    guia: numeroGuia,
    estado: "Anulada",
    usuingreso,
    contrasenha,
  };

  const response = await apiService.callAPI(payload);

  if (!esAnulacionExitosa(response)) {
    throw new Error(
      `Respuesta inesperada de Servientrega: ${JSON.stringify(response)}`
    );
  }
  return response;
}

/**
 * Flujo ÚNICO para responder una solicitud de anulación (usado por PUT y POST alias).
 *
 * Protección contra duplicados:
 * 1. La solicitud se "reclama" atómicamente (PENDIENTE → PROCESANDO). Un segundo
 *    clic / request concurrente recibe 409 y no toca nada.
 * 2. anularGuiaConReversion() bloquea la fila de la guía y no revierte dos veces.
 */
async function responderSolicitud(
  solicitudId: string,
  accion: string,
  comentario: string | undefined,
  usuario: AuthedRequest["user"]
) {
  const aprobar = String(accion).toUpperCase() === "APROBAR";
  const respondido = {
    respondido_por: usuario?.id || "SYSTEM",
    respondido_por_nombre: usuario?.nombre || "Sistema",
  };

  const solicitud = await dbService.obtenerSolicitudAnulacion(solicitudId);
  if (!solicitud) throw httpError(404, "Solicitud no encontrada");

  // 🔒 Reclamar la solicitud (solo una request puede procesarla)
  const reclamada = await prisma.servientregaSolicitudAnulacion.updateMany({
    where: { id: solicitudId, estado: "PENDIENTE" },
    data: { estado: "PROCESANDO" },
  });
  if (reclamada.count === 0) {
    throw httpError(
      409,
      `La solicitud ya fue procesada (estado actual: ${solicitud.estado}).`
    );
  }

  /** Rechaza la solicitud y devuelve la guía a ACTIVA solo si sigue pendiente */
  const rechazar = async (motivo: string) => {
    await prisma.$transaction(async (tx) => {
      await tx.servientregaGuia.updateMany({
        where: { numero_guia: solicitud.numero_guia, estado: "PENDIENTE_ANULACION" },
        data: { estado: "ACTIVA", updated_at: new Date() },
      });
      await tx.servientregaSolicitudAnulacion.updateMany({
        where: { id: solicitudId, estado: "PROCESANDO" },
        data: {
          estado: "RECHAZADA",
          ...respondido,
          observaciones_respuesta: motivo,
          fecha_respuesta: new Date(),
        },
      });
    });
  };

  /** Devuelve la solicitud a PENDIENTE si algo falla antes de decidir */
  const liberar = () =>
    prisma.servientregaSolicitudAnulacion.updateMany({
      where: { id: solicitudId, estado: "PROCESANDO" },
      data: { estado: "PENDIENTE" },
    });

  try {
    const guia = await prisma.servientregaGuia.findUnique({
      where: { numero_guia: solicitud.numero_guia },
      select: { estado: true, punto_atencion_id: true, numero_guia: true },
    });
    if (!guia) {
      await liberar();
      throw httpError(404, `No se encontró la guía ${solicitud.numero_guia} en el sistema`);
    }

    if (!aprobar) {
      await rechazar(comentario || "Solicitud rechazada por el administrador");
      return { status: 200, body: { success: true, message: "Solicitud rechazada y guía restaurada a ACTIVA" } };
    }

    if (guia.estado === "ANULADA") {
      // Ya anulada (p. ej. anulación directa previa): cerrar solicitud sin mover dinero
      await prisma.servientregaSolicitudAnulacion.update({
        where: { id: solicitudId },
        data: {
          estado: "APROBADA",
          ...respondido,
          observaciones_respuesta: "La guía ya estaba anulada; no se revirtió saldo nuevamente.",
          fecha_respuesta: new Date(),
        },
      });
      return { status: 200, body: { success: true, message: "La guía ya estaba anulada. Solicitud cerrada." } };
    }

    if (!guia.punto_atencion_id) {
      await liberar();
      throw httpError(400, `La guía ${guia.numero_guia} no tiene punto de atención asignado`);
    }

    // 1. Anular primero en Servientrega — si rechaza, no se tocan saldos
    try {
      await procesarAnulacionServientrega(guia.numero_guia);
    } catch (apiError) {
      const detalle = apiError instanceof Error ? apiError.message : String(apiError);
      console.error("❌ Servientrega rechazó la anulación:", detalle);
      await rechazar(`Rechazada automáticamente — Servientrega no autorizó la anulación: ${detalle}`);
      return {
        status: 422,
        body: {
          success: false,
          error: "Servientrega rechazó la anulación",
          message: "La guía ha sido restaurada al estado ACTIVA. Servientrega no autorizó la anulación.",
          detalles: detalle,
        },
      };
    }

    // 2. 🔒 Transacción atómica: anular guía + revertir saldos + aprobar solicitud
    const resultado = await prisma.$transaction(
      async (tx) => {
        const r = await dbService.anularGuiaConReversion(guia.numero_guia, tx);
        await tx.servientregaSolicitudAnulacion.update({
          where: { id: solicitudId },
          data: {
            estado: "APROBADA",
            ...respondido,
            observaciones_respuesta: comentario || "",
            fecha_respuesta: new Date(),
          },
        });
        return r;
      },
      { maxWait: 10000, timeout: 20000 }
    );

    console.log("✅ Anulación procesada:", { numero_guia: guia.numero_guia, resultado });

    const solicitudActualizada = await dbService.obtenerSolicitudAnulacion(solicitudId);
    return {
      status: 200,
      body: {
        success: true,
        message: "Solicitud aprobada y guía anulada exitosamente en Servientrega",
        data: solicitudActualizada,
      },
    };
  } catch (error) {
    // Si quedó en PROCESANDO por un error inesperado, liberarla para reintento
    await liberar().catch(() => undefined);
    throw error;
  }
}

/* ==============================
   GET /api/servientrega/solicitudes-anulacion
============================== */
router.get("/solicitudes-anulacion", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
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

/** Crea una solicitud (compartido por POST /solicitudes-anulacion y alias) */
async function crearSolicitud(
  req: express.Request,
  res: express.Response,
  motivo: string | undefined
) {
  const { guia_id, numero_guia } = req.body;
  const usuario = (req as AuthedRequest).user;

  if (!guia_id || !numero_guia || !motivo) {
    return res.status(400).json({
      success: false,
      error: "Parámetros inválidos",
      message: "guia_id, numero_guia y motivo son requeridos",
    });
  }

  const solicitud = await dbService.crearSolicitudAnulacion({
    guia_id,
    numero_guia,
    motivo_anulacion: motivo,
    solicitado_por: usuario?.id || "SYSTEM",
    solicitado_por_nombre: usuario?.nombre || "Sistema",
  });

  return res.json({
    success: true,
    message: "Solicitud de anulación creada exitosamente",
    data: solicitud,
  });
}

/* ==============================
   POST /api/servientrega/solicitudes-anulacion
============================== */
router.post("/solicitudes-anulacion", authenticateToken, requireRole([...SERVIENTREGA_OPERATIONAL_ROLES]), async (req, res) => {
  try {
    return await crearSolicitud(req, res, req.body?.motivo_anulacion);
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
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { accion, observaciones } = req.body;
      if (!validarAccion(accion)) {
        return res.status(400).json({
          success: false,
          error: "Parámetros inválidos",
          message: 'La acción debe ser "APROBAR" o "RECHAZAR".',
        });
      }
      const r = await responderSolicitud(req.params.id, accion, observaciones, (req as AuthedRequest).user);
      return res.status(r.status).json(r.body);
    } catch (error) {
      console.error("❌ Error al responder solicitud:", error);
      return sendError(res, 500, error);
    }
  }
);

/* ==============================
   POST /api/servientrega/solicitar-anulacion (alias)
============================== */
router.post("/solicitar-anulacion", authenticateToken, requireRole([...SERVIENTREGA_OPERATIONAL_ROLES]), async (req, res) => {
  try {
    return await crearSolicitud(req, res, req.body?.motivo);
  } catch (error) {
    console.error("❌ Error al crear solicitud de anulación (alias):", error);
    return sendError(res, 500, error);
  }
});

/* ==============================
   POST /api/servientrega/responder-solicitud-anulacion (alias)
============================== */
router.post(
  "/responder-solicitud-anulacion",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { solicitud_id, accion, comentario } = req.body;
      if (!solicitud_id || !validarAccion(accion)) {
        return res.status(400).json({
          success: false,
          error: "Parámetros inválidos",
          message:
            'solicitud_id es requerido y la acción debe ser "APROBAR" o "RECHAZAR".',
        });
      }
      const r = await responderSolicitud(solicitud_id, accion, comentario, (req as AuthedRequest).user);
      return res.status(r.status).json(r.body);
    } catch (error) {
      console.error("❌ Error al responder solicitud de anulación (alias):", error);
      return sendError(res, 500, error);
    }
  }
);

export { router as anulacionesRouter };
