import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { PrismaClient, Decimal } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

interface BalanceMoneda {
  monedaId: string;
  codigo: string;
  nombre: string;
  balance: Decimal;
  detalles: {
    cambiosDivisasOrigen: Decimal;
    cambiosDivisasDestino: Decimal;
    serviciosExternosIngresos: Decimal;
    serviciosExternosEgresos: Decimal;
    transferenciasNetas: Decimal;
  };
}

interface ResumenGeneral {
  totalCambiosDivisas: number;
  totalServiciosExternos: number;
  totalTransferencias: number;
  totalPuntosActivos: number;
  totalMonedasActivas: number;
}

interface BalancePorPunto {
  punto: string;
  puntoId: string;
  cambiosDivisas: number;
  serviciosExternos: number;
  transferenciasOrigen: number;
  transferenciasDestino: number;
  totalMovimientos: number;
}

// GET /api/balance-completo - Balance completo del sistema
router.get("/", authenticateToken, async (req, res) => {
  try {
    console.log("🔍 Calculando balance completo del sistema...");

    // 1. Resumen general
    const [
      cambiosDivisas,
      serviciosExternos,
      transferencias,
      puntosActivos,
      monedasActivas,
    ] = await Promise.all([
      prisma.cambioDivisa.count({
        where: { estado: "COMPLETADO" },
      }),
      prisma.servicioExternoMovimiento.count(),
      prisma.transferencia.count({
        where: { estado: "APROBADO" },
      }),
      prisma.puntoAtencion.count({
        where: { activo: true },
      }),
      prisma.moneda.count({
        where: { activo: true },
      }),
    ]);

    const resumenGeneral: ResumenGeneral = {
      totalCambiosDivisas: cambiosDivisas,
      totalServiciosExternos: serviciosExternos,
      totalTransferencias: transferencias,
      totalPuntosActivos: puntosActivos,
      totalMonedasActivas: monedasActivas,
    };

    // 2. Balance por moneda
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { codigo: "asc" },
    });

    const balancesPorMoneda: BalanceMoneda[] = [];

    for (const moneda of monedas) {
      // Cambios de divisas - moneda origen (salidas)
      const cambiosOrigen = await prisma.cambioDivisa.aggregate({
        where: {
          moneda_origen_id: moneda.id,
          estado: "COMPLETADO",
        },
        _sum: {
          monto_origen: true,
        },
      });

      // Cambios de divisas - moneda destino (entradas)
      const cambiosDestino = await prisma.cambioDivisa.aggregate({
        where: {
          moneda_destino_id: moneda.id,
          estado: "COMPLETADO",
        },
        _sum: {
          monto_destino: true,
        },
      });

      // Servicios externos - ingresos
      const serviciosIngresos =
        await prisma.servicioExternoMovimiento.aggregate({
          where: {
            moneda_id: moneda.id,
            tipo_movimiento: "INGRESO",
          },
          _sum: {
            monto: true,
          },
        });

      // Servicios externos - egresos
      const serviciosEgresos = await prisma.servicioExternoMovimiento.aggregate(
        {
          where: {
            moneda_id: moneda.id,
            tipo_movimiento: "EGRESO",
          },
          _sum: {
            monto: true,
          },
        }
      );

      // Calcular totales
      const cambiosDivisasOrigen =
        cambiosOrigen._sum.monto_origen || new Decimal(0);
      const cambiosDivisasDestino =
        cambiosDestino._sum.monto_destino || new Decimal(0);
      const serviciosExternosIngresos =
        serviciosIngresos._sum.monto || new Decimal(0);
      const serviciosExternosEgresos =
        serviciosEgresos._sum.monto || new Decimal(0);

      // Balance total = -salidas + entradas + ingresos - egresos
      const balance = cambiosDivisasDestino
        .minus(cambiosDivisasOrigen)
        .plus(serviciosExternosIngresos)
        .minus(serviciosExternosEgresos);

      // Solo incluir monedas con movimientos
      if (
        !balance.equals(0) ||
        !cambiosDivisasOrigen.equals(0) ||
        !cambiosDivisasDestino.equals(0) ||
        !serviciosExternosIngresos.equals(0) ||
        !serviciosExternosEgresos.equals(0)
      ) {
        balancesPorMoneda.push({
          monedaId: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          balance,
          detalles: {
            cambiosDivisasOrigen: cambiosDivisasOrigen.negated(), // Mostrar como negativo
            cambiosDivisasDestino,
            serviciosExternosIngresos,
            serviciosExternosEgresos: serviciosExternosEgresos.negated(), // Mostrar como negativo
            transferenciasNetas: new Decimal(0),
          },
        });
      }
    }

    // Ordenar por balance (mayor a menor)
    balancesPorMoneda.sort((a, b) => b.balance.minus(a.balance).toNumber());

    console.log(
      `✅ Balance calculado: ${balancesPorMoneda.length} monedas con movimientos`
    );

    res.json({
      success: true,
      data: {
        resumenGeneral,
        balancesPorMoneda: balancesPorMoneda.map((balance) => ({
          ...balance,
          balance: balance.balance.toNumber(),
          detalles: {
            cambiosDivisasOrigen:
              balance.detalles.cambiosDivisasOrigen.toNumber(),
            cambiosDivisasDestino:
              balance.detalles.cambiosDivisasDestino.toNumber(),
            serviciosExternosIngresos:
              balance.detalles.serviciosExternosIngresos.toNumber(),
            serviciosExternosEgresos:
              balance.detalles.serviciosExternosEgresos.toNumber(),
            transferenciasNetas:
              balance.detalles.transferenciasNetas.toNumber(),
          },
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error al calcular balance completo:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// GET /api/balance-completo/punto/:pointId - Balance completo por punto específico
router.get("/punto/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;
    console.log(`🔍 Calculando balance completo para punto: ${pointId}`);

    // Obtener información del punto
    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: pointId },
    });

    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Actividad del punto
    const [
      cambiosDivisas,
      serviciosExternos,
      transferenciasOrigen,
      transferenciasDestino,
    ] = await Promise.all([
      prisma.cambioDivisa.count({
        where: {
          punto_atencion_id: pointId,
          estado: "COMPLETADO",
        },
      }),
      prisma.servicioExternoMovimiento.count({
        where: {
          punto_atencion_id: pointId,
        },
      }),
      prisma.transferencia.count({
        where: {
          origen_id: pointId,
          estado: "APROBADO",
        },
      }),
      prisma.transferencia.count({
        where: {
          destino_id: pointId,
          estado: "APROBADO",
        },
      }),
    ]);

    const balancePorPunto: BalancePorPunto = {
      punto: punto.nombre,
      puntoId: punto.id,
      cambiosDivisas,
      serviciosExternos,
      transferenciasOrigen,
      transferenciasDestino,
      totalMovimientos:
        cambiosDivisas +
        serviciosExternos +
        transferenciasOrigen +
        transferenciasDestino,
    };

    console.log(
      `✅ Balance por punto calculado: ${balancePorPunto.totalMovimientos} movimientos totales`
    );

    res.json({
      success: true,
      data: {
        balancePorPunto,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error al calcular balance por punto:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
