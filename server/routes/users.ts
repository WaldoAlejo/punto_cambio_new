import express from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  createUserSchema,
  type CreateUserRequest,
} from "../schemas/validation.js";

const router = express.Router();
const prisma = new PrismaClient();

// Obtener todos los usuarios (solo admins)
router.get(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== USERS ROUTE - GET / START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);

    try {
      console.warn("Querying database for users...");
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
      console.warn("Database query result - users count:", users.length);
      console.warn("Users data:", users);

      logger.info("Usuarios obtenidos", {
        count: users.length,
        requestedBy: req.user?.id,
      });

      const responseData = {
        users,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== USERS ROUTE GET ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al obtener usuarios", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al obtener usuarios",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== USERS ROUTE - GET / END ===");
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
    console.warn("=== USERS ROUTE - POST / START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);
    console.warn("Request body received:", {
      ...req.body,
      password: "[HIDDEN]",
    });

    try {
      const userData = req.body as CreateUserRequest;
      console.warn("Extracted user data:", {
        ...userData,
        password: "[HIDDEN]",
      });

      console.warn("Checking if username already exists...");
      const existingUser = await prisma.usuario.findFirst({
        where: {
          username: {
            equals: userData.username,
            mode: "insensitive",
          },
        },
      });

      if (existingUser) {
        console.warn("Username already exists:", userData.username);
        const conflictResponse = {
          error: "El nombre de usuario ya existe",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending conflict response:", conflictResponse);
        res.status(400).json(conflictResponse);
        return;
      }

      console.warn("Hashing password...");
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      console.warn("Password hashed successfully");

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
      console.warn("Data to create user:", {
        ...createData,
        password: "[HIDDEN]",
      });

      console.warn("Creating user in database...");
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
      console.warn("User created successfully:", newUser);

      logger.info("Usuario creado", {
        userId: newUser.id,
        username: newUser.username,
        createdBy: req.user?.id,
      });

      const responseData = {
        user: newUser,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(201).json(responseData);
    } catch (error) {
      console.error("=== USERS ROUTE POST ERROR ===");
      console.error("Error details:", error);
      console.error(
        "Error message:",
        error instanceof Error ? error.message : "Unknown error"
      );
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack"
      );

      logger.error("Error al crear usuario", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al crear usuario",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== USERS ROUTE - POST / END ===");
    }
  }
);

// Editar usuario (solo admins)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== USERS ROUTE - PUT /:id START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);
    console.warn("User ID to edit:", req.params.id);
    console.warn("Update data received:", req.body);

    try {
      const userId = req.params.id;
      const { nombre, correo, telefono, rol, punto_atencion_id } = req.body;

      console.warn("Checking if user exists...");
      const existingUser = await prisma.usuario.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        console.warn("User not found:", userId);
        const notFoundResponse = {
          error: "Usuario no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending not found response:", notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      const updateData: Record<string, unknown> = {};
      if (nombre) updateData.nombre = nombre;
      if (correo !== undefined) updateData.correo = correo || null;
      if (telefono !== undefined) updateData.telefono = telefono || null;
      if (rol) updateData.rol = rol;
      if (punto_atencion_id !== undefined)
        updateData.punto_atencion_id = punto_atencion_id || null;

      console.warn("Updating user with data:", updateData);
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
      console.warn("User updated successfully:", updatedUser);

      logger.info("Usuario actualizado", {
        userId: updatedUser.id,
        updatedBy: req.user?.id,
      });

      const responseData = {
        user: updatedUser,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== USERS ROUTE PUT ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al actualizar usuario", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al actualizar usuario",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== USERS ROUTE - PUT /:id END ===");
    }
  }
);

// Resetear contraseña de usuario (solo admins)
router.patch(
  "/:id/reset-password",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== USERS ROUTE - PATCH /:id/reset-password START ===");
    console.warn("Request user:", req.user);
    console.warn("User ID to reset password:", req.params.id);
    console.warn("New password data:", { password: "[HIDDEN]" });

    try {
      const userId = req.params.id;
      const { password } = req.body;

      if (!password) {
        const badRequestResponse = {
          error: "La nueva contraseña es requerida",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending bad request response:", badRequestResponse);
        res.status(400).json(badRequestResponse);
        return;
      }

      console.warn("Checking if user exists...");
      const existingUser = await prisma.usuario.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        console.warn("User not found:", userId);
        const notFoundResponse = {
          error: "Usuario no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending not found response:", notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      console.warn("Hashing new password...");
      const hashedPassword = await bcrypt.hash(password, 10);

      console.warn("Updating user password...");
      await prisma.usuario.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info("Contraseña reseteada", {
        userId: userId,
        resetBy: req.user?.id,
      });

      const responseData = {
        message: "Contraseña reseteada exitosamente",
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== USERS ROUTE RESET PASSWORD ERROR ===");
      console.error("Error details:", error);

      logger.error("Error al resetear contraseña", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al resetear contraseña",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== USERS ROUTE - PATCH /:id/reset-password END ===");
    }
  }
);

// Cambiar el estado de un usuario (solo admins)
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: express.Request, res: express.Response): Promise<void> => {
    console.warn("=== USERS ROUTE - PATCH /:id/toggle START ===");
    console.warn("Request headers:", req.headers);
    console.warn("Request user:", req.user);
    console.warn("User ID to toggle:", req.params.id);

    try {
      const userId = req.params.id;

      console.warn("Fetching user from database...");
      const existingUser = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { activo: true, id: true, username: true },
      });

      if (!existingUser) {
        console.warn("User not found:", userId);
        const notFoundResponse = {
          error: "Usuario no encontrado",
          success: false,
          timestamp: new Date().toISOString(),
        };
        console.warn("Sending not found response:", notFoundResponse);
        res.status(404).json(notFoundResponse);
        return;
      }

      console.warn("Toggling user status...");
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
      console.warn("User status toggled successfully:", updatedUser);

      logger.info("Estado de usuario cambiado", {
        userId: updatedUser.id,
        newStatus: updatedUser.activo,
        requestedBy: req.user?.id,
      });

      const responseData = {
        user: updatedUser,
        success: true,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending success response:", responseData);

      res.status(200).json(responseData);
    } catch (error) {
      console.error("=== USERS ROUTE TOGGLE ERROR ===");
      console.error("Error details:", error);
      console.error(
        "Error message:",
        error instanceof Error ? error.message : "Unknown error"
      );
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack"
      );

      logger.error("Error al cambiar el estado del usuario", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: req.user?.id,
      });

      const errorResponse = {
        error: "Error al cambiar el estado del usuario",
        success: false,
        timestamp: new Date().toISOString(),
      };
      console.warn("Sending error response:", errorResponse);
      res.status(500).json(errorResponse);
    } finally {
      console.warn("=== USERS ROUTE - PATCH /:id/toggle END ===");
    }
  }
);

export default router;
