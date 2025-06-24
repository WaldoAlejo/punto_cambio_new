
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
        moneda_origen_id: true,
        moneda_destino_id: true,
        monto_origen: true,
        monto_destino: true,
      },
    });

    // Identificar monedas utilizadas
    const monedasUsadas = new Set<string>();
    cambiosHoy.forEach((cambio) => {
      monedasUsadas.add(cambio.moneda_origen_id);
      monedasUsadas.add(cambio.moneda_destino_id);
    });

    if (monedasUsadas.size === 0) {
      return res.status(200).json({
        success: true,
        data: {
          detalles: [],
          observaciones: "",
          mensaje: "No se han realizado cambios de divisa hoy",
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
          hoy
        );

        // Calcular movimientos del período
        const ingresos = cambiosHoy
          .filter(c => c.moneda_destino_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_destino), 0);

        const egresos = cambiosHoy
          .filter(c => c.moneda_origen_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_origen), 0);

        const saldoCierre = saldoApertura + ingresos - egresos;

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

    return ultimoCierre ? Number(ultimoCierre.conteo_fisico) : 0;
  } catch (error) {
    logger.error("Error calculando saldo apertura", { error });
    return 0;
  }
}

export default router;
