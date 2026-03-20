/**
 * Endpoint temporal para debug de saldos
 * Acceder desde: /api/debug-saldos/:puntoId/:monedaId
 */

import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/:puntoId/:monedaId", async (req, res) => {
  try {
    const { puntoId, monedaId } = req.params;

    // 1. Saldo en tabla
    const saldoTabla = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: puntoId,
          moneda_id: monedaId,
        },
      },
    });

    // 2. Saldo inicial activo
    const saldoInicial = await prisma.saldoInicial.findFirst({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
        activo: true,
      },
    });

    // 3. Movimientos
    const movimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
      },
      orderBy: { fecha: "asc" },
    });

    // Calcular saldo desde movimientos
    let saldoCalculado = 0;
    let totalSaldoInicial = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;

    const movimientosConSaldo = movimientos.map((m) => {
      const desc = m.descripcion || "";
      const esBanco = /\bbancos?\b/i.test(desc.toLowerCase()) && !desc.toLowerCase().includes("(caja)");
      
      if (!esBanco) {
        saldoCalculado += Number(m.monto);
      }

      if (m.tipo_movimiento === "SALDO_INICIAL") {
        totalSaldoInicial += Number(m.monto);
      } else if (Number(m.monto) > 0) {
        totalIngresos += Number(m.monto);
      } else if (Number(m.monto) < 0) {
        totalEgresos += Math.abs(Number(m.monto));
      }

      return {
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        monto: Number(m.monto),
        saldoAcumulado: esBanco ? null : Number(saldoCalculado.toFixed(2)),
        esBanco,
        descripcion: desc.slice(0, 50),
      };
    });

    saldoCalculado = Number(saldoCalculado.toFixed(2));

    res.json({
      punto_atencion_id: puntoId,
      moneda_id: monedaId,
      resumen: {
        saldoEnTabla: Number(saldoTabla?.cantidad || 0),
        saldoCalculadoDesdeMovs: saldoCalculado,
        diferencia: Number((Number(saldoTabla?.cantidad || 0) - saldoCalculado).toFixed(2)),
      },
      detalleTabla: {
        cantidad: Number(saldoTabla?.cantidad || 0),
        billetes: Number(saldoTabla?.billetes || 0),
        monedas_fisicas: Number(saldoTabla?.monedas_fisicas || 0),
        bancos: Number(saldoTabla?.bancos || 0),
        updated_at: saldoTabla?.updated_at,
      },
      saldoInicial: {
        cantidad_inicial: Number(saldoInicial?.cantidad_inicial || 0),
        fecha_asignacion: saldoInicial?.fecha_asignacion,
        activo: saldoInicial?.activo,
      },
      totalesMovimientos: {
        totalSaldoInicial,
        totalIngresos,
        totalEgresos,
        saldoNeto: totalSaldoInicial + totalIngresos - totalEgresos,
      },
      ultimosMovimientos: movimientosConSaldo.slice(-10),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
