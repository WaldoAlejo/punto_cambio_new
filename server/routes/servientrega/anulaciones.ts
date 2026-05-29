import express from "express";
import { authenticateToken, requireRole } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import { ServientregaAPIService } from "../../services/servientregaAPIService.js";
import prisma from "../../lib/prisma.js";
import { nowEcuador } from "../../utils/timezone.js";

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

/* ==============================
   POST /api/servientrega/solicitudes-anulacion
============================== */
router.post("/solicitudes-anulacion", authenticateToken, requireRole([...SERVIENTREGA_OPERATIONAL_ROLES]), async (req, res) => {
  try {
    const { guia_id, numero_guia, motivo_anulacion } = req.body;
    const usuario = (req as AuthedRequest).user;

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
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { accion, observaciones } = req.body; // "APROBAR" | "RECHAZAR"
      const usuario = (req as AuthedRequest).user;

      if (!validarAccion(accion)) {
        return res.status(400).json({
          success: false,
          error: "Parámetros inválidos",
          message: 'La acción debe ser "APROBAR" o "RECHAZAR".',
        });
      }

      const estado =
        String(accion).toUpperCase() === "APROBAR" ? "APROBADA" : "RECHAZADA";

      // 1. Obtener la solicitud y la guía en ambos casos
      const solicitudActual = await dbService.obtenerSolicitudAnulacion(id);
      if (!solicitudActual) {
        return res.status(404).json({ success: false, error: "Solicitud no encontrada" });
      }

      const guia = await prisma.servientregaGuia.findUnique({
        where: { numero_guia: solicitudActual.numero_guia },
        select: { id: true, costo_envio: true, punto_atencion_id: true, numero_guia: true },
      });

      if (!guia) {
        return res.status(404).json({
          success: false,
          error: "Guía no encontrada",
          message: `No se encontró la guía ${solicitudActual.numero_guia} en el sistema`,
        });
      }

      /** Revierte la guía a ACTIVA y marca la solicitud como RECHAZADA (atómico) */
      const rechazarConReversion = async (motivo: string) => {
        await prisma.$transaction(async (tx) => {
          await tx.servientregaGuia.updateMany({
            where: { numero_guia: guia.numero_guia },
            data: { estado: "ACTIVA", updated_at: new Date() },
          });
          await dbService.actualizarSolicitudAnulacion(id, {
            estado: "RECHAZADA",
            respondido_por: usuario?.id || "SYSTEM",
            respondido_por_nombre: usuario?.nombre || "Sistema",
            observaciones_respuesta: motivo,
            fecha_respuesta: new Date(),
          }, tx);
        });
      };

      if (estado === "RECHAZADA") {
        // Admin decidió rechazar: revertir guía a ACTIVA y marcar solicitud RECHAZADA
        await rechazarConReversion(observaciones || "Solicitud rechazada por el administrador");
        const solicitudActualizada = await dbService.obtenerSolicitudAnulacion(id);
        return res.json({ success: true, message: "Solicitud rechazada y guía restaurada a ACTIVA", data: solicitudActualizada });
      }

      // APROBAR: validar punto_atencion_id antes de llamar a la API
      if (!guia.punto_atencion_id) {
        return res.status(400).json({
          success: false,
          error: "Punto de atención no asignado",
          message: `La guía ${guia.numero_guia} no tiene punto de atención asignado`,
        });
      }

      // 2. ✅ PRIMERO llamar a Servientrega API — si rechaza, revertir todo sin tocar saldos
      console.log("🔄 Intentando anular guía en Servientrega API...", { numero_guia: guia.numero_guia, solicitud_id: id });

      try {
        await procesarAnulacionServientrega(guia.numero_guia);
      } catch (apiError) {
        console.error("❌ Servientrega rechazó la anulación:", apiError);
        const motivoRechazo = `Rechazada automáticamente — Servientrega no autorizó la anulación: ${apiError instanceof Error ? apiError.message : String(apiError)}`;
        await rechazarConReversion(motivoRechazo);
        return res.status(422).json({
          success: false,
          error: "Servientrega rechazó la anulación",
          message: "La guía ha sido restaurada al estado ACTIVA. Servientrega no autorizó la anulación.",
          detalles: apiError instanceof Error ? apiError.message : String(apiError),
        });
      }

      console.log("✅ Anulación exitosa en Servientrega API");

      // 3. Buscar desglose del movimiento original (fuera de la tx, lectura libre)
      let movimientoOriginal = null;
      if (guia.costo_envio && guia.costo_envio.toNumber() > 0) {
        movimientoOriginal = await prisma.servicioExternoMovimiento.findFirst({
          where: { numero_referencia: guia.numero_guia, servicio: "SERVIENTREGA", tipo_movimiento: "INGRESO" },
          orderBy: { fecha: "desc" },
        });
      }

      const billetes = movimientoOriginal?.billetes ? Number(movimientoOriginal.billetes) : 0;
      const monedas = movimientoOriginal?.monedas_fisicas ? Number(movimientoOriginal.monedas_fisicas) : 0;
      const bancos = movimientoOriginal?.bancos ? Number(movimientoOriginal.bancos) : 0;
      const puntoAtencionId = guia.punto_atencion_id!;

      // 4. 🔒 TRANSACCIÓN ATÓMICA: anular guía + revertir saldo + aprobar solicitud
      const { resultadoReversal, solicitudActualizada } = await prisma.$transaction(async (tx) => {
        await dbService.anularGuia(guia.numero_guia, tx);

        let resultadoReversal = null;
        if (guia.costo_envio && guia.costo_envio.toNumber() > 0) {
          resultadoReversal = await dbService.revertirIngresoServicioExterno(
            puntoAtencionId, Number(guia.costo_envio), guia.numero_guia, billetes, monedas, bancos, tx
          );
        }

        const solicitudActualizada = await dbService.actualizarSolicitudAnulacion(id, {
          estado: "APROBADA",
          respondido_por: usuario?.id || "SYSTEM",
          respondido_por_nombre: usuario?.nombre || "Sistema",
          observaciones_respuesta: observaciones || "",
          fecha_respuesta: new Date(),
        }, tx);

        return { resultadoReversal, solicitudActualizada };
      }, { maxWait: 10000, timeout: 15000 });

      if (resultadoReversal) {
        console.log("✅ Saldo revertido:", {
          numero_guia: guia.numero_guia,
          monto: Number(guia.costo_envio),
          saldoServicio: `${resultadoReversal.saldoServicio.anterior} → ${resultadoReversal.saldoServicio.nuevo}`,
          saldoGeneral: `${resultadoReversal.saldoGeneral.anterior} → ${resultadoReversal.saldoGeneral.nuevo}`,
        });
      }

      return res.json({
        success: true,
        message: "Solicitud aprobada y guía anulada exitosamente en Servientrega",
        data: solicitudActualizada,
      });
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
    const { guia_id, numero_guia, motivo } = req.body;
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
      const usuario = (req as AuthedRequest).user;

      if (!solicitud_id || !validarAccion(accion)) {
        return res.status(400).json({
          success: false,
          error: "Parámetros inválidos",
          message:
            'solicitud_id es requerido y la acción debe ser "APROBAR" o "RECHAZAR".',
        });
      }

      const estado =
        String(accion).toUpperCase() === "APROBAR" ? "APROBADA" : "RECHAZADA";

      // 1. Obtener la solicitud y la guía
      const solicitudActual = await dbService.obtenerSolicitudAnulacion(solicitud_id);
      if (!solicitudActual) {
        return res.status(404).json({ success: false, error: "Solicitud no encontrada" });
      }

      const guia = await prisma.servientregaGuia.findUnique({
        where: { numero_guia: solicitudActual.numero_guia },
        select: { id: true, costo_envio: true, punto_atencion_id: true, numero_guia: true },
      });

      if (!guia) {
        return res.status(404).json({
          success: false,
          error: "Guía no encontrada",
          message: `No se encontró la guía ${solicitudActual.numero_guia}`,
        });
      }

      /** Revierte la guía a ACTIVA y marca la solicitud como RECHAZADA (atómico) */
      const rechazarConReversion = async (motivo: string) => {
        await prisma.$transaction(async (tx) => {
          await tx.servientregaGuia.updateMany({
            where: { numero_guia: guia.numero_guia },
            data: { estado: "ACTIVA", updated_at: new Date() },
          });
          await dbService.actualizarSolicitudAnulacion(solicitud_id, {
            estado: "RECHAZADA",
            respondido_por: usuario?.id || "SYSTEM",
            respondido_por_nombre: usuario?.nombre || "Sistema",
            observaciones_respuesta: motivo,
            fecha_respuesta: new Date(),
          }, tx);
        });
      };

      if (estado === "RECHAZADA") {
        await rechazarConReversion(comentario || "Solicitud rechazada por el administrador");
        const solicitudActualizada = await dbService.obtenerSolicitudAnulacion(solicitud_id);
        return res.json({ success: true, message: "Solicitud rechazada y guía restaurada a ACTIVA", data: solicitudActualizada });
      }

      // APROBAR: validar punto_atencion_id
      if (!guia.punto_atencion_id) {
        return res.status(400).json({
          success: false,
          error: "Punto de atención no asignado",
          message: `La guía ${guia.numero_guia} no tiene punto de atención asignado`,
        });
      }

      // 2. ✅ PRIMERO llamar a Servientrega API
      console.log("🔄 Intentando anular guía en Servientrega API...", { numero_guia: guia.numero_guia });

      try {
        await procesarAnulacionServientrega(guia.numero_guia);
      } catch (apiError) {
        console.error("❌ Servientrega rechazó la anulación:", apiError);
        const motivo = `Rechazada automáticamente — Servientrega no autorizó la anulación: ${apiError instanceof Error ? apiError.message : String(apiError)}`;
        await rechazarConReversion(motivo);
        return res.status(422).json({
          success: false,
          error: "Servientrega rechazó la anulación",
          message: "La guía ha sido restaurada al estado ACTIVA. Servientrega no autorizó la anulación.",
          detalles: apiError instanceof Error ? apiError.message : String(apiError),
        });
      }

      console.log("✅ Anulación exitosa en Servientrega API");

      // 3. Buscar desglose original (lectura libre antes de la tx)
      let movimientoOriginal = null;
      if (guia.costo_envio && guia.costo_envio.toNumber() > 0) {
        movimientoOriginal = await prisma.servicioExternoMovimiento.findFirst({
          where: { numero_referencia: guia.numero_guia, servicio: "SERVIENTREGA", tipo_movimiento: "INGRESO" },
          orderBy: { fecha: "desc" },
          select: { billetes: true, monedas_fisicas: true, bancos: true },
        });
      }

      const billetes = movimientoOriginal?.billetes ? Number(movimientoOriginal.billetes) : 0;
      const monedas = movimientoOriginal?.monedas_fisicas ? Number(movimientoOriginal.monedas_fisicas) : 0;
      const bancos = movimientoOriginal?.bancos ? Number(movimientoOriginal.bancos) : 0;
      const puntoAtencionId = guia.punto_atencion_id!;

      // 4. 🔒 TRANSACCIÓN ATÓMICA: anular guía + revertir saldo + aprobar solicitud
      const { resultadoReversal, solicitudActualizada } = await prisma.$transaction(async (tx) => {
        await dbService.anularGuia(guia.numero_guia, tx);

        let resultadoReversal = null;
        if (guia.costo_envio && guia.costo_envio.toNumber() > 0) {
          resultadoReversal = await dbService.revertirIngresoServicioExterno(
            puntoAtencionId, Number(guia.costo_envio), guia.numero_guia, billetes, monedas, bancos, tx
          );
        }

        const solicitudActualizada = await dbService.actualizarSolicitudAnulacion(solicitud_id, {
          estado: "APROBADA",
          respondido_por: usuario?.id || "SYSTEM",
          respondido_por_nombre: usuario?.nombre || "Sistema",
          observaciones_respuesta: comentario || "",
          fecha_respuesta: new Date(),
        }, tx);

        return { resultadoReversal, solicitudActualizada };
      }, { maxWait: 10000, timeout: 15000 });

      if (resultadoReversal) {
        console.log("✅ Saldo revertido:", {
          numero_guia: guia.numero_guia,
          monto: Number(guia.costo_envio),
          saldoServicio: `${resultadoReversal.saldoServicio.anterior} → ${resultadoReversal.saldoServicio.nuevo}`,
          saldoGeneral: `${resultadoReversal.saldoGeneral.anterior} → ${resultadoReversal.saldoGeneral.nuevo}`,
        });
      }

      return res.json({
        success: true,
        message: "Solicitud aprobada y guía anulada exitosamente en Servientrega",
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
