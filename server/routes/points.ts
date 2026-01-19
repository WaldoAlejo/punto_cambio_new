import express from "express";
import { PrismaClient, type PuntoAtencion } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import prisma from "../lib/prisma.js";

const router = express.Router();

/** Campos extra de agencia que quieres exponer sin “augmentar” Prisma globalmente */
type PuntoAtencionExtra = {
  servientrega_agencia_codigo?: string | null;
  servientrega_agencia_nombre?: string | null;
};

type PuntoAtencionOut = {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string | null;
  telefono: string | null;
  servientrega_agencia_codigo?: string | null;
  servientrega_agencia_nombre?: string | null;
  activo: boolean;
  es_principal: boolean;
  created_at: string;
  updated_at: string;
};

function formatPoint(
  punto: PuntoAtencion & PuntoAtencionExtra
): PuntoAtencionOut {
  return {
    id: punto.id,
    nombre: punto.nombre,
    direccion: punto.direccion,
    ciudad: punto.ciudad,
    provincia: punto.provincia,
    codigo_postal: punto.codigo_postal,
    telefono: punto.telefono,
    servientrega_agencia_codigo:
      (punto as PuntoAtencionExtra).servientrega_agencia_codigo ?? null,
    servientrega_agencia_nombre:
      (punto as PuntoAtencionExtra).servientrega_agencia_nombre ?? null,
    activo: punto.activo,
    es_principal: punto.es_principal,
    created_at: punto.created_at.toISOString(),
    updated_at: punto.updated_at.toISOString(),
  };
}

/**
 * GET /points
 * - ADMINISTRATIVO / ADMIN / SUPER_USUARIO -> TODOS los puntos activos (incluido principal), aunque estén “ocupados”.
 * - OPERADOR / CONCESION -> Solo puntos LIBRES hoy (sin jornada ACTIVO/ALMUERZO) y excluye el principal para OPERADOR.
 */
