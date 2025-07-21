import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../lib/database';

const router = express.Router();

// Obtener movimientos de saldo por punto
router.get('/:pointId', authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;
    const { limit = 50 } = req.query;

    const query = `
      SELECT ms.*, 
             m.nombre as moneda_nombre, m.codigo as moneda_codigo, m.simbolo as moneda_simbolo,
             u.nombre as usuario_nombre,
             pa.nombre as punto_nombre
      FROM "MovimientoSaldo" ms
      JOIN "Moneda" m ON ms.moneda_id = m.id
      JOIN "Usuario" u ON ms.usuario_id = u.id
      JOIN "PuntoAtencion" pa ON ms.punto_atencion_id = pa.id
      WHERE ms.punto_atencion_id = $1
      ORDER BY ms.fecha DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [pointId, parseInt(limit)]);

    // Formatear los resultados para incluir los objetos anidados
    const movimientos = result.rows.map(row => ({
      ...row,
      moneda: {
        id: row.moneda_id,
        nombre: row.moneda_nombre,
        codigo: row.moneda_codigo,
        simbolo: row.moneda_simbolo
      },
      usuario: {
        id: row.usuario_id,
        nombre: row.usuario_nombre
      },
      puntoAtencion: {
        id: row.punto_atencion_id,
        nombre: row.punto_nombre
      }
    }));

    res.json({
      success: true,
      movimientos
    });
  } catch (error) {
    console.error('Error in balance movements route:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;