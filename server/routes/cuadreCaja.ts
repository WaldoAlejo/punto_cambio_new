
import express from "express";
import { pool } from "../lib/database";
import { authenticateToken } from "../middleware/auth";
import logger from "../utils/logger.js";

const router = express.Router();

// Obtener el cuadre actual y datos para cierre
router.get("/", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user;
    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar cuadre abierto del día
    const cuadreQuery = `
      SELECT c.*, 
             json_agg(
               json_build_object(
                 'id', dc.id,
                 'moneda_id', dc.moneda_id,
                 'saldo_apertura', dc.saldo_apertura,
                 'saldo_cierre', dc.saldo_cierre,
                 'conteo_fisico', dc.conteo_fisico,
                 'billetes', dc.billetes,
                 'monedas_fisicas', dc.monedas_fisicas,
                 'diferencia', dc.diferencia,
                 'moneda', json_build_object(
                   'id', m.id,
                   'codigo', m.codigo,
                   'nombre', m.nombre,
                   'simbolo', m.simbolo
                 )
               )
             ) FILTER (WHERE dc.id IS NOT NULL) as detalles
      FROM cuadrecaja c
      LEFT JOIN detallecuadrecaja dc ON c.id = dc.cuadre_id
      LEFT JOIN moneda m ON dc.moneda_id = m.id
      WHERE c.punto_atencion_id = $1 
        AND c.fecha >= $2 
        AND c.estado = 'ABIERTO'
      GROUP BY c.id
      LIMIT 1
    `;
    
    let cuadre = null;
    try {
      const cuadreResult = await pool.query(cuadreQuery, [usuario.punto_atencion_id, hoy.toISOString()]);
      cuadre = cuadreResult.rows[0] || null;
    } catch (cuadreError) {
      console.error('Error obteniendo cuadre:', cuadreError);
      // Continuar sin cuadre si hay error
    }

    // Obtener jornada activa para calcular período
    const jornadaQuery = `
      SELECT * FROM jornada 
      WHERE usuario_id = $1 
        AND punto_atencion_id = $2 
        AND estado = 'ACTIVO'
      ORDER BY fecha_inicio DESC 
      LIMIT 1
    `;
    
    let jornadaActiva = null;
    try {
      const jornadaResult = await pool.query(jornadaQuery, [usuario.id, usuario.punto_atencion_id]);
      jornadaActiva = jornadaResult.rows[0] || null;
    } catch (jornadaError) {
      console.error('Error obteniendo jornada:', jornadaError);
      // Continuar sin jornada si hay error
    }

    const fechaInicio = jornadaActiva?.fecha_inicio ? new Date(jornadaActiva.fecha_inicio) : hoy;

    console.log("📅 Cuadre debug info:", {
      puntoAtencionId: usuario.punto_atencion_id,
      fechaInicio: fechaInicio.toISOString(),
      fechaHoy: hoy.toISOString(),
      jornadaActiva: jornadaActiva ? {
        id: jornadaActiva.id,
        estado: jornadaActiva.estado,
        fechaInicio: jornadaActiva.fecha_inicio
      } : null
    });

    // Obtener cambios realizados en el período
    const cambiosQuery = `
      SELECT id, moneda_origen_id, moneda_destino_id, monto_origen, monto_destino, fecha, estado
      FROM cambiodivisa
      WHERE punto_atencion_id = $1 
        AND fecha >= $2 
        AND estado = 'COMPLETADO'
    `;
    
    let cambiosHoy = [];
    try {
      const cambiosResult = await pool.query(cambiosQuery, [usuario.punto_atencion_id, fechaInicio.toISOString()]);
      cambiosHoy = cambiosResult.rows;
    } catch (cambiosError) {
      console.error('Error obteniendo cambios:', cambiosError);
      return res.status(500).json({ success: false, error: 'Error obteniendo cambios: ' + cambiosError.message });
    }

    // Obtener transferencias del período
    const transferenciasEntradaQuery = `
      SELECT id, monto, moneda_id, tipo_transferencia
      FROM transferencia
      WHERE destino_id = $1 
        AND fecha >= $2 
        AND estado = 'APROBADA'
    `;
    
    const transferenciasSalidaQuery = `
      SELECT id, monto, moneda_id, tipo_transferencia
      FROM transferencia
      WHERE origen_id = $1 
        AND fecha >= $2 
        AND estado = 'APROBADA'
    `;
    
    let transferenciasEntrada = [];
    let transferenciasSalida = [];
    try {
      const transferenciasEntradaResult = await pool.query(transferenciasEntradaQuery, [usuario.punto_atencion_id, fechaInicio.toISOString()]);
      const transferenciasSalidaResult = await pool.query(transferenciasSalidaQuery, [usuario.punto_atencion_id, fechaInicio.toISOString()]);
      
      transferenciasEntrada = transferenciasEntradaResult.rows;
      transferenciasSalida = transferenciasSalidaResult.rows;
    } catch (transferenciasError) {
      console.error('Error obteniendo transferencias:', transferenciasError);
      // Continuar con arrays vacíos si hay error
    }

    console.log("💱 Cambios COMPLETADOS:", {
      total: cambiosHoy.length || 0,
      cambios: cambiosHoy.map(c => ({
        id: c.id,
        fecha: c.fecha,
        estado: c.estado,
        origen: c.moneda_origen_id,
        destino: c.moneda_destino_id,
        montoOrigen: c.monto_origen,
        montoDestino: c.monto_destino
      }))
    });

    console.log("📈 Transferencias:", {
      entrada: transferenciasEntrada.length || 0,
      salida: transferenciasSalida.length || 0
    });

    // Identificar monedas utilizadas
    const monedasUsadas = new Set<string>();
    cambiosHoy.forEach((cambio) => {
      monedasUsadas.add(cambio.moneda_origen_id);
      monedasUsadas.add(cambio.moneda_destino_id);
    });

    console.log("🪙 Monedas utilizadas:", Array.from(monedasUsadas));

    if (monedasUsadas.size === 0) {
      console.log("⚠️ No hay monedas utilizadas, retornando mensaje");
      return res.status(200).json({
        success: true,
        data: {
          detalles: [],
          observaciones: "",
          mensaje: "No se han realizado cambios de divisa hoy",
          totales: {
            cambios: 0,
            transferencias_entrada: transferenciasEntrada.length || 0,
            transferencias_salida: transferenciasSalida.length || 0,
          },
        },
      });
    }

    // Obtener información de las monedas utilizadas
    const monedasQuery = `
      SELECT * FROM moneda
      WHERE id = ANY($1::uuid[]) 
        AND activo = true
      ORDER BY orden_display ASC
    `;
    
    let monedas = [];
    try {
      const monedasResult = await pool.query(monedasQuery, [Array.from(monedasUsadas)]);
      monedas = monedasResult.rows;
    } catch (monedasError) {
      console.error('Error obteniendo monedas:', monedasError);
      return res.status(500).json({ success: false, error: 'Error obteniendo monedas: ' + monedasError.message });
    }

    // Calcular movimientos para cada moneda
    const detallesConValores = await Promise.all(
      monedas.map(async (moneda) => {
        const detalle = cuadre?.detalles?.find((d: any) => d.moneda_id === moneda.id);
        
        // Calcular saldo de apertura
        const saldoApertura = await calcularSaldoApertura(
          usuario.punto_atencion_id as string,
          moneda.id,
          fechaInicio
        );

        console.log(`💰 Calculando movimientos para ${moneda.codigo}:`, {
          saldoApertura,
          cambiosHoy: cambiosHoy.filter(c => 
            c.moneda_origen_id === moneda.id || c.moneda_destino_id === moneda.id
          )
        });

        // Calcular movimientos del período con mejor claridad
        // INGRESOS: cuando esta moneda es la que SE RECIBE (moneda_destino)
        const ingresos = cambiosHoy
          .filter(c => c.moneda_destino_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_destino), 0) || 0;

        // EGRESOS: cuando esta moneda es la que SE ENTREGA (moneda_origen)
        const egresos = cambiosHoy
          .filter(c => c.moneda_origen_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_origen), 0) || 0;

        const saldoCierre = saldoApertura + ingresos - egresos;

        console.log(`📊 Resultado para ${moneda.codigo}:`, {
          saldoApertura,
          ingresos: `+${ingresos}`,
          egresos: `-${egresos}`,
          saldoCierre
        });

        return {
          moneda_id: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          saldo_apertura: saldoApertura,
          saldo_cierre: saldoCierre,
          conteo_fisico: detalle?.conteo_fisico || 0,
          billetes: detalle?.billetes || 0,
          monedas: detalle?.monedas_fisicas || 0,
          ingresos_periodo: ingresos,
          egresos_periodo: egresos,
          movimientos_periodo: cambiosHoy.filter(c => 
            c.moneda_origen_id === moneda.id || c.moneda_destino_id === moneda.id
          ).length || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        detalles: detallesConValores,
        observaciones: cuadre?.observaciones || "",
        cuadre_id: cuadre?.id,
        periodo_inicio: fechaInicio,
        totales: {
          cambios: cambiosHoy.length || 0,
          transferencias_entrada: transferenciasEntrada.length || 0,
          transferencias_salida: transferenciasSalida.length || 0,
        },
      },
    });
  } catch (error) {
    logger.error("Error al obtener cuadre de caja", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Función auxiliar para calcular saldo de apertura
async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fecha: Date
): Promise<number> {
  try {
    console.log(`🔍 CALCULANDO SALDO APERTURA - Datos:`, {
      puntoAtencionId,
      monedaId,
      fecha: fecha.toISOString()
    });
    
    // 1. Buscar el último cierre anterior
    console.log(`🔍 Buscando último cierre anterior...`);
    const ultimoCierreQuery = `
      SELECT dc.*, c.fecha as fecha_cuadre, c.estado as estado_cuadre
      FROM detallecuadrecaja dc
      INNER JOIN cuadrecaja c ON dc.cuadre_id = c.id
      WHERE dc.moneda_id = $1 
        AND c.punto_atencion_id = $2 
        AND c.estado IN ('CERRADO', 'PARCIAL')
        AND c.fecha < $3
      ORDER BY c.fecha DESC 
      LIMIT 1
    `;
    
    let ultimoCierre = null;
    try {
      const ultimoCierreResult = await pool.query(ultimoCierreQuery, [monedaId, puntoAtencionId, fecha.toISOString()]);
      ultimoCierre = ultimoCierreResult.rows[0] || null;
    } catch (ultimoCierreError) {
      console.error('Error buscando último cierre:', ultimoCierreError);
      // Continuar sin último cierre si hay error
    }

    console.log(`🔍 Resultado búsqueda último cierre:`, ultimoCierre ? {
      id: ultimoCierre.id,
      conteo_fisico: ultimoCierre.conteo_fisico,
      fecha_cuadre: ultimoCierre.fecha_cuadre,
      estado_cuadre: ultimoCierre.estado_cuadre
    } : 'NO ENCONTRADO');

    if (ultimoCierre) {
      console.log(`✅ USANDO ÚLTIMO CIERRE: ${ultimoCierre.conteo_fisico}`);
      return Number(ultimoCierre.conteo_fisico);
    }

    // 2. Si no hay cierre anterior, buscar saldo inicial actual
    console.log(`🔍 No hay cierre anterior, buscando saldo inicial en tabla Saldo...`);
    
    // Primero verificar todos los saldos del punto
    const todosSaldosQuery = `
      SELECT s.*, m.codigo as moneda_codigo
      FROM saldo s
      INNER JOIN moneda m ON s.moneda_id = m.id
      WHERE s.punto_atencion_id = $1
    `;
    
    let todosSaldos = [];
    try {
      const todosSaldosResult = await pool.query(todosSaldosQuery, [puntoAtencionId]);
      todosSaldos = todosSaldosResult.rows;
    } catch (todosSaldosError) {
      console.error('Error obteniendo todos los saldos:', todosSaldosError);
    }
    
    console.log(`🔍 TODOS LOS SALDOS del punto ${puntoAtencionId}:`, todosSaldos.map(s => ({
      moneda_id: s.moneda_id,
      moneda_codigo: s.moneda_codigo,
      cantidad: s.cantidad
    })));

    const saldoInicialQuery = `
      SELECT s.*, m.codigo as moneda_codigo
      FROM saldo s
      INNER JOIN moneda m ON s.moneda_id = m.id
      WHERE s.punto_atencion_id = $1 AND s.moneda_id = $2
    `;
    
    let saldoInicial = null;
    try {
      const saldoInicialResult = await pool.query(saldoInicialQuery, [puntoAtencionId, monedaId]);
      saldoInicial = saldoInicialResult.rows[0] || null;
    } catch (saldoInicialError) {
      console.error('Error obteniendo saldo inicial:', saldoInicialError);
    }

    console.log(`🔍 SALDO INICIAL específico:`, saldoInicial ? {
      id: saldoInicial.id,
      punto_atencion_id: saldoInicial.punto_atencion_id,
      moneda_id: saldoInicial.moneda_id,
      moneda_codigo: saldoInicial.moneda_codigo,
      cantidad: saldoInicial.cantidad
    } : 'NO ENCONTRADO');

    if (saldoInicial) {
      console.log(`✅ USANDO SALDO INICIAL: ${saldoInicial.cantidad}`);
      return Number(saldoInicial.cantidad);
    }

    console.log(`❌ NO SE ENCONTRÓ SALDO APERTURA, usando 0`);
    return 0;
  } catch (error) {
    console.error(`💥 ERROR calculando saldo apertura:`, error);
    logger.error("Error calculando saldo apertura", { error });
    return 0;
  }
}

// Guardar cierre de caja
router.post("/", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user;
    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const { detalles, observaciones } = req.body;

    if (!detalles || !Array.isArray(detalles)) {
      return res.status(400).json({
        success: false,
        error: "Detalles del cuadre son requeridos",
      });
    }

    // Obtener jornada activa para calcular período
    const jornadaQuery = `
      SELECT * FROM jornada 
      WHERE usuario_id = $1 
        AND punto_atencion_id = $2 
        AND estado = 'ACTIVO'
      ORDER BY fecha_inicio DESC 
      LIMIT 1
    `;
    
    const jornadaResult = await pool.query(jornadaQuery, [usuario.id, usuario.punto_atencion_id]);
    const jornadaActiva = jornadaResult.rows[0] || null;

    const fechaInicio = jornadaActiva?.fecha_inicio ? new Date(jornadaActiva.fecha_inicio) : new Date();
    fechaInicio.setHours(0, 0, 0, 0);

    // Calcular totales del período
    const totalCambiosQuery = `
      SELECT COUNT(*) FROM cambiodivisa
      WHERE punto_atencion_id = $1 
        AND fecha >= $2 
        AND estado = 'COMPLETADO'
    `;
    
    const totalTransferenciasEntradaQuery = `
      SELECT COUNT(*) FROM transferencia
      WHERE destino_id = $1 
        AND fecha >= $2 
        AND estado = 'APROBADA'
    `;
    
    const totalTransferenciasSalidaQuery = `
      SELECT COUNT(*) FROM transferencia
      WHERE origen_id = $1 
        AND fecha >= $2 
        AND estado = 'APROBADA'
    `;
    
    const totalCambiosResult = await pool.query(totalCambiosQuery, [usuario.punto_atencion_id, fechaInicio.toISOString()]);
    const totalTransferenciasEntradaResult = await pool.query(totalTransferenciasEntradaQuery, [usuario.punto_atencion_id, fechaInicio.toISOString()]);
    const totalTransferenciasSalidaResult = await pool.query(totalTransferenciasSalidaQuery, [usuario.punto_atencion_id, fechaInicio.toISOString()]);
    
    const totalCambios = parseInt(totalCambiosResult.rows[0].count);
    const totalTransferenciasEntrada = parseInt(totalTransferenciasEntradaResult.rows[0].count);
    const totalTransferenciasSalida = parseInt(totalTransferenciasSalidaResult.rows[0].count);

    // Crear el cuadre principal
    const cuadreInsertQuery = `
      INSERT INTO cuadrecaja (
        usuario_id, punto_atencion_id, estado, observaciones, 
        fecha_cierre, total_cambios, total_transferencias_entrada, total_transferencias_salida
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const cuadreResult = await pool.query(cuadreInsertQuery, [
      usuario.id,
      usuario.punto_atencion_id,
      'CERRADO',
      observaciones || null,
      new Date().toISOString(),
      totalCambios || 0,
      totalTransferenciasEntrada || 0,
      totalTransferenciasSalida || 0,
    ]);
    
    const cuadre = cuadreResult.rows[0];

    // Crear los detalles del cuadre
    const detalleInsertQuery = `
      INSERT INTO detallecuadrecaja (
        cuadre_id, moneda_id, saldo_apertura, saldo_cierre, 
        conteo_fisico, billetes, monedas_fisicas, diferencia
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    for (const detalle of detalles) {
      await pool.query(detalleInsertQuery, [
        cuadre.id,
        detalle.moneda_id,
        detalle.saldo_apertura || 0,
        detalle.saldo_cierre || 0,
        detalle.conteo_fisico || 0,
        detalle.billetes || 0,
        detalle.monedas || 0,
        (detalle.conteo_fisico || 0) - (detalle.saldo_cierre || 0),
      ]);
    }

    // Obtener el cuadre completo
    const cuadreCompletoQuery = `
      SELECT c.*,
             u.nombre as usuario_nombre, u.username as usuario_username,
             json_agg(
               json_build_object(
                 'id', dc.id,
                 'moneda_id', dc.moneda_id,
                 'saldo_apertura', dc.saldo_apertura,
                 'saldo_cierre', dc.saldo_cierre,
                 'conteo_fisico', dc.conteo_fisico,
                 'billetes', dc.billetes,
                 'monedas_fisicas', dc.monedas_fisicas,
                 'diferencia', dc.diferencia,
                 'moneda', json_build_object(
                   'id', m.id,
                   'codigo', m.codigo,
                   'nombre', m.nombre,
                   'simbolo', m.simbolo
                 )
               )
             ) FILTER (WHERE dc.id IS NOT NULL) as detalles
      FROM cuadrecaja c
      LEFT JOIN usuario u ON c.usuario_id = u.id
      LEFT JOIN detallecuadrecaja dc ON c.id = dc.cuadre_id
      LEFT JOIN moneda m ON dc.moneda_id = m.id
      WHERE c.id = $1
      GROUP BY c.id, u.nombre, u.username
    `;
    
    const cuadreCompletoResult = await pool.query(cuadreCompletoQuery, [cuadre.id]);
    const cuadreCompleto = cuadreCompletoResult.rows[0] || null;

    logger.info("Cuadre de caja guardado exitosamente", {
      cuadreId: cuadre.id,
      usuario_id: usuario.id,
      punto_atencion_id: usuario.punto_atencion_id,
    });

    res.status(201).json({
      success: true,
      cuadre: cuadreCompleto || cuadre,
      message: "Cuadre de caja guardado exitosamente",
    });
  } catch (error) {
    logger.error("Error al guardar cuadre de caja", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
      usuario_id: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
