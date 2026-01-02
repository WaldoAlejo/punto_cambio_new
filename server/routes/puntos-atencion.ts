import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// =============================
// 📍 Gestión de Puntos de Atención
// =============================

// Obtener todos los puntos de atención
router.get("/", authenticateToken, async (req, res) => {
  try {
    const puntos = await prisma.puntoAtencion.findMany({
      orderBy: {
        nombre: "asc",
      },
    });

    res.json({
      success: true,
      puntos,
    });
  } catch (error) {
    console.error("Error al obtener puntos de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener puntos de atención",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Obtener un punto de atención específico
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const punto = await prisma.puntoAtencion.findUnique({
      where: { id },
    });

    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    res.json({
      success: true,
      punto,
    });
  } catch (error) {
    console.error("Error al obtener punto de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener punto de atención",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Crear nuevo punto de atención (solo admins)
router.post("/", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
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
      es_principal,
    } = req.body;

    // Validaciones básicas
    if (!nombre || !direccion || !ciudad || !provincia) {
      return res.status(400).json({
        success: false,
        error: "Los campos nombre, dirección, ciudad y provincia son requeridos",
      });
    }

    const punto = await prisma.puntoAtencion.create({
      data: {
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        servientrega_agencia_codigo: servientrega_agencia_codigo || null,
        servientrega_agencia_nombre: servientrega_agencia_nombre || null,
        es_principal: es_principal || false,
        activo: true,
      },
    });

    res.json({
      success: true,
      punto,
      message: "Punto de atención creado correctamente",
    });
  } catch (error) {
    console.error("Error al crear punto de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al crear punto de atención",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Actualizar punto de atención (solo admins)
router.put("/:id", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      direccion,
      ciudad,
      provincia,
      codigo_postal,
      telefono,
      servientrega_agencia_codigo,
      servientrega_agencia_nombre,
      es_principal,
      activo,
    } = req.body;

    // Verificar que el punto existe
    const puntoExistente = await prisma.puntoAtencion.findUnique({
      where: { id },
    });

    if (!puntoExistente) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Validaciones básicas
    if (!nombre || !direccion || !ciudad || !provincia) {
      return res.status(400).json({
        success: false,
        error: "Los campos nombre, dirección, ciudad y provincia son requeridos",
      });
    }

    const punto = await prisma.puntoAtencion.update({
      where: { id },
      data: {
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal: codigo_postal || null,
        telefono: telefono || null,
        servientrega_agencia_codigo: servientrega_agencia_codigo || null,
        servientrega_agencia_nombre: servientrega_agencia_nombre || null,
        es_principal: es_principal !== undefined ? es_principal : false,
        activo: activo !== undefined ? activo : true,
      },
    });

    res.json({
      success: true,
      punto,
      message: "Punto de atención actualizado correctamente",
    });
  } catch (error) {
    console.error("Error al actualizar punto de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al actualizar punto de atención",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Desactivar punto de atención (soft delete, solo admins)
router.delete("/:id", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el punto existe
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id },
      include: {
        usuarios: {
          where: { activo: true },
        },
      },
    });

    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Verificar si hay usuarios asignados a este punto
    if (punto.usuarios.length > 0) {
      return res.status(400).json({
        success: false,
        error: "No se puede desactivar el punto de atención porque tiene usuarios asignados",
      });
    }

    const puntoActualizado = await prisma.puntoAtencion.update({
      where: { id },
      data: { activo: false },
    });

    res.json({
      success: true,
      punto: puntoActualizado,
      message: "Punto de atención desactivado correctamente",
    });
  } catch (error) {
    console.error("Error al desactivar punto de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al desactivar punto de atención",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Reactivar punto de atención (solo admins)
router.patch("/:id/reactivar", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el punto existe
    const puntoExistente = await prisma.puntoAtencion.findUnique({
      where: { id },
    });

    if (!puntoExistente) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    const punto = await prisma.puntoAtencion.update({
      where: { id },
      data: { activo: true },
    });

    res.json({
      success: true,
      punto,
      message: "Punto de atención reactivado correctamente",
    });
  } catch (error) {
    console.error("Error al reactivar punto de atención:", error);
    res.status(500).json({
      success: false,
      error: "Error al reactivar punto de atención",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
