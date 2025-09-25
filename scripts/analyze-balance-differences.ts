#!/usr/bin/env tsx

/**
 * Script de Análisis de Diferencias en Balances
 *
 * Este script analiza en detalle las diferencias encontradas en el recálculo
 * para identificar las causas raíz de las inconsistencias.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:admin@localhost:5432/punto_cambio_new",
    },
  },
});

interface BalanceAnalysis {
  punto: string;
  moneda: string;
  balanceActual: number;
  balanceCalculado: number;
  diferencia: number;
  movimientos: Array<{
    tipo: string;
    monto: number;
    fecha: Date;
    descripcion: string;
  }>;
}

async function analyzeBalanceDifferences() {
  console.log("🔍 Analizando diferencias en balances...\n");

  // Obtener monedas con diferencias significativas
  const monedasProblematicas = ["USD", "COP", "EUR", "TRY", "CRC"];

  for (const codigoMoneda of monedasProblematicas) {
    console.log(`\n📊 ANÁLISIS DETALLADO - ${codigoMoneda}`);
    console.log("=".repeat(50));

    const moneda = await prisma.moneda.findFirst({
      where: { codigo: codigoMoneda },
    });

    if (!moneda) {
      console.log(`❌ Moneda ${codigoMoneda} no encontrada`);
      continue;
    }

    // Obtener todos los balances actuales para esta moneda
    const balancesActuales = await prisma.saldo.findMany({
      where: { moneda_id: moneda.id },
      include: {
        puntoAtencion: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    for (const balance of balancesActuales) {
      console.log(
        `\n🏢 ${balance.puntoAtencion.nombre} - ${balance.moneda.codigo}`
      );
      console.log(
        `   Balance actual: ${Number(balance.cantidad).toLocaleString()}`
      );

      // Recalcular balance paso a paso
      let balanceCalculado = 0;
      const movimientos: any[] = [];

      // 1. Saldos iniciales
      const saldosIniciales = await prisma.saldoInicial.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          activo: true,
        },
        orderBy: { fecha_asignacion: "asc" },
      });

      for (const saldo of saldosIniciales) {
        const monto = Number(saldo.cantidad_inicial);
        balanceCalculado += monto;
        movimientos.push({
          tipo: "SALDO_INICIAL",
          monto,
          fecha: saldo.fecha_asignacion,
          descripcion: `Saldo inicial: ${saldo.observaciones || ""}`,
        });
      }

      // 2. Cambios de divisas - INGRESOS (moneda origen)
      const cambiosIngreso = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_origen_id: balance.moneda_id,
        },
        orderBy: { fecha: "asc" },
      });

      for (const cambio of cambiosIngreso) {
        const monto = Number(cambio.divisas_entregadas_total || 0);
        balanceCalculado += monto;
        movimientos.push({
          tipo: `CAMBIO_INGRESO_${cambio.tipo_operacion}`,
          monto,
          fecha: cambio.fecha,
          descripcion: `Recibo: ${
            cambio.numero_recibo
          } - Cliente entregó ${monto.toLocaleString()}`,
        });
      }

      // 3. Cambios de divisas - EGRESOS (moneda destino)
      const cambiosEgreso = await prisma.cambioDivisa.findMany({
        where: {
          punto_atencion_id: balance.punto_atencion_id,
          moneda_destino_id: balance.moneda_id,
        },
        orderBy: { fecha: "asc" },
      });

      for (const cambio of cambiosEgreso) {
        const monto = Number(cambio.divisas_recibidas_total || 0);
        balanceCalculado -= monto;
        movimientos.push({
          tipo: `CAMBIO_EGRESO_${cambio.tipo_operacion}`,
          monto: -monto,
          fecha: cambio.fecha,
          descripcion: `Recibo: ${
            cambio.numero_recibo
          } - Entregamos ${monto.toLocaleString()}`,
        });
      }

      // 4. Transferencias - SALIDAS
      const transferenciasEgreso = await prisma.transferencia.findMany({
        where: {
          origen_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "APROBADO",
        },
        include: {
          destino: { select: { nombre: true } },
        },
        orderBy: { fecha: "asc" },
      });

      for (const transferencia of transferenciasEgreso) {
        const monto = Number(transferencia.monto);
        balanceCalculado -= monto;
        movimientos.push({
          tipo: "TRANSFERENCIA_SALIDA",
          monto: -monto,
          fecha: transferencia.fecha,
          descripcion: `Enviado a ${transferencia.destino.nombre}: ${
            transferencia.descripcion || ""
          }`,
        });
      }

      // 5. Transferencias - ENTRADAS
      const transferenciasIngreso = await prisma.transferencia.findMany({
        where: {
          destino_id: balance.punto_atencion_id,
          moneda_id: balance.moneda_id,
          estado: "APROBADO",
        },
        include: {
          origen: { select: { nombre: true } },
        },
        orderBy: { fecha: "asc" },
      });

      for (const transferencia of transferenciasIngreso) {
        const monto = Number(transferencia.monto);
        balanceCalculado += monto;
        movimientos.push({
          tipo: "TRANSFERENCIA_ENTRADA",
          monto,
          fecha: transferencia.fecha,
          descripcion: `Recibido de ${transferencia.origen?.nombre || "N/A"}: ${
            transferencia.descripcion || ""
          }`,
        });
      }

      // 6. Servicios externos
      const serviciosExternos = await prisma.servicioExternoMovimiento.findMany(
        {
          where: {
            punto_atencion_id: balance.punto_atencion_id,
            moneda_id: balance.moneda_id,
          },
          orderBy: { fecha: "asc" },
        }
      );

      for (const servicio of serviciosExternos) {
        const monto = Number(servicio.monto);
        const montoFinal =
          servicio.tipo_movimiento === "EGRESO" ? -monto : monto;
        balanceCalculado += montoFinal;
        movimientos.push({
          tipo: `SERVICIO_${servicio.servicio}`,
          monto: montoFinal,
          fecha: servicio.fecha,
          descripcion: `${servicio.tipo_movimiento} - ${servicio.servicio}: ${
            servicio.descripcion || ""
          }`,
        });
      }

      const diferencia = balanceCalculado - Number(balance.cantidad);

      console.log(`   Balance calculado: ${balanceCalculado.toLocaleString()}`);
      console.log(`   Diferencia: ${diferencia.toLocaleString()}`);

      if (Math.abs(diferencia) > 0.01) {
        console.log(`   ⚠️  DIFERENCIA SIGNIFICATIVA`);

        // Mostrar últimos 5 movimientos
        console.log(`   📋 Últimos movimientos:`);
        const ultimosMovimientos = movimientos.slice(-5);
        for (const mov of ultimosMovimientos) {
          const signo = mov.monto >= 0 ? "+" : "";
          console.log(
            `     • ${mov.fecha.toISOString().split("T")[0]} - ${
              mov.tipo
            }: ${signo}${mov.monto.toLocaleString()}`
          );
          console.log(`       ${mov.descripcion}`);
        }

        // Análisis por tipo de movimiento
        console.log(`   📊 Resumen por tipo:`);
        const resumenTipos = new Map<string, number>();
        for (const mov of movimientos) {
          const tipoBase = mov.tipo.split("_")[0];
          resumenTipos.set(
            tipoBase,
            (resumenTipos.get(tipoBase) || 0) + mov.monto
          );
        }

        for (const [tipo, total] of resumenTipos.entries()) {
          const signo = total >= 0 ? "+" : "";
          console.log(`     ${tipo}: ${signo}${total.toLocaleString()}`);
        }
      } else {
        console.log(`   ✅ Balance correcto`);
      }
    }
  }

  // Análisis de campos específicos que podrían estar causando problemas
  console.log(`\n\n🔍 ANÁLISIS DE CAMPOS ESPECÍFICOS`);
  console.log("=".repeat(50));

  // Verificar si hay cambios con campos USD específicos
  const cambiosConUSD = await prisma.cambioDivisa.findMany({
    where: {
      OR: [
        { usd_entregado_efectivo: { not: null } },
        { usd_entregado_transfer: { not: null } },
      ],
    },
    include: {
      puntoAtencion: { select: { nombre: true } },
      monedaOrigen: { select: { codigo: true } },
      monedaDestino: { select: { codigo: true } },
    },
  });

  if (cambiosConUSD.length > 0) {
    console.log(
      `\n💵 Cambios con campos USD específicos: ${cambiosConUSD.length}`
    );
    for (const cambio of cambiosConUSD.slice(0, 5)) {
      console.log(
        `   • ${cambio.puntoAtencion.nombre} - ${cambio.numero_recibo}`
      );
      console.log(
        `     ${cambio.monedaOrigen.codigo} → ${cambio.monedaDestino.codigo}`
      );
      console.log(
        `     USD Efectivo: ${Number(
          cambio.usd_entregado_efectivo || 0
        ).toLocaleString()}`
      );
      console.log(
        `     USD Transfer: ${Number(
          cambio.usd_entregado_transfer || 0
        ).toLocaleString()}`
      );
      console.log(
        `     Divisas Recibidas Total: ${Number(
          cambio.divisas_recibidas_total
        ).toLocaleString()}`
      );
    }
  }

  // Verificar cambios con saldo pendiente
  const cambiosConSaldoPendiente = await prisma.cambioDivisa.findMany({
    where: {
      saldo_pendiente: { not: null, gt: 0 },
    },
    include: {
      puntoAtencion: { select: { nombre: true } },
      monedaOrigen: { select: { codigo: true } },
      monedaDestino: { select: { codigo: true } },
    },
  });

  if (cambiosConSaldoPendiente.length > 0) {
    console.log(
      `\n⏳ Cambios con saldo pendiente: ${cambiosConSaldoPendiente.length}`
    );
    for (const cambio of cambiosConSaldoPendiente.slice(0, 5)) {
      console.log(
        `   • ${cambio.puntoAtencion.nombre} - ${cambio.numero_recibo}`
      );
      console.log(
        `     Saldo pendiente: ${Number(
          cambio.saldo_pendiente || 0
        ).toLocaleString()}`
      );
      console.log(`     Estado: ${cambio.estado}`);
    }
  }

  await prisma.$disconnect();
}

// Ejecutar análisis
analyzeBalanceDifferences().catch(console.error);
