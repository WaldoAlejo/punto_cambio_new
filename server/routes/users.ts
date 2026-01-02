import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  createUserSchema,
  type CreateUserRequest,
} from "../schemas/validation.js";

const router = express.Router();

// Obtener todos los usuarios (solo admins)
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const users = await prisma.usuario.findMany({
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: "desc" },
      });

      logger.info("Usuarios obtenidos", {
        count: users.length,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        users,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener usuarios", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al obtener usuarios",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Crear usuario (solo admins)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  validate(createUserSchema),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userData = req.body as CreateUserRequest;

      const existingUser = await prisma.usuario.findFirst({
        where: {
          username: {
            equals: userData.username,
            mode: "insensitive",
          },
        },
      });

      if (existingUser) {
        res.status(400).json({
          error: "El nombre de usuario ya existe",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const createData = {
        username: userData.username,
        password: hashedPassword,
        nombre: userData.nombre,
        correo: userData.correo || null,
        telefono: userData.telefono || null,
        rol: userData.rol,
        punto_atencion_id: userData.punto_atencion_id || null,
        activo: true,
      };

      const newUser = await prisma.usuario.create({
        data: createData,
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      logger.info("Usuario creado", {
        userId: newUser.id,
        username: newUser.username,
        createdBy: req.user?.id,
      });

      res.status(201).json({
        user: newUser,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al crear usuario", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al crear usuario",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Editar usuario (solo admins)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.params.id;
      const { nombre, correo, telefono, rol, punto_atencion_id } = req.body;

      const existingUser = await prisma.usuario.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        res.status(404).json({
          error: "Usuario no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updateData: Record<string, unknown> = {};
      if (nombre) updateData.nombre = nombre;
      if (correo !== undefined) updateData.correo = correo || null;
      if (telefono !== undefined) updateData.telefono = telefono || null;
      if (rol) updateData.rol = rol;
      if (punto_atencion_id !== undefined)
        updateData.punto_atencion_id = punto_atencion_id || null;

      const updatedUser = await prisma.usuario.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      logger.info("Usuario actualizado", {
        userId: updatedUser.id,
        updatedBy: req.user?.id,
      });

      res.status(200).json({
        user: updatedUser,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al actualizar usuario", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al actualizar usuario",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Resetear contraseña de usuario (solo admins)
router.patch(
  "/:id/reset-password",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.params.id;
      const { password } = req.body;

      if (!password) {
        res.status(400).json({
          error: "La nueva contraseña es requerida",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existingUser = await prisma.usuario.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        res.status(404).json({
          error: "Usuario no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.usuario.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info("Contraseña reseteada", {
        userId: userId,
        resetBy: req.user?.id,
      });

      res.status(200).json({
        message: "Contraseña reseteada exitosamente",
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al resetear contraseña", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al resetear contraseña",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Cambiar el estado de un usuario (solo admins)
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.params.id;

      const existingUser = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { activo: true, id: true, username: true },
      });

      if (!existingUser) {
        res.status(404).json({
          error: "Usuario no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updatedUser = await prisma.usuario.update({
        where: { id: userId },
        data: { activo: !existingUser.activo },
        select: {
          id: true,
          username: true,
          nombre: true,
          correo: true,
          telefono: true,
          rol: true,
          activo: true,
          punto_atencion_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      logger.info("Estado de usuario cambiado", {
        userId: updatedUser.id,
        newStatus: updatedUser.activo,
        requestedBy: req.user?.id,
      });

      res.status(200).json({
        user: updatedUser,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al cambiar el estado del usuario", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      res.status(500).json({
        error: "Error al cambiar el estado del usuario",
        success: false,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
