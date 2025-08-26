import express from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import "../types/prisma-extensions.js";

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todos los puntos LIBRES (activos y sin jornada ACTIVO o ALMUERZO hoy)
router.get(
  "/",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      // Construir filtros según el rol del usuario
      const whereClause: any = {
        activo: true,
        NOT: {
          jornadas: {
            some: {
              estado: { in: ["ACTIVO", "ALMUERZO"] },
              fecha_inicio: { gte: hoy, lt: manana },
            },
          },
        },
      };

      // Si es OPERADOR, excluir el punto principal
      if (req.user?.rol === "OPERADOR") {
        whereClause.es_principal = false;
      }

      console.log(
        "🔍 Points API: Consultando puntos con filtros:",
        whereClause
      );
      console.log("👤 Points API: Usuario solicitante:", {
        id: req.user?.id,
        rol: req.user?.rol,
      });
      console.log("📅 Points API: Rango de fechas:", {
        hoy: hoy.toISOString(),
        manana: manana.toISOString(),
      });

      // Primero obtener estadísticas generales
      const totalPuntos = await prisma.puntoAtencion.count();
      const puntosActivos = await prisma.puntoAtencion.count({
        where: { activo: true },
      });

      console.log(
        `📊 Points API: Estadísticas - Total: ${totalPuntos}, Activos: ${puntosActivos}`
      );

      // Obtener puntos con jornadas para diagnóstico
      const puntosConJornadas = await prisma.puntoAtencion.findMany({
        where: {
          activo: true,
          jornadas: {
            some: {
              estado: { in: ["ACTIVO", "ALMUERZO"] },
              fecha_inicio: { gte: hoy, lt: manana },
            },
          },
        },
        include: {
          jornadas: {
            where: {
              estado: { in: ["ACTIVO", "ALMUERZO"] },
              fecha_inicio: { gte: hoy, lt: manana },
            },
          },
        },
      });

      console.log(
        `🚫 Points API: Puntos con jornadas activas hoy: ${puntosConJornadas.length}`
      );
      puntosConJornadas.forEach((punto, index) => {
        console.log(
          `  ${index + 1}. ${punto.nombre} - Jornadas: ${punto.jornadas.length}`
        );
        punto.jornadas.forEach((jornada, jIndex) => {
          console.log(
            `    ${jIndex + 1}. Estado: ${jornada.estado}, Inicio: ${
              jornada.fecha_inicio
            }`
          );
        });
      });

      const puntosLibres = await prisma.puntoAtencion.findMany({
        where: whereClause,
        orderBy: { nombre: "asc" },
      });

      console.log(
        `📍 Points API: Puntos libres encontrados: ${puntosLibres.length}`
      );
      puntosLibres.forEach((punto, index) => {
        console.log(
          `  ${index + 1}. ${punto.nombre} - ${punto.ciudad}, ${
            punto.provincia
          } (ID: ${punto.id})`
        );
      });

      const formatted = puntosLibres.map((punto) => ({
        id: punto.id,
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
        codigo_postal: punto.codigo_postal,
        telefono: punto.telefono,
        servientrega_agencia_codigo: (punto as any).servientrega_agencia_codigo,
        servientrega_agencia_nombre: (punto as any).servientrega_agencia_nombre,
        activo: punto.activo,
        es_principal: punto.es_principal,
        created_at: punto.created_at.toISOString(),
        updated_at: punto.updated_at.toISOString(),
      }));

      console.log(
        `✅ Puntos formateados para enviar: ${formatted.length}`,
        formatted.map((p) => ({ id: p.id, nombre: p.nombre }))
      );

      logger.info("Puntos libres obtenidos", {
        count: formatted.length,
        requestedBy: req.user?.id,
        userRole: req.user?.rol,
        filteredForOperator: req.user?.rol === "OPERADOR",
        whereClause: JSON.stringify(whereClause),
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos libres", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos libres",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Obtener TODOS los puntos (para admins)
router.get(
  "/all",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const todosPuntos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
      });

      const formatted = todosPuntos.map((punto) => ({
        id: punto.id,
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
        codigo_postal: punto.codigo_postal,
        telefono: punto.telefono,
        servientrega_agencia_codigo: punto.servientrega_agencia_codigo,
        servientrega_agencia_nombre: punto.servientrega_agencia_nombre,
        activo: punto.activo,
        es_principal: punto.es_principal,
        created_at: punto.created_at.toISOString(),
        updated_at: punto.updated_at.toISOString(),
      }));

      logger.info("Todos los puntos obtenidos", {
        count: formatted.length,
        requestedBy: req.user?.id,
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
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Crear punto (solo admins/superusuario)
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
      } = req.body;
      if (!nombre || !direccion || !ciudad) {
        res.status(400).json({
          error: "Los campos nombre, dirección y ciudad son obligatorios",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const createData = {
        nombre,
        direccion,
        ciudad,
        provincia: provincia || "",
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        servientrega_agencia_codigo: servientrega_agencia_codigo || null,
        servientrega_agencia_nombre: servientrega_agencia_nombre || null,
        activo: true,
      };

      const newPoint = await prisma.puntoAtencion.create({
        data: createData,
      });

      logger.info("Punto creado", {
        pointId: newPoint.id,
        nombre: newPoint.nombre,
        createdBy: req.user?.id,
      });

      res.status(201).json({
        point: newPoint,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({
        error: "Error al crear punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Actualizar un punto de atención (solo admins/superusuarios)
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

      const updatedPoint = await prisma.puntoAtencion.update({
        where: { id: pointId },
        data: {
          nombre,
          direccion,
          ciudad,
          provincia: provincia || "",
          codigo_postal: codigo_postal || null,
          telefono: telefono || null,
          servientrega_agencia_codigo: servientrega_agencia_codigo || null,
          servientrega_agencia_nombre: servientrega_agencia_nombre || null,
          activo: activo !== undefined ? activo : existingPoint.activo,
        },
      });

      logger.info("Punto de atención actualizado", {
        pointId: updatedPoint.id,
        updatedBy: req.user?.id,
      });

      res.status(200).json({
        point: updatedPoint,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al actualizar punto de atención", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({
        error: "Error al actualizar el punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Eliminar un punto de atención (solo admins/superusuarios)
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

      await prisma.puntoAtencion.delete({
        where: { id: pointId },
      });

      logger.info("Punto de atención eliminado", {
        pointId,
        deletedBy: req.user?.id,
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
        requestedBy: req.user?.id,
      });
      res.status(500).json({
        error: "Error al eliminar el punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Cambiar el estado de un punto (activar/inactivar)
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
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        point: updatedPoint,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cambiar el estado del punto", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });
      res.status(500).json({
        error: "Error al cambiar el estado del punto de atención",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Obtener TODOS los puntos (para administradores)
router.get(
  "/all",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const todosPuntos = await prisma.puntoAtencion.findMany({
        orderBy: { nombre: "asc" },
      });

      const formatted = todosPuntos.map((punto) => ({
        id: punto.id,
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
        codigo_postal: punto.codigo_postal,
        telefono: punto.telefono,
        servientrega_agencia_codigo: punto.servientrega_agencia_codigo,
        servientrega_agencia_nombre: punto.servientrega_agencia_nombre,
        activo: punto.activo,
        es_principal: punto.es_principal,
        created_at: punto.created_at.toISOString(),
        updated_at: punto.updated_at.toISOString(),
      }));

      logger.info("Todos los puntos obtenidos", {
        count: formatted.length,
        requestedBy: req.user?.id,
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
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener todos los puntos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Obtener puntos activos para transferencias (no importa si tienen jornadas)
router.get(
  "/active-for-transfers",
  authenticateToken,
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const puntosActivos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
      });

      const formatted = puntosActivos.map((punto) => ({
        id: punto.id,
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
        codigo_postal: punto.codigo_postal,
        telefono: punto.telefono,
        activo: punto.activo,
        es_principal: punto.es_principal,
        created_at: punto.created_at.toISOString(),
        updated_at: punto.updated_at.toISOString(),
      }));

      logger.info("Puntos activos para transferencias obtenidos", {
        count: formatted.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener puntos activos para transferencias", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener puntos activos",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Obtener puntos activos para gestión de saldos (sin filtrar por jornadas)
router.get(
  "/for-balance-management",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      console.log(
        "🔍 Points API (Balance Management): Iniciando consulta de puntos para gestión de saldos..."
      );
      console.log("👤 Points API (Balance Management): Usuario solicitante:", {
        id: req.user?.id,
        rol: req.user?.rol,
      });

      // Estadísticas generales
      const totalPuntos = await prisma.puntoAtencion.count();
      const puntosActivos = await prisma.puntoAtencion.count({
        where: { activo: true },
      });

      console.log(
        `📊 Points API (Balance Management): Estadísticas - Total: ${totalPuntos}, Activos: ${puntosActivos}`
      );

      const puntosParaSaldos = await prisma.puntoAtencion.findMany({
        where: { activo: true },
        orderBy: { nombre: "asc" },
      });

      console.log(
        `📍 Points API (Balance Management): Puntos activos encontrados: ${puntosParaSaldos.length}`
      );
      puntosParaSaldos.forEach((punto, index) => {
        console.log(
          `  ${index + 1}. ${punto.nombre} - ${punto.ciudad}, ${
            punto.provincia
          } (ID: ${punto.id})`
        );
      });

      const formatted = puntosParaSaldos.map((punto) => ({
        id: punto.id,
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
        codigo_postal: punto.codigo_postal,
        telefono: punto.telefono,
        activo: punto.activo,
        es_principal: punto.es_principal,
        created_at: punto.created_at.toISOString(),
        updated_at: punto.updated_at.toISOString(),
      }));

      console.log(
        `✅ Points API (Balance Management): Enviando ${formatted.length} puntos para gestión de saldos`
      );

      logger.info("Puntos para gestión de saldos obtenidos", {
        count: formatted.length,
        requestedBy: req.user?.id,
        userRole: req.user?.rol,
      });

      res.status(200).json({
        points: formatted,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Points API (Balance Management): Error al obtener puntos para gestión de saldos:",
        error
      );

      logger.error("Error al obtener puntos para gestión de saldos", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
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