router.get(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const rol: string | undefined = user?.rol;
      const esPrivilegiado =
        rol === "ADMINISTRATIVO" || rol === "ADMIN" || rol === "SUPER_USUARIO";

      const { gte: hoy, lt: manana } = gyeDayRangeUtcFromDate(new Date());

      res.set({
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      });

      let puntos: PuntoAtencion[] = [];

      if (esPrivilegiado) {
        // ✅ Ver TODOS los puntos activos (incluye principal), sin filtrar por jornadas activas
        puntos = await prisma.puntoAtencion.findMany({
          where: { activo: true },
          orderBy: [{ es_principal: "desc" }, { nombre: "asc" }],
        });
      } else {
        // 🔒 Roles no privilegiados: listar SOLO puntos libres hoy (sin jornada ACTIVO/ALMUERZO)
        const whereClause: any = {
          activo: true,
          NOT: {
            jornadas: {
              some: {
                estado: { in: ["ACTIVO", "ALMUERZO"] },
                fecha_inicio: { gte: hoy, lt: manana },
                // Solo considerar ocupados si la jornada pertenece a roles que bloquean el punto
                usuario: {
                  rol: { in: ["OPERADOR", "CONCESION"] },
                },
              },
            },
          },
        };

        // Excluir principal para OPERADOR (mantiene tu regla existente)
        if (rol === "OPERADOR") {
          whereClause.es_principal = false;
        }

        puntos = await prisma.puntoAtencion.findMany({
          where: whereClause,
          orderBy: [{ es_principal: "desc" }, { nombre: "asc" }],
        });
      }

      const formatted: PuntoAtencionOut[] = puntos.map((p) =>
        formatPoint(p as PuntoAtencion & PuntoAtencionExtra)
      );

      logger.info("GET /points", {
        count: formatted.length,
        requestedBy: user?.id,
        userRole: rol,
        mode: esPrivilegiado ? "ALL_ACTIVE" : "FREE_ONLY",
      });

      res.status(200).json({
        success: true,
        points: formatted,
        count: formatted.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en GET /points", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Error al obtener puntos",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Obtener TODOS los puntos (ruta auxiliar) */
router.get(
  "/all",
  authenticateToken,
  requireRole(["ADMINISTRATIVO", "ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const todosPuntos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: [{ es_principal: "desc" }, { nombre: "asc" }],
      });

      const formatted: PuntoAtencionOut[] = todosPuntos.map((p) =>
        formatPoint(p as PuntoAtencion & PuntoAtencionExtra)
      );

      logger.info("GET /points/all", {
        count: formatted.length,
        requestedBy: (req as any).user?.id,
        userRole: (req as any).user?.rol,
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener todos los puntos", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });

      res.status(500).json({
        error: "Error al obtener todos los puntos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Crear punto (solo admins/superusuario) */
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const {
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        telefono,
        servientrega_agencia_codigo,
        servientrega_agencia_nombre,
        servientrega_alianza,
        servientrega_oficina_alianza,
      } = req.body;

      if (!nombre || !direccion || !ciudad) {
        res.status(400).json({
          error: "Los campos nombre, dirección y ciudad son obligatorios",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const createData: any = {
        nombre,
        direccion,
        ciudad,
        provincia: provincia || "",
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        // Solo setear si vienen en el body (evita undefined)
        ...(servientrega_agencia_codigo !== undefined && {
          servientrega_agencia_codigo: servientrega_agencia_codigo || null,
        }),
        ...(servientrega_agencia_nombre !== undefined && {
          servientrega_agencia_nombre: servientrega_agencia_nombre || null,
        }),
        ...(servientrega_alianza !== undefined && {
          servientrega_alianza: servientrega_alianza || null,
        }),
        ...(servientrega_oficina_alianza !== undefined && {
          servientrega_oficina_alianza: servientrega_oficina_alianza || null,
        }),
        activo: true,
      };

      const newPoint = await prisma.puntoAtencion.create({ data: createData });

      logger.info("Punto creado", {
        pointId: newPoint.id,
        nombre: newPoint.nombre,
        createdBy: (req as any).user?.id,
      });

      res.status(201).json({
        point: formatPoint(newPoint as PuntoAtencion & PuntoAtencionExtra),
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });
      res.status(500).json({
        error: "Error al crear punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Actualizar un punto de atención (solo admins/superusuarios) */
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const pointId = req.params.id;
      const {
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        telefono,
        activo,
        servientrega_agencia_codigo,
        servientrega_agencia_nombre,
        servientrega_alianza,
        servientrega_oficina_alianza,
      } = req.body;

      const existingPoint = await prisma.puntoAtencion.findUnique({
        where: { id: pointId },
      });

      if (!existingPoint) {
        res.status(404).json({
          error: "Punto de atención no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!nombre || !direccion || !ciudad) {
        res.status(400).json({
          error: "Los campos nombre, dirección y ciudad son obligatorios",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updateData: any = {
        nombre,
        direccion,
        ciudad,
        provincia: provincia || "",
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        ...(servientrega_agencia_codigo !== undefined && {
          servientrega_agencia_codigo: servientrega_agencia_codigo || null,
        }),
        ...(servientrega_agencia_nombre !== undefined && {
          servientrega_agencia_nombre: servientrega_agencia_nombre || null,
        }),
        ...(servientrega_alianza !== undefined && {
          servientrega_alianza: servientrega_alianza || null,
        }),
        ...(servientrega_oficina_alianza !== undefined && {
          servientrega_oficina_alianza: servientrega_oficina_alianza || null,
        }),
        activo: typeof activo === "boolean" ? activo : existingPoint.activo,
      };

      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: updateData,
      });

      logger.info("Punto de atención actualizado", {
        pointId: updatedPoint.id,
        updatedBy: (req as any).user?.id,
      });

      res.status(200).json({
        point: formatPoint(updatedPoint as PuntoAtencion & PuntoAtencionExtra),
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al actualizar punto de atención", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });
      res.status(500).json({
        error: "Error al actualizar el punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Eliminar un punto de atención (solo admins/superusuarios) */
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const pointId = req.params.id;

      const existingPoint = await prisma.puntoAtencion.findUnique({
        where: { id: pointId },
      });

      if (!existingPoint) {
        res.status(404).json({
          error: "Punto de atención no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.puntoAtencion.delete({ where: { id: pointId } });

      logger.info("Punto de atención eliminado", {
        pointId,
        deletedBy: (req as any).user?.id,
      });

      res.status(200).json({
        message: "Punto de atención eliminado correctamente",
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al eliminar punto de atención", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });
      res.status(500).json({
        error: "Error al eliminar el punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Cambiar el estado de un punto (activar/inactivar) */
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const pointId = req.params.id;
      const existingPoint = await prisma.puntoAtencion.findUnique({
        where: { id: pointId },
      });

      if (!existingPoint) {
        res.status(404).json({
          error: "Punto de atención no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: { activo: !existingPoint.activo },
      });

      logger.info("Estado de punto cambiado", {
        pointId: updatedPoint.id,
        newStatus: updatedPoint.activo,
        requestedBy: (req as any).user?.id,
      });

      res.status(200).json({
        point: formatPoint(updatedPoint as PuntoAtencion & PuntoAtencionExtra),
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cambiar el estado del punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });
      res.status(500).json({
        error: "Error al cambiar el estado del punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Puntos activos para transferencias (sin filtrar por jornadas) */
router.get(
  "/active-for-transfers",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const puntosActivos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: [{ es_principal: "desc" }, { nombre: "asc" }],
      });

      const formatted: PuntoAtencionOut[] = puntosActivos.map((p) =>
        formatPoint(p as PuntoAtencion & PuntoAtencionExtra)
      );

      logger.info("Puntos activos para transferencias obtenidos", {
        count: formatted.length,
        requestedBy: (req as any).user?.id,
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos activos", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos activos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/** Puntos para gestión de saldos (todos los puntos activos) */
router.get(
  "/for-balance-management",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const puntosParaSaldos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: [{ es_principal: "desc" }, { nombre: "asc" }],
      });

      const formatted: PuntoAtencionOut[] = puntosParaSaldos.map((p) =>
        formatPoint(p as PuntoAtencion & PuntoAtencionExtra)
      );

      logger.info("Puntos para gestión de saldos obtenidos", {
        count: formatted.length,
        requestedBy: (req as any).user?.id,
        userRole: (req as any).user?.rol,
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos para gestión de saldos", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: (req as any).user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos para gestión de saldos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
