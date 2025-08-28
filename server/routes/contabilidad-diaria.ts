import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../lib/database.js";
import { format } from "date-fns";

const router = express.Router();

// Obtener resumen de contabilidad diaria
router.get("/:pointId/:fecha", authenticateToken, async (req, res) => {
  try {
    const { pointId, fecha } = req.params;

    // Validar fecha
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Fecha inválida",
      });
    }

    const fechaStr = format(fechaObj, "yyyy-MM-dd");

    // Obtener saldos iniciales para el punto
    const saldosInicialesQuery = `
      SELECT 
        si.moneda_id,
        si.cantidad_inicial as saldo_inicial,
        m.codigo as moneda_codigo,
        m.nombre as moneda_nombre,
        m.simbolo as moneda_simbolo
      FROM "SaldoInicial" si
      JOIN "Moneda" m ON si.moneda_id = m.id
      WHERE si.punto_atencion_id = $1 AND si.activo = true
    `;
    const saldosInicialesResult = await pool.query(saldosInicialesQuery, [
      pointId,
    ]);

    const resumenPorMoneda = [];

    for (const saldoInicial of saldosInicialesResult.rows) {
      const { moneda_id, saldo_inicial, moneda_codigo, moneda_simbolo } =
        saldoInicial;

      // Obtener movimientos de cambios de divisas para la fecha
      const cambiosQuery = `
        SELECT 
          cd.id,
          cd.fecha,
          cd.tipo_operacion,
          cd.monto_origen,
          cd.monto_destino,
          cd.moneda_origen_id,
          cd.moneda_destino_id,
          cd.numero_recibo,
          u.nombre as usuario_nombre,
          cd.observacion
        FROM "CambioDivisa" cd
        JOIN "Usuario" u ON cd.usuario_id = u.id
        WHERE cd.punto_atencion_id = $1 
          AND DATE(cd.fecha) = $2
          AND cd.estado = 'COMPLETADO'
          AND (cd.moneda_origen_id = $3 OR cd.moneda_destino_id = $3)
        ORDER BY cd.fecha ASC
      `;
      const cambiosResult = await pool.query(cambiosQuery, [
        pointId,
        fechaStr,
        moneda_id,
      ]);

      // Obtener transferencias para la fecha
      const transferenciasQuery = `
        SELECT 
          t.id,
          t.fecha,
          t.monto,
          t.tipo_transferencia,
          t.origen_id,
          t.destino_id,
          t.numero_recibo,
          u.nombre as usuario_nombre,
          t.descripcion as observaciones
        FROM "Transferencia" t
        JOIN "Usuario" u ON t.solicitado_por = u.id
        WHERE t.moneda_id = $1
          AND DATE(t.fecha) = $2
          AND t.estado = 'APROBADO'
          AND (t.origen_id = $3 OR t.destino_id = $3)
        ORDER BY t.fecha ASC
      `;
      const transferenciasResult = await pool.query(transferenciasQuery, [
        moneda_id,
        fechaStr,
        pointId,
      ]);

      // Procesar movimientos
      const movimientos = [];
      let totalIngresos = 0;
      let totalEgresos = 0;

      // Procesar cambios
      for (const cambio of cambiosResult.rows) {
        if (cambio.moneda_origen_id === moneda_id) {
          // Egreso: vendemos esta moneda
          const monto = parseFloat(cambio.monto_origen);
          totalEgresos += monto;
          movimientos.push({
            id: `cambio-${cambio.id}`,
            fecha: cambio.fecha,
            tipo: "EGRESO",
            concepto: "CAMBIO_VENTA",
            moneda_id,
            moneda_codigo,
            moneda_simbolo,
            monto,
            referencia: cambio.id,
            numero_recibo: cambio.numero_recibo,
            usuario_nombre: cambio.usuario_nombre,
            observaciones: cambio.observacion,
          });
        }

        if (cambio.moneda_destino_id === moneda_id) {
          // Ingreso: compramos esta moneda
          const monto = parseFloat(cambio.monto_destino);
          totalIngresos += monto;
          movimientos.push({
            id: `cambio-${cambio.id}`,
            fecha: cambio.fecha,
            tipo: "INGRESO",
            concepto: "CAMBIO_COMPRA",
            moneda_id,
            moneda_codigo,
            moneda_simbolo,
            monto,
            referencia: cambio.id,
            numero_recibo: cambio.numero_recibo,
            usuario_nombre: cambio.usuario_nombre,
            observaciones: cambio.observacion,
          });
        }
      }

      // Procesar transferencias
      for (const transferencia of transferenciasResult.rows) {
        const monto = parseFloat(transferencia.monto);

        if (transferencia.destino_id === pointId) {
          // Ingreso: recibimos transferencia
          totalIngresos += monto;
          movimientos.push({
            id: `transferencia-${transferencia.id}`,
            fecha: transferencia.fecha,
            tipo: "INGRESO",
            concepto: "TRANSFERENCIA_RECIBIDA",
            moneda_id,
            moneda_codigo,
            moneda_simbolo,
            monto,
            referencia: transferencia.id,
            numero_recibo: transferencia.numero_recibo,
            usuario_nombre: transferencia.usuario_nombre,
            observaciones: transferencia.observaciones,
          });
        }

        if (transferencia.origen_id === pointId) {
          // Egreso: enviamos transferencia
          totalEgresos += monto;
          movimientos.push({
            id: `transferencia-${transferencia.id}`,
            fecha: transferencia.fecha,
            tipo: "EGRESO",
            concepto: "TRANSFERENCIA_ENVIADA",
            moneda_id,
            moneda_codigo,
            moneda_simbolo,
            monto,
            referencia: transferencia.id,
            numero_recibo: transferencia.numero_recibo,
            usuario_nombre: transferencia.usuario_nombre,
            observaciones: transferencia.observaciones,
          });
        }
      }

      // Calcular saldo final y diferencia
      const saldoFinal =
        parseFloat(saldo_inicial) + totalIngresos - totalEgresos;
      const diferencia = totalIngresos - totalEgresos;

      // Obtener información del punto
      const puntoQuery = `SELECT nombre FROM "PuntoAtencion" WHERE id = $1`;
      const puntoResult = await pool.query(puntoQuery, [pointId]);
      const puntoNombre = puntoResult.rows[0]?.nombre || "Punto desconocido";

      resumenPorMoneda.push({
        fecha: fechaStr,
        punto_atencion_id: pointId,
        punto_atencion_nombre: puntoNombre,
        moneda_id,
        moneda_codigo,
        moneda_simbolo,
        saldo_inicial: parseFloat(saldo_inicial),
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_final: saldoFinal,
        diferencia,
        movimientos: movimientos.sort(
          (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        ),
      });
    }

    res.json({
      success: true,
      resumen: resumenPorMoneda,
    });
  } catch (error) {
    console.error("Error in daily accounting route:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Verificar si existe cierre para una fecha
router.get("/cierre/:pointId/:fecha", authenticateToken, async (req, res) => {
  try {
    const { pointId, fecha } = req.params;

    const query = `
      SELECT 
        cd.*,
        u.nombre as cerrado_por_nombre
      FROM "CierreDiario" cd
      LEFT JOIN "Usuario" u ON cd.cerrado_por = u.id
      WHERE cd.punto_atencion_id = $1 AND cd.fecha = $2
    `;

    const result = await pool.query(query, [pointId, fecha]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        cierre: {
          ...result.rows[0],
          cerrado_por: result.rows[0].cerrado_por_nombre,
        },
      });
    } else {
      res.json({
        success: true,
        cierre: null,
      });
    }
  } catch (error) {
    console.error("Error checking daily close:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Realizar cierre diario
router.post("/cierre", authenticateToken, async (req, res) => {
  try {
    const { punto_atencion_id, fecha, observaciones, diferencias_reportadas } =
      req.body;

    if (!punto_atencion_id || !fecha) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios",
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: "No autorizado",
      });
    }

    // Verificar si ya existe un cierre para esta fecha
    const existingQuery = `
      SELECT id FROM "CierreDiario" 
      WHERE punto_atencion_id = $1 AND fecha = $2
    `;
    const existingResult = await pool.query(existingQuery, [
      punto_atencion_id,
      fecha,
    ]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Ya existe un cierre para esta fecha",
      });
    }

    // Crear el cierre diario
    const insertQuery = `
      INSERT INTO "CierreDiario" 
        (punto_atencion_id, fecha, usuario_id, observaciones, estado, fecha_cierre, cerrado_por, diferencias_reportadas)
      VALUES ($1, $2, $3, $4, 'CERRADO', NOW(), $5, $6)
      RETURNING *
    `;

    const insertResult = await pool.query(insertQuery, [
      punto_atencion_id,
      fecha,
      req.user.id,
      observaciones || null,
      req.user.id,
      diferencias_reportadas ? JSON.stringify(diferencias_reportadas) : null,
    ]);

    res.json({
      success: true,
      cierre: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Error creating daily close:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
