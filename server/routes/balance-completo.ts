import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
import { Prisma } from "@prisma/client";

const router = express.Router();

type D = Prisma.Decimal;

interface BalanceMonedaRaw {
  monedaId: string;
  codigo: string;
  nombre: string;
  balance: D;
  detalles: {
    cambiosDivisasOrigen: D; // (salidas) se mostrará en negativo
    cambiosDivisasDestino: D; // (entradas)
    serviciosExternosIngresos: D;
    serviciosExternosEgresos: D; // se mostrará en negativo
    transferenciasNetas: D; // destino - origen
  };
}

interface ResumenGeneral {
  totalCambiosDivisas: number;
  totalServiciosExternos: number;
  totalTransferencias: number;
  totalPuntosActivos: number;
  totalMonedasActivas: number;
}

/** Helpers numéricos */
const d0 = () => new Prisma.Decimal(0);
const toNum = (x: D | null | undefined) => Number((x ?? d0()).toString());

/* ============================================================================
   GET /api/balance-completo
   Resumen general y balance por moneda (agregado sistema)
============================================================================ */
router.get("/", authenticateToken, async (req, res) => {
  try {
    logger.info("Calculando balance completo del sistema");

    // 1) Resumen general (paralelo)
    const [
      cambiosDivisas,
      serviciosExternos,
      transferencias,
      puntosActivos,
      monedasActivas,
    ] = await Promise.all([
      prisma.cambioDivisa.count({ where: { estado: "COMPLETADO" } }),
      prisma.servicioExternoMovimiento.count(),
      prisma.transferencia.count({ where: { estado: "APROBADO" } }),
      prisma.puntoAtencion.count({ where: { activo: true } }),
      prisma.moneda.count({ where: { activo: true } }),
    ]);

    const resumenGeneral: ResumenGeneral = {
      totalCambiosDivisas: cambiosDivisas,
      totalServiciosExternos: serviciosExternos,
      totalTransferencias: transferencias,
      totalPuntosActivos: puntosActivos,
      totalMonedasActivas: monedasActivas,
    };

    // 2) Balance por moneda (solo activas)
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true },
    });

    const balancesRaw: BalanceMonedaRaw[] = [];

    for (const moneda of monedas) {
      // Ejecutar agregados en paralelo para esta moneda
      const [
        // Cambios: moneda como ORIGEN (salida) y DESTINO (entrada)
        cambiosOrigenAgg,
        cambiosDestinoAgg,
        // Servicios externos: ingresos/egresos
        serviciosIngresosAgg,
        serviciosEgresosAgg,
        // Transferencias separadas
        sumDestAgg, // entradas por destino (destino_id es obligatorio en el schema)
        sumOrigAgg, // salidas por origen (origen_id nullable; filtramos no-nulo)
      ] = await Promise.all([
        prisma.cambioDivisa.aggregate({
          where: { moneda_origen_id: moneda.id, estado: "COMPLETADO" },
          _sum: { monto_origen: true },
        }),
        prisma.cambioDivisa.aggregate({
          where: { moneda_destino_id: moneda.id, estado: "COMPLETADO" },
          _sum: { monto_destino: true },
        }),
        prisma.servicioExternoMovimiento.aggregate({
          where: { moneda_id: moneda.id, tipo_movimiento: "INGRESO" },
          _sum: { monto: true },
        }),
        prisma.servicioExternoMovimiento.aggregate({
          where: { moneda_id: moneda.id, tipo_movimiento: "EGRESO" },
          _sum: { monto: true },
        }),
        // ➤ FIX 1: NO filtrar destino_id not null (campo no es null); basta por moneda/estado
        prisma.transferencia.aggregate({
          where: { estado: "APROBADO", moneda_id: moneda.id },
          _sum: { monto: true },
        }),
        // origen_id sí es nullable; filtramos explícitamente no-nulo
        prisma.transferencia.aggregate({
          where: {
            estado: "APROBADO",
            moneda_id: moneda.id,
            origen_id: { not: null },
          },
          _sum: { monto: true },
        }),
      ]);

      const cambiosDivisasOrigen = cambiosOrigenAgg._sum.monto_origen ?? d0();
      const cambiosDivisasDestino =
        cambiosDestinoAgg._sum.monto_destino ?? d0();
      const serviciosExternosIngresos = serviciosIngresosAgg._sum.monto ?? d0();
      const serviciosExternosEgresos = serviciosEgresosAgg._sum.monto ?? d0();

      // ➤ FIX 2: _sum puede ser undefined; usar optional chaining y nullish coalescing
      const transferIn = (sumDestAgg._sum?.monto as D | undefined) ?? d0();
      const transferOut = (sumOrigAgg._sum?.monto as D | undefined) ?? d0();
      const transferenciasNetas = transferIn.minus(transferOut); // destino - origen

      // Balance total = entradas - salidas
      const balance = cambiosDivisasDestino
        .plus(serviciosExternosIngresos)
        .plus(transferIn)
        .minus(cambiosDivisasOrigen)
        .minus(serviciosExternosEgresos)
        .minus(transferOut);

      // Incluir solo monedas con movimiento
      const hasMovement =
        !balance.equals(0) ||
        !cambiosDivisasOrigen.equals(0) ||
        !cambiosDivisasDestino.equals(0) ||
        !serviciosExternosIngresos.equals(0) ||
        !serviciosExternosEgresos.equals(0) ||
        !transferenciasNetas.equals(0);

      if (hasMovement) {
        balancesRaw.push({
          monedaId: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          balance,
          detalles: {
            cambiosDivisasOrigen, // lo mostraremos en negativo
            cambiosDivisasDestino,
            serviciosExternosIngresos,
            serviciosExternosEgresos, // lo mostraremos en negativo
            transferenciasNetas,
          },
        });
      }
    }

    // Ordenar por balance desc
    balancesRaw.sort((a, b) => b.balance.minus(a.balance).toNumber());

    res.json({
      success: true,
      data: {
        resumenGeneral,
        balancesPorMoneda: balancesRaw.map((b) => ({
          monedaId: b.monedaId,
          codigo: b.codigo,
          nombre: b.nombre,
          balance: toNum(b.balance),
          detalles: {
            // Mostrar salidas como negativas (convención visual)
            cambiosDivisasOrigen: -toNum(b.detalles.cambiosDivisasOrigen),
            cambiosDivisasDestino: toNum(b.detalles.cambiosDivisasDestino),
            serviciosExternosIngresos: toNum(
              b.detalles.serviciosExternosIngresos
            ),
            serviciosExternosEgresos: -toNum(
              b.detalles.serviciosExternosEgresos
            ),
            transferenciasNetas: toNum(b.detalles.transferenciasNetas),
          },
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error al calcular balance completo", { error });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/* ============================================================================
   GET /api/balance-completo/punto/:pointId
   Resumen de actividad por punto (conteos) + balance por moneda
   
   NOTA: El balance se calcula desde MovimientoSaldo (igual que el resto del sistema)
   para mantener consistencia con la Contabilidad de Divisas.
============================================================================ */
router.get("/punto/:pointId", authenticateToken, async (req, res) => {
  try {
    const { pointId } = req.params;
    logger.info("Calculando balance completo para punto", { pointId });

    const punto = await prisma.puntoAtencion.findUnique({
      where: { id: pointId },
      select: { id: true, nombre: true },
    });
    if (!punto) {
      return res.status(404).json({
        success: false,
        error: "Punto de atención no encontrado",
      });
    }

    // Conteos de actividad (solo para estadísticas)
    const [
      cambiosDivisas,
      serviciosExternos,
      transferenciasOrigen,
      transferenciasDestino,
    ] = await Promise.all([
      prisma.cambioDivisa.count({
        where: { punto_atencion_id: pointId, estado: "COMPLETADO" },
      }),
      prisma.servicioExternoMovimiento.count({
        where: { punto_atencion_id: pointId },
      }),
      prisma.transferencia.count({
        where: { origen_id: pointId, estado: "APROBADO" },
      }),
      prisma.transferencia.count({
        where: { destino_id: pointId, estado: "APROBADO" },
      }),
    ]);

    // Obtener saldo inicial activo por moneda
    const saldosIniciales = await prisma.saldoInicial.findMany({
      where: { punto_atencion_id: pointId, activo: true },
      select: { moneda_id: true, cantidad_inicial: true },
    });
    const saldoInicialMap = new Map(
      saldosIniciales.map((s) => [s.moneda_id, Number(s.cantidad_inicial)])
    );

    // Obtener todas las monedas que tienen saldo en este punto
    const monedas = await prisma.moneda.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, nombre: true },
    });

    // Calcular balance desde MovimientoSaldo (fuente única de verdad)
    const balancesPorMoneda = await Promise.all(
      monedas.map(async (moneda) => {
        const monedaId = moneda.id;

        // Obtener saldo inicial
        const saldoInicial = saldoInicialMap.get(monedaId) || 0;

        // Calcular desde MovimientoSaldo (igual que Contabilidad de Divisas)
        const movimientos = await prisma.movimientoSaldo.findMany({
          where: {
            punto_atencion_id: pointId,
            moneda_id: monedaId,
          },
          select: {
            tipo_movimiento: true,
            monto: true,
            descripcion: true,
          },
        });

        let balance = saldoInicial;
        let cambiosDivisasOrigen = 0;
        let cambiosDivisasDestino = 0;
        let serviciosExternosIngresos = 0;
        let serviciosExternosEgresos = 0;
        let transferenciasEntrada = 0;
        let transferenciasSalida = 0;

        for (const mov of movimientos) {
          const desc = (mov.descripcion || "").toLowerCase();
          const tipo = mov.tipo_movimiento;
          const monto = Number(mov.monto);

          // Ignorar movimientos bancarios
          if (/\bbancos?\b/i.test(desc) && !desc.includes("(caja)")) continue;

          // Calcular balance
          if (tipo === "SALDO_INICIAL") {
            // Ya está incluido en saldoInicial
          } else if (tipo === "EGRESO" || tipo === "TRANSFERENCIA_SALIENTE") {
            balance -= Math.abs(monto);
          } else if (tipo === "INGRESO" || tipo === "TRANSFERENCIA_ENTRANTE") {
            balance += Math.abs(monto);
          } else if (tipo === "AJUSTE") {
            balance += monto;
          } else {
            balance += monto;
          }

          // Clasificar para el desglose visual
          if (desc.includes("cambio") && desc.includes("origen")) {
            cambiosDivisasOrigen += Math.abs(monto);
          } else if (desc.includes("cambio") && desc.includes("destino")) {
            cambiosDivisasDestino += Math.abs(monto);
          } else if (desc.includes("servicio externo")) {
            if (tipo === "INGRESO") serviciosExternosIngresos += Math.abs(monto);
            else serviciosExternosEgresos += Math.abs(monto);
          } else if (tipo === "TRANSFERENCIA_ENTRANTE") {
            transferenciasEntrada += Math.abs(monto);
          } else if (tipo === "TRANSFERENCIA_SALIENTE") {
            transferenciasSalida += Math.abs(monto);
          } else if (!desc.includes("cambio")) {
            // Otros movimientos (servicios externos sin etiqueta específica)
            if (tipo === "INGRESO") serviciosExternosIngresos += Math.abs(monto);
            else if (tipo === "EGRESO") serviciosExternosEgresos += Math.abs(monto);
          }
        }

        const transferenciasNetas = transferenciasEntrada - transferenciasSalida;

        return {
          moneda_codigo: moneda.codigo,
          moneda_nombre: moneda.nombre,
          balance: Number(balance.toFixed(2)),
          detalles: {
            cambiosDivisasOrigen: -cambiosDivisasOrigen, // negativo para mostrar
            cambiosDivisasDestino,
            serviciosExternosIngresos,
            serviciosExternosEgresos: -serviciosExternosEgresos, // negativo para mostrar
            transferenciasNetas,
          },
        };
      })
    );

    // Filtrar solo monedas con movimiento
    const balancesConMovimiento = balancesPorMoneda.filter(
      (b) => 
        Math.abs(b.balance) > 0.01 ||
        Math.abs(b.detalles.cambiosDivisasOrigen) > 0.01 ||
        Math.abs(b.detalles.cambiosDivisasDestino) > 0.01 ||
        Math.abs(b.detalles.serviciosExternosIngresos) > 0.01 ||
        Math.abs(b.detalles.serviciosExternosEgresos) > 0.01 ||
        Math.abs(b.detalles.transferenciasNetas) > 0.01
    );

    res.json({
      success: true,
      data: {
        actividad: {
          cambiosDivisas,
          serviciosExternos,
          transferenciasOrigen,
          transferenciasDestino,
          totalMovimientos:
            cambiosDivisas +
            serviciosExternos +
            transferenciasOrigen +
            transferenciasDestino,
        },
        balancesPorMoneda: balancesConMovimiento,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error al calcular balance por punto", { error });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
