import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";

const router = express.Router();

// =============================
// 📍 Gestión de Puntos de Atención
// =============================

// Obtener todos los puntos de atención
router.get("/", authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        telefono,
        servientrega_agencia_codigo,
        servientrega_agencia_nombre,
        activo,
        es_principal,
        created_at,
        updated_at
      FROM "PuntoAtencion"
      ORDER BY nombre ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      puntos: result.rows,
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

    const query = `
      SELECT 
        id,
        nombre,
        direccion,
        ciudad,
        provincia,
        codigo_postal,
        telefono,
        servientrega_agencia_codigo,
        servientrega_agencia_nombre,
        activo,
        es_principal,
        created_at,
        updated_at
      FROM "PuntoAtencion"
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    res.json({
      success: true,
      punto: result.rows[0],
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

// Crear nuevo punto de atención
router.post("/", authenticateToken, async (req, res) => {
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
        error:
          "Los campos nombre, dirección, ciudad y provincia son requeridos",
      });
    }

    const query = `
      INSERT INTO "PuntoAtencion" (nombre, direccion, ciudad, provincia, codigo_postal, telefono, servientrega_agencia_codigo, servientrega_agencia_nombre, es_principal, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING id, nombre, direccion, ciudad, provincia, codigo_postal, telefono, servientrega_agencia_codigo, servientrega_agencia_nombre, es_principal, activo, created_at, updated_at
    `;

    const result = await pool.query(query, [
      nombre,
      direccion,
      ciudad,
      provincia,
      codigo_postal || null,
      telefono || null,
      servientrega_agencia_codigo || null,
      servientrega_agencia_nombre || null,
      es_principal || false,
    ]);

    res.json({
      success: true,
      punto: result.rows[0],
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

// Actualizar punto de atención
router.put("/:id", authenticateToken, async (req, res) => {
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
    const existsQuery = `SELECT id FROM "PuntoAtencion" WHERE id = $1`;
    const existsResult = await pool.query(existsQuery, [id]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Validaciones básicas
    if (!nombre || !direccion || !ciudad || !provincia) {
      return res.status(400).json({
        success: false,
        error:
          "Los campos nombre, dirección, ciudad y provincia son requeridos",
      });
    }

    const query = `
      UPDATE "PuntoAtencion" 
      SET 
        nombre = $2,
        direccion = $3,
        ciudad = $4,
        provincia = $5,
        codigo_postal = $6,
        telefono = $7,
        servientrega_agencia_codigo = $8,
        servientrega_agencia_nombre = $9,
        es_principal = $10,
        activo = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nombre, direccion, ciudad, provincia, codigo_postal, telefono, servientrega_agencia_codigo, servientrega_agencia_nombre, es_principal, activo, created_at, updated_at
    `;

    const result = await pool.query(query, [
      id,
      nombre,
      direccion,
      ciudad,
      provincia,
      codigo_postal || null,
      telefono || null,
      servientrega_agencia_codigo || null,
      servientrega_agencia_nombre || null,
      es_principal !== undefined ? es_principal : false,
      activo !== undefined ? activo : true,
    ]);

    res.json({
      success: true,
      punto: result.rows[0],
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

// Desactivar punto de atención (soft delete)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el punto existe
    const existsQuery = `SELECT id, nombre FROM "PuntoAtencion" WHERE id = $1`;
    const existsResult = await pool.query(existsQuery, [id]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Verificar si hay usuarios asignados a este punto
    const usersQuery = `SELECT COUNT(*) as count FROM "Usuario" WHERE punto_atencion_id = $1 AND activo = true`;
    const usersResult = await pool.query(usersQuery, [id]);

    if (parseInt(usersResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error:
          "No se puede desactivar el punto de atención porque tiene usuarios asignados",
      });
    }

    const query = `
      UPDATE "PuntoAtencion" 
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nombre, activo
    `;

    const result = await pool.query(query, [id]);

    res.json({
      success: true,
      punto: result.rows[0],
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

// Reactivar punto de atención
router.patch("/:id/reactivar", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el punto existe
    const existsQuery = `SELECT id, nombre FROM "PuntoAtencion" WHERE id = $1`;
    const existsResult = await pool.query(existsQuery, [id]);

    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    const query = `
      UPDATE "PuntoAtencion" 
      SET activo = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nombre, activo
    `;

    const result = await pool.query(query, [id]);

    res.json({
      success: true,
      punto: result.rows[0],
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
