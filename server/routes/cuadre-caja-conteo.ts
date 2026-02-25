/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RUTAS DE CONTEO FÍSICO Y AUDITORÍA DE CUADRE DE CAJA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo proporciona endpoints para:
 * 1. Guardar conteo físico manual de billetes y monedas por operador
 * 2. Obtener todos los movimientos del día para auditoría
 * 3. Validar diferencias antes del cierre
 * 4. Notificar discrepancias mayores a $10
 */

import express from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma.js";
import { pool } from "../lib/database.js";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { gyeDayRangeUtcFromDate } from "../utils/timezone.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";

const router = express.Router();

// Umbral de alerta para diferencias ($10)
const UMBRAL_DIFERENCIA_ALERTA = 10;

interface UsuarioAutenticado {
  id: string;
  punto_atencion_id: string;
  nombre?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS DE VALIDACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const conteoFisicoSchema = z.object({
  cuadre_id: z.string().uuid(),
  moneda_id: z.string().uuid(),
  billetes: z.number().min(0).default(0),
  monedas_fisicas: z.number().min(0).default(0),
  conteo_bancos: z.number().min(0).default(0),
  observaciones: z.string().max(500).optional(),
});

const validarCierreSchema = z.object({
  cuadre_id: z.string().uuid(),
  forzar: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cuadre-caja/conteo-fisico
// Guarda el conteo físico manual del operador
// ═══════════════════════════════════════════════════════════════════════════
router.post("/conteo-fisico", authenticateToken, validate(conteoFisicoSchema), async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  
  try {
    const { cuadre_id, moneda_id, billetes, monedas_fisicas, conteo_bancos, observaciones } = req.body;
    
    logger.info("📝 Guardando conteo físico manual", {
      usuario_id: usuario.id,
      cuadre_id,
      moneda_id,
      billetes,
      monedas_fisicas,
      conteo_bancos,
    });

    // Verificar que el cuadre existe y pertenece al punto del usuario
    const cuadreResult = await pool.query(
      `SELECT c.*, c.punto_atencion_id 
       FROM "CuadreCaja" c 
       WHERE c.id = $1::uuid AND c.estado = 'ABIERTO'`,
      [cuadre_id]
    );

    if (cuadreResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Cuadre no encontrado o ya está cerrado",
      });
    }

    const cuadre = cuadreResult.rows[0];
    
    // Verificar permisos - el operador solo puede contar su propio punto
    if (cuadre.punto_atencion_id !== usuario.punto_atencion_id) {
      return res.status(403).json({
        success: false,
        error: "No tiene permisos para modificar este cuadre",
      });
    }

    // Calcular conteo físico total
    const conteoFisicoTotal = Number((billetes + monedas_fisicas).toFixed(2));

    // Obtener el detalle actual para calcular la diferencia
    const detalleResult = await pool.query(
      `SELECT * FROM "DetalleCuadreCaja" 
       WHERE cuadre_id = $1::uuid AND moneda_id = $2::uuid`,
      [cuadre_id, moneda_id]
    );

    let saldoCierre = 0;
    if (detalleResult.rows.length > 0) {
      saldoCierre = Number(detalleResult.rows[0].saldo_cierre);
    }

    // Calcular diferencias
    const diferencia = Number((conteoFisicoTotal - saldoCierre).toFixed(2));
    const diferenciaBancos = Number((conteo_bancos - (detalleResult.rows[0]?.bancos_teorico || 0)).toFixed(2));

    // Determinar si hay alerta
    const requiereAlerta = Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA || 
                           Math.abs(diferenciaBancos) > UMBRAL_DIFERENCIA_ALERTA;

    // Guardar o actualizar el detalle
    if (detalleResult.rows.length === 0) {
      // Crear nuevo detalle
      await pool.query(
        `INSERT INTO "DetalleCuadreCaja" (
          id, cuadre_id, moneda_id, saldo_apertura, saldo_cierre, conteo_fisico,
          diferencia, billetes, monedas_fisicas, bancos_teorico, conteo_bancos, 
          diferencia_bancos, observaciones_detalle
        ) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          randomUUID(),
          cuadre_id,
          moneda_id,
          0, // saldo_apertura se calculará después
          saldoCierre,
          conteoFisicoTotal,
          diferencia,
          billetes,
          monedas_fisicas,
          0, // bancos_teorico
          conteo_bancos,
          diferenciaBancos,
          observaciones || null,
        ]
      );
    } else {
      // Actualizar detalle existente
      await pool.query(
        `UPDATE "DetalleCuadreCaja"
         SET conteo_fisico = $1,
             diferencia = $2,
             billetes = $3,
             monedas_fisicas = $4,
             conteo_bancos = $5,
             diferencia_bancos = $6,
             observaciones_detalle = COALESCE($7, observaciones_detalle),
             updated_at = NOW()
         WHERE id = $8::uuid`,
        [
          conteoFisicoTotal,
          diferencia,
          billetes,
          monedas_fisicas,
          conteo_bancos,
          diferenciaBancos,
          observaciones || null,
          detalleResult.rows[0].id,
        ]
      );
    }

    // Actualizar también el saldo físico en la tabla Saldo
    await pool.query(
      `UPDATE "Saldo"
       SET cantidad = $1,
           billetes = $2,
           monedas_fisicas = $3,
           bancos = $4,
           updated_at = NOW()
       WHERE punto_atencion_id = $5::uuid AND moneda_id = $6::uuid`,
      [conteoFisicoTotal, billetes, monedas_fisicas, conteo_bancos, cuadre.punto_atencion_id, moneda_id]
    );

    // Obtener info de la moneda para la respuesta
    const monedaResult = await pool.query(
      `SELECT codigo, nombre, simbolo FROM "Moneda" WHERE id = $1::uuid`,
      [moneda_id]
    );
    const moneda = monedaResult.rows[0];

    logger.info("✅ Conteo físico guardado", {
      cuadre_id,
      moneda_id,
      moneda_codigo: moneda?.codigo,
      diferencia,
      requiere_alerta: requiereAlerta,
    });

    res.json({
      success: true,
      data: {
        cuadre_id,
        moneda_id,
        moneda_codigo: moneda?.codigo,
        moneda_nombre: moneda?.nombre,
        moneda_simbolo: moneda?.simbolo,
        conteo_fisico: conteoFisicoTotal,
        billetes,
        monedas_fisicas,
        conteo_bancos,
        saldo_teorico: saldoCierre,
        diferencia,
        diferencia_bancos: diferenciaBancos,
        requiere_alerta: requiereAlerta,
        umbral_alerta: UMBRAL_DIFERENCIA_ALERTA,
      },
      alerta: requiereAlerta ? {
        tipo: Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA ? 'DIFERENCIA_EFECTIVO' : 'DIFERENCIA_BANCOS',
        mensaje: `La diferencia de $${Math.abs(diferencia).toFixed(2)} excede el umbral de $${UMBRAL_DIFERENCIA_ALERTA}. ` +
                 `Por favor revise los movimientos antes de cerrar.`,
        severidad: Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA * 2 ? 'CRITICA' : 'ADVERTENCIA',
      } : null,
    });

  } catch (error) {
    logger.error("❌ Error guardando conteo físico", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: usuario.id,
    });
    res.status(500).json({
      success: false,
      error: "Error al guardar conteo físico",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cuadre-caja/movimientos-auditoria
// Obtiene TODOS los movimientos del día para auditoría
// ═══════════════════════════════════════════════════════════════════════════
router.get("/movimientos-auditoria", authenticateToken, async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  
  try {
    const fechaParam = (req.query.fecha as string | undefined)?.trim();
    const fechaBase = fechaParam ? new Date(`${fechaParam}T00:00:00`) : new Date();
    const { gte, lt } = gyeDayRangeUtcFromDate(fechaBase);
    const puntoAtencionId = req.query.punto_atencion_id as string || usuario.punto_atencion_id;

    if (!puntoAtencionId) {
      return res.status(400).json({
        success: false,
        error: "Se requiere punto de atención",
      });
    }

    logger.info("🔍 Obteniendo movimientos para auditoría", {
      punto_atencion_id: puntoAtencionId,
      fecha_desde: gte,
      fecha_hasta: lt,
    });

    // 1. CAMBIOS DE DIVISA (Exchanges)
    const cambios = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
      include: {
        monedaOrigen: { select: { codigo: true, nombre: true, simbolo: true } },
        monedaDestino: { select: { codigo: true, nombre: true, simbolo: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const cambiosFormateados = cambios.map(c => ({
      tipo: 'CAMBIO_DIVISA',
      fecha: c.fecha.toISOString(),
      numero_recibo: c.numero_recibo,
      descripcion: `Cambio ${c.tipo_operacion}: ${c.monedaOrigen?.codigo} → ${c.monedaDestino?.codigo}`,
      monto_origen: Number(c.monto_origen),
      monto_destino: Number(c.monto_destino),
      moneda_origen: c.monedaOrigen?.codigo,
      moneda_destino: c.monedaDestino?.codigo,
      tasa: Number(c.tasa_cambio_billetes),
      estado: c.estado,
    }));

    // 2. SERVICIOS EXTERNOS
    const serviciosExternos = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
      include: {
        moneda: { select: { codigo: true, nombre: true, simbolo: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const serviciosFormateados = serviciosExternos.map(s => ({
      tipo: 'SERVICIO_EXTERNO',
      fecha: s.fecha.toISOString(),
      descripcion: `${s.tipo_movimiento}: ${s.servicio}`,
      monto: Number(s.monto),
      moneda: s.moneda?.codigo,
      servicio: s.servicio,
      tipo_movimiento: s.tipo_movimiento,
      numero_referencia: s.numero_referencia,
    }));

    // 3. TRANSFERENCIAS (entrantes y salientes)
    const transferencias = await prisma.transferencia.findMany({
      where: {
        OR: [
          { origen_id: puntoAtencionId },
          { destino_id: puntoAtencionId },
        ],
        fecha: { gte: new Date(gte), lt: new Date(lt) },
        estado: { in: ['COMPLETADO', 'APROBADO'] },
      },
      include: {
        moneda: { select: { codigo: true, nombre: true, simbolo: true } },
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const transferenciasFormateadas = transferencias.map(t => {
      const esEntrada = t.destino_id === puntoAtencionId;
      return {
        tipo: 'TRANSFERENCIA',
        fecha: t.fecha.toISOString(),
        descripcion: `Transferencia ${esEntrada ? 'entrante' : 'saliente'}: ${esEntrada ? t.origen?.nombre : t.destino?.nombre}`,
        monto: Number(t.monto),
        moneda: t.moneda?.codigo,
        direccion: esEntrada ? 'ENTRADA' : 'SALIDA',
        estado: t.estado,
        numero_recibo: t.numero_recibo,
      };
    });

    // 4. GUÍAS SERVIENTREGA
    const guias = await prisma.servientregaGuia.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        created_at: { gte: new Date(gte), lt: new Date(lt) },
        estado: { not: 'CANCELADO' },
      },
      orderBy: { created_at: "desc" },
    });

    const guiasFormateadas = guias.map(g => ({
      tipo: 'GUIA_SERVIENTREGA',
      fecha: g.created_at.toISOString(),
      descripcion: `Guía Servientrega: ${g.numero_guia}`,
      monto: Number(g.valor_declarado || 0) + Number(g.costo_envio || 0),
      moneda: 'USD',
      numero_guia: g.numero_guia,
      proceso: g.proceso,
      estado: g.estado,
    }));

    // 5. MOVIMIENTOS DE SALDO (MovimientoSaldo)
    const movimientosSaldo = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoAtencionId,
        fecha: { gte: new Date(gte), lt: new Date(lt) },
      },
      include: {
        moneda: { select: { codigo: true, nombre: true, simbolo: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const movimientosFormateados = movimientosSaldo.map(m => ({
      tipo: 'MOVIMIENTO_SALDO',
      fecha: m.fecha.toISOString(),
      descripcion: m.descripcion || `Movimiento ${m.tipo_movimiento}`,
      monto: Number(m.monto),
      moneda: m.moneda?.codigo,
      tipo_movimiento: m.tipo_movimiento,
      tipo_referencia: m.tipo_referencia,
    }));

    // Combinar y ordenar todos los movimientos
    const todosMovimientos = [
      ...cambiosFormateados,
      ...serviciosFormateados,
      ...transferenciasFormateadas,
      ...guiasFormateadas,
      ...movimientosFormateados,
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Calcular totales por tipo
    const totalesPorTipo = {
      cambios_divisa: cambiosFormateados.length,
      servicios_externos: serviciosFormateados.length,
      transferencias: transferenciasFormateadas.length,
      guias_servientrega: guiasFormateadas.length,
      movimientos_saldo: movimientosFormateados.length,
      total: todosMovimientos.length,
    };

    logger.info("✅ Movimientos obtenidos", {
      total: todosMovimientos.length,
      por_tipo: totalesPorTipo,
    });

    res.json({
      success: true,
      data: {
        periodo: {
          desde: gte,
          hasta: lt,
        },
        punto_atencion_id: puntoAtencionId,
        totales: totalesPorTipo,
        movimientos: todosMovimientos,
      },
    });

  } catch (error) {
    logger.error("❌ Error obteniendo movimientos de auditoría", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: usuario.id,
    });
    res.status(500).json({
      success: false,
      error: "Error al obtener movimientos",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/cuadre-caja/validar
// Valida el cuadre antes de cerrar y detecta discrepancias
// ═══════════════════════════════════════════════════════════════════════════
router.post("/validar", authenticateToken, validate(validarCierreSchema), async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  
  try {
    const { cuadre_id, forzar = false } = req.body;

    logger.info("🔍 Validando cuadre antes de cierre", {
      cuadre_id,
      usuario_id: usuario.id,
      forzar,
    });

    // Obtener todos los detalles del cuadre
    const detallesResult = await pool.query(
      `SELECT dc.*, m.codigo as moneda_codigo, m.nombre as moneda_nombre, m.simbolo as moneda_simbolo
       FROM "DetalleCuadreCaja" dc
       JOIN "Moneda" m ON dc.moneda_id = m.id::text
       WHERE dc.cuadre_id = $1::uuid`,
      [cuadre_id]
    );

    if (detallesResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No se encontraron detalles para este cuadre",
      });
    }

    const discrepancias: Array<{
      moneda_id: string;
      moneda_codigo: string;
      moneda_nombre: string;
      tipo: string;
      diferencia: number;
      severidad: 'CRITICA' | 'ADVERTENCIA' | 'INFO';
      mensaje: string;
    }> = [];

    let puedeCerrar = true;
    let totalDiferencias = 0;

    for (const detalle of detallesResult.rows) {
      const diferencia = Number(detalle.diferencia) || 0;
      const diferenciaBancos = Number(detalle.diferencia_bancos) || 0;

      // Verificar diferencia en efectivo
      if (Math.abs(diferencia) > 0) {
        totalDiferencias += Math.abs(diferencia);
        
        if (Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA) {
          puedeCerrar = false;
          discrepancias.push({
            moneda_id: detalle.moneda_id,
            moneda_codigo: detalle.moneda_codigo,
            moneda_nombre: detalle.moneda_nombre,
            tipo: 'DIFERENCIA_EFECTIVO',
            diferencia: diferencia,
            severidad: Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA * 2 ? 'CRITICA' : 'ADVERTENCIA',
            mensaje: `Diferencia en efectivo de $${Math.abs(diferencia).toFixed(2)} ${detalle.moneda_codigo}. ` +
                     `${diferencia > 0 ? 'Sobrante' : 'Faltante'} detectado.`,
          });
        } else {
          discrepancias.push({
            moneda_id: detalle.moneda_id,
            moneda_codigo: detalle.moneda_codigo,
            moneda_nombre: detalle.moneda_nombre,
            tipo: 'DIFERENCIA_EFECTIVO_MINIMA',
            diferencia: diferencia,
            severidad: 'INFO',
            mensaje: `Diferencia mínima de $${Math.abs(diferencia).toFixed(2)} ${detalle.moneda_codigo} (dentro de tolerancia).`,
          });
        }
      }

      // Verificar diferencia en bancos
      if (Math.abs(diferenciaBancos) > 0) {
        totalDiferencias += Math.abs(diferenciaBancos);
        
        if (Math.abs(diferenciaBancos) > UMBRAL_DIFERENCIA_ALERTA) {
          puedeCerrar = false;
          discrepancias.push({
            moneda_id: detalle.moneda_id,
            moneda_codigo: detalle.moneda_codigo,
            moneda_nombre: detalle.moneda_nombre,
            tipo: 'DIFERENCIA_BANCOS',
            diferencia: diferenciaBancos,
            severidad: Math.abs(diferenciaBancos) > UMBRAL_DIFERENCIA_ALERTA * 2 ? 'CRITICA' : 'ADVERTENCIA',
            mensaje: `Diferencia en bancos de $${Math.abs(diferenciaBancos).toFixed(2)} ${detalle.moneda_codigo}.`,
          });
        }
      }

      // Verificar que el conteo físico no sea cero cuando hay movimientos
      if (detalle.movimientos_periodo > 0 && Number(detalle.conteo_fisico) === 0) {
        puedeCerrar = false;
        discrepancias.push({
          moneda_id: detalle.moneda_id,
          moneda_codigo: detalle.moneda_codigo,
          moneda_nombre: detalle.moneda_nombre,
          tipo: 'CONTEO_FISICO_VACIO',
          diferencia: 0,
          severidad: 'CRITICA',
          mensaje: `No se ha registrado conteo físico para ${detalle.moneda_codigo} pero existen ${detalle.movimientos_periodo} movimientos.`,
        });
      }
    }

    // Si se fuerza el cierre, permitir aunque haya discrepancias (solo para admin)
    const esAdmin = ['ADMIN', 'SUPER_USUARIO'].includes((req.user as any)?.rol || '');
    if (forzar && esAdmin) {
      puedeCerrar = true;
    }

    // Ordenar discrepancias por severidad
    const severidadOrden = { CRITICA: 0, ADVERTENCIA: 1, INFO: 2 };
    discrepancias.sort((a, b) => severidadOrden[a.severidad] - severidadOrden[b.severidad]);

    logger.info("✅ Validación de cuadre completada", {
      cuadre_id,
      puede_cerrar: puedeCerrar,
      total_discrepancias: discrepancias.length,
      discrepancias_criticas: discrepancias.filter(d => d.severidad === 'CRITICA').length,
    });

    res.json({
      success: true,
      data: {
        cuadre_id,
        puede_cerrar: puedeCerrar,
        forzado: forzar && esAdmin,
        umbral_alerta: UMBRAL_DIFERENCIA_ALERTA,
        total_diferencias: totalDiferencias,
        resumen: {
          total_discrepancias: discrepancias.length,
          criticas: discrepancias.filter(d => d.severidad === 'CRITICA').length,
          advertencias: discrepancias.filter(d => d.severidad === 'ADVERTENCIA').length,
          info: discrepancias.filter(d => d.severidad === 'INFO').length,
        },
        discrepancias,
        mensaje: puedeCerrar 
          ? 'El cuadre puede cerrarse. Revise las observaciones antes de continuar.'
          : 'Existen discrepancias que deben resolverse antes de cerrar. Revise los movimientos o contacte al administrador.',
      },
    });

  } catch (error) {
    logger.error("❌ Error validando cuadre", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: usuario.id,
    });
    res.status(500).json({
      success: false,
      error: "Error al validar cuadre",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cuadre-caja/detalles/:cuadreId
// Obtiene los detalles completos de un cuadre con alertas
// ═══════════════════════════════════════════════════════════════════════════
router.get("/detalles/:cuadreId", authenticateToken, async (req, res) => {
  const usuario = req.user as UsuarioAutenticado;
  
  try {
    const { cuadreId } = req.params;

    const detallesResult = await pool.query(
      `SELECT dc.*, m.codigo as moneda_codigo, m.nombre as moneda_nombre, m.simbolo as moneda_simbolo
       FROM "DetalleCuadreCaja" dc
       JOIN "Moneda" m ON dc.moneda_id = m.id::text
       WHERE dc.cuadre_id = $1::uuid
       ORDER BY m.codigo ASC`,
      [cuadreId]
    );

    const detallesConAlertas = detallesResult.rows.map(detalle => {
      const diferencia = Number(detalle.diferencia) || 0;
      const diferenciaBancos = Number(detalle.diferencia_bancos) || 0;
      
      return {
        id: detalle.id,
        moneda_id: detalle.moneda_id,
        moneda_codigo: detalle.moneda_codigo,
        moneda_nombre: detalle.moneda_nombre,
        moneda_simbolo: detalle.moneda_simbolo,
        saldo_apertura: Number(detalle.saldo_apertura),
        saldo_cierre: Number(detalle.saldo_cierre),
        conteo_fisico: Number(detalle.conteo_fisico),
        billetes: Number(detalle.billetes),
        monedas_fisicas: Number(detalle.monedas_fisicas),
        bancos_teorico: Number(detalle.bancos_teorico),
        conteo_bancos: Number(detalle.conteo_bancos),
        diferencia,
        diferencia_bancos: diferenciaBancos,
        movimientos_periodo: detalle.movimientos_periodo,
        observaciones: detalle.observaciones_detalle,
        alertas: {
          diferencia_efectivo: Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA,
          diferencia_bancos: Math.abs(diferenciaBancos) > UMBRAL_DIFERENCIA_ALERTA,
          severidad: Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA * 2 ? 'CRITICA' : 
                     Math.abs(diferencia) > UMBRAL_DIFERENCIA_ALERTA ? 'ADVERTENCIA' : 'OK',
        },
      };
    });

    res.json({
      success: true,
      data: {
        cuadre_id: cuadreId,
        umbral_alerta: UMBRAL_DIFERENCIA_ALERTA,
        detalles: detallesConAlertas,
      },
    });

  } catch (error) {
    logger.error("❌ Error obteniendo detalles del cuadre", {
      error: error instanceof Error ? error.message : String(error),
      usuario_id: usuario.id,
    });
    res.status(500).json({
      success: false,
      error: "Error al obtener detalles",
    });
  }
});

export default router;
