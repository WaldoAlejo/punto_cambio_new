import express from 'express';
import { auth } from '../middleware/auth.js';
import { pool } from '../lib/database.js';

const router = express.Router();

// Obtener vista consolidada de saldos por punto
router.get('/', auth, async (req, res) => {
  try {
    const query = `
      SELECT 
        pa.id as punto_atencion_id,
        pa.nombre as punto_nombre,
        pa.ciudad,
        m.id as moneda_id,
        m.nombre as moneda_nombre,
        m.simbolo as moneda_simbolo,
        m.codigo as moneda_codigo,
        COALESCE(si.cantidad_inicial, 0) as saldo_inicial,
        COALESCE(s.cantidad, 0) as saldo_actual,
        COALESCE(s.billetes, 0) as billetes,
        COALESCE(s.monedas_fisicas, 0) as monedas_fisicas,
        (COALESCE(s.cantidad, 0) - COALESCE(si.cantidad_inicial, 0)) as diferencia,
        s.updated_at as ultima_actualizacion,
        si.fecha_asignacion as fecha_saldo_inicial
      FROM "PuntoAtencion" pa
      CROSS JOIN "Moneda" m
      LEFT JOIN "SaldoInicial" si ON pa.id = si.punto_atencion_id AND m.id = si.moneda_id AND si.activo = true
      LEFT JOIN "Saldo" s ON pa.id = s.punto_atencion_id AND m.id = s.moneda_id
      WHERE pa.activo = true AND m.activo = true
      ORDER BY pa.nombre, m.orden_display, m.nombre
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      saldos: result.rows
    });
  } catch (error) {
    console.error('Error in balance view route:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;