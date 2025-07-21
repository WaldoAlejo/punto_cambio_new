
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";
import logger from "../utils/logger.js";

const router = express.Router();
const prisma = new PrismaClient();

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
    const cuadre = await prisma.cuadreCaja.findFirst({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: {
          gte: hoy,
        },
        estado: "ABIERTO",
      },
      include: {
        detalles: {
          include: {
            moneda: true,
          },
        },
      },
    });

    // Obtener jornada activa para calcular período
    const jornadaActiva = await prisma.jornada.findFirst({
      where: {
        usuario_id: usuario.id,
        punto_atencion_id: usuario.punto_atencion_id,
        estado: "ACTIVO",
      },
      orderBy: {
        fecha_inicio: 'desc'
      }
    });

    const fechaInicio = jornadaActiva?.fecha_inicio || hoy;

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
    const cambiosHoy = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "COMPLETADO",
      },
      select: {
        id: true,
        moneda_origen_id: true,
        moneda_destino_id: true,
        monto_origen: true,
        monto_destino: true,
        fecha: true,
        estado: true,
      },
    });

    // Obtener transferencias del período
    const transferenciasEntrada = await prisma.transferencia.findMany({
      where: {
        destino_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "APROBADA",
      },
      select: {
        id: true,
        monto: true,
        moneda_id: true,
        tipo_transferencia: true,
      },
    });

    const transferenciasSalida = await prisma.transferencia.findMany({
      where: {
        origen_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "APROBADA",
      },
      select: {
        id: true,
        monto: true,
        moneda_id: true,
        tipo_transferencia: true,
      },
    });

    // TEMPORAL: También obtener cambios pendientes para debug
    const cambiosPendientes = await prisma.cambioDivisa.findMany({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "PENDIENTE",
      },
      select: {
        id: true,
        moneda_origen_id: true,
        moneda_destino_id: true,
        monto_origen: true,
        monto_destino: true,
        fecha: true,
        estado: true,
      },
    });

    console.log("💱 Cambios COMPLETADOS:", {
      total: cambiosHoy.length,
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

    console.log("⏳ Cambios PENDIENTES:", {
      total: cambiosPendientes.length,
      cambios: cambiosPendientes.map(c => ({
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
      entrada: transferenciasEntrada.length,
      salida: transferenciasSalida.length
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
            transferencias_entrada: transferenciasEntrada.length,
            transferencias_salida: transferenciasSalida.length,
          },
        },
      });
    }

    // Obtener información de las monedas utilizadas
    const monedas = await prisma.moneda.findMany({
      where: {
        id: {
          in: Array.from(monedasUsadas),
        },
        activo: true,
      },
      orderBy: {
        orden_display: 'asc'
      }
    });

    // Calcular movimientos para cada moneda
    const detallesConValores = await Promise.all(
      monedas.map(async (moneda) => {
        const detalle = cuadre?.detalles.find((d) => d.moneda_id === moneda.id);
        
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
          .reduce((sum, c) => sum + Number(c.monto_destino), 0);

        // EGRESOS: cuando esta moneda es la que SE ENTREGA (moneda_origen)
        const egresos = cambiosHoy
          .filter(c => c.moneda_origen_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_origen), 0);

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
          ).length,
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
          cambios: cambiosHoy.length,
          transferencias_entrada: transferenciasEntrada.length,
          transferencias_salida: transferenciasSalida.length,
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
    console.log(`🔍 Calculando saldo apertura para punto ${puntoAtencionId}, moneda ${monedaId}, fecha ${fecha}`);
    
    // 1. Buscar el último cierre anterior
    const ultimoCierre = await prisma.detalleCuadreCaja.findFirst({
      include: {
        cuadre: true,
      },
      where: {
        moneda_id: monedaId,
        cuadre: {
          punto_atencion_id: puntoAtencionId,
          estado: {
            in: ["CERRADO", "PARCIAL"],
          },
          fecha: {
            lt: fecha,
          },
        },
      },
      orderBy: {
        cuadre: {
          fecha: "desc",
        },
      },
    });

    if (ultimoCierre) {
      console.log(`✅ Último cierre encontrado: ${ultimoCierre.conteo_fisico}`);
      return Number(ultimoCierre.conteo_fisico);
    }

    // 2. Si no hay cierre anterior, buscar saldo inicial actual
    const saldoInicial = await prisma.saldo.findFirst({
      where: {
        punto_atencion_id: puntoAtencionId,
        moneda_id: monedaId,
      },
    });

    if (saldoInicial) {
      console.log(`✅ Saldo inicial encontrado: ${saldoInicial.cantidad}`);
      return Number(saldoInicial.cantidad);
    }

    console.log(`⚠️ No se encontró saldo apertura, usando 0`);
    return 0;
  } catch (error) {
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
    const jornadaActiva = await prisma.jornada.findFirst({
      where: {
        usuario_id: usuario.id,
        punto_atencion_id: usuario.punto_atencion_id,
        estado: "ACTIVO",
      },
      orderBy: {
        fecha_inicio: 'desc'
      }
    });

    const fechaInicio = jornadaActiva?.fecha_inicio || new Date();
    fechaInicio.setHours(0, 0, 0, 0);

    // Calcular totales del período
    const totalCambios = await prisma.cambioDivisa.count({
      where: {
        punto_atencion_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "COMPLETADO",
      },
    });

    const totalTransferenciasEntrada = await prisma.transferencia.count({
      where: {
        destino_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "APROBADA",
      },
    });

    const totalTransferenciasSalida = await prisma.transferencia.count({
      where: {
        origen_id: usuario.punto_atencion_id,
        fecha: {
          gte: fechaInicio,
        },
        estado: "APROBADA",
      },
    });

    // Crear el cuadre principal
    const cuadre = await prisma.cuadreCaja.create({
      data: {
        usuario_id: usuario.id,
        punto_atencion_id: usuario.punto_atencion_id,
        estado: "CERRADO",
        observaciones: observaciones || null,
        fecha_cierre: new Date(),
        total_cambios: totalCambios,
        total_transferencias_entrada: totalTransferenciasEntrada,
        total_transferencias_salida: totalTransferenciasSalida,
      },
    });

    // Crear los detalles del cuadre
    const detallePromises = detalles.map((detalle: any) =>
      prisma.detalleCuadreCaja.create({
        data: {
          cuadre_id: cuadre.id,
          moneda_id: detalle.moneda_id,
          saldo_apertura: detalle.saldo_apertura || 0,
          saldo_cierre: detalle.saldo_cierre || 0,
          conteo_fisico: detalle.conteo_fisico || 0,
          billetes: detalle.billetes || 0,
          monedas_fisicas: detalle.monedas || 0,
          diferencia: (detalle.conteo_fisico || 0) - (detalle.saldo_cierre || 0),
          movimientos_periodo: detalle.movimientos_periodo || 0,
        },
      })
    );

    await Promise.all(detallePromises);

    // Obtener el cuadre completo
    const cuadreCompleto = await prisma.cuadreCaja.findUnique({
      where: { id: cuadre.id },
      include: {
        detalles: {
          include: {
            moneda: true,
          },
        },
        usuario: {
          select: {
            nombre: true,
            username: true,
          },
        },
      },
    });

    logger.info("Cuadre de caja guardado exitosamente", {
      cuadreId: cuadre.id,
      usuario_id: usuario.id,
      punto_atencion_id: usuario.punto_atencion_id,
    });

    res.status(201).json({
      success: true,
      cuadre: cuadreCompleto,
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
