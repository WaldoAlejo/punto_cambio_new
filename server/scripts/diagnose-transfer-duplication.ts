/**
 * Script de diagnóstico para investigar duplicación de transferencias
 *
 * Este script analiza:
 * 1. Transferencias recientes de BOVEDA
 * 2. Movimientos de saldo asociados
 * 3. Actualizaciones de saldo en la tabla `saldo`
 * 4. Posibles duplicaciones
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnosticarTransferencias() {
  console.log("🔍 Iniciando diagnóstico de transferencias...\n");

  try {
    // 1. Buscar el punto BOVEDA
    const boveda = await prisma.puntoAtencion.findFirst({
      where: {
        nombre: {
          contains: "BOVEDA",
          mode: "insensitive",
        },
      },
    });

    if (!boveda) {
      console.log("❌ No se encontró el punto BOVEDA");
      return;
    }

    console.log(
      `✅ Punto BOVEDA encontrado: ${boveda.nombre} (ID: ${boveda.id})\n`
    );

    // 2. Buscar moneda EUR
    const eur = await prisma.moneda.findFirst({
      where: {
        codigo: "EUR",
      },
    });

    if (!eur) {
      console.log("❌ No se encontró la moneda EUR");
      return;
    }

    console.log(`✅ Moneda EUR encontrada (ID: ${eur.id})\n`);

    // 3. Obtener las últimas 10 transferencias desde BOVEDA
    console.log("📋 Últimas 10 transferencias desde BOVEDA:\n");
    const transferencias = await prisma.transferencia.findMany({
      where: {
        origen_id: boveda.id,
      },
      orderBy: {
        fecha: "desc",
      },
      take: 10,
      include: {
        origen: { select: { nombre: true } },
        destino: { select: { nombre: true } },
        moneda: { select: { codigo: true } },
      },
    });

    for (const t of transferencias) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Transferencia ID: ${t.id}`);
      console.log(`   Número Recibo: ${t.numero_recibo}`);
      console.log(`   Fecha: ${t.fecha.toISOString()}`);
      console.log(`   Origen: ${t.origen?.nombre || "N/A"}`);
      console.log(`   Destino: ${t.destino?.nombre || "N/A"}`);
      console.log(`   Moneda: ${t.moneda?.codigo || "N/A"}`);
      console.log(`   Monto: ${t.monto}`);
      console.log(`   Estado: ${t.estado}`);
      console.log(`   Vía: ${t.via || "N/A"}`);

      // 4. Buscar movimientos de saldo asociados a esta transferencia
      const movimientos = await prisma.movimientoSaldo.findMany({
        where: {
          referencia_id: t.id,
          tipo_referencia: "TRANSFER",
        },
        include: {
          puntoAtencion: { select: { nombre: true } },
          moneda: { select: { codigo: true } },
        },
        orderBy: {
          fecha: "asc",
        },
      });

      console.log(`\n   📊 Movimientos de saldo (${movimientos.length}):`);

      if (movimientos.length === 0) {
        console.log(`   ⚠️  NO HAY MOVIMIENTOS DE SALDO REGISTRADOS`);
      }

      for (const m of movimientos) {
        console.log(`\n   ├─ Movimiento ID: ${m.id}`);
        console.log(`   │  Punto: ${m.puntoAtencion?.nombre}`);
        console.log(`   │  Tipo: ${m.tipo_movimiento}`);
        console.log(`   │  Monto: ${m.monto}`);
        console.log(`   │  Saldo Anterior: ${m.saldo_anterior}`);
        console.log(`   │  Saldo Nuevo: ${m.saldo_nuevo}`);
        console.log(`   │  Fecha: ${m.fecha.toISOString()}`);
        console.log(`   │  Descripción: ${m.descripcion || "N/A"}`);
      }

      // 5. Verificar si hay duplicación
      const movimientosOrigen = movimientos.filter(
        (m) =>
          m.punto_atencion_id === boveda.id && m.tipo_movimiento === "EGRESO"
      );
      const movimientosDestino = movimientos.filter(
        (m) =>
          m.punto_atencion_id !== boveda.id && m.tipo_movimiento === "INGRESO"
      );

      console.log(`\n   🔍 Análisis de duplicación:`);
      console.log(
        `   │  Movimientos EGRESO en origen (BOVEDA): ${movimientosOrigen.length}`
      );
      console.log(
        `   │  Movimientos INGRESO en destino: ${movimientosDestino.length}`
      );

      if (movimientosOrigen.length > 1) {
        console.log(
          `   │  ⚠️  POSIBLE DUPLICACIÓN EN ORIGEN - Se esperaba 1, se encontraron ${movimientosOrigen.length}`
        );
      }

      if (movimientosDestino.length > 1) {
        console.log(
          `   │  ⚠️  POSIBLE DUPLICACIÓN EN DESTINO - Se esperaba 1, se encontraron ${movimientosDestino.length}`
        );
      }

      // 6. Buscar movimientos operacionales
      const movimientosOperacionales = await prisma.movimiento.findMany({
        where: {
          numero_recibo: t.numero_recibo,
        },
        include: {
          puntoAtencion: { select: { nombre: true } },
          moneda: { select: { codigo: true } },
        },
      });

      console.log(
        `\n   📝 Movimientos operacionales (${movimientosOperacionales.length}):`
      );
      for (const mo of movimientosOperacionales) {
        console.log(`   │  Punto: ${mo.puntoAtencion?.nombre}`);
        console.log(`   │  Tipo: ${mo.tipo}`);
        console.log(`   │  Monto: ${mo.monto}`);
        console.log(`   │  Descripción: ${mo.descripcion || "N/A"}`);
      }
    }

    // 7. Verificar saldo actual de BOVEDA en EUR
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💰 Saldo actual de BOVEDA en EUR:\n`);

    const saldoBoveda = await prisma.saldo.findUnique({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: boveda.id,
          moneda_id: eur.id,
        },
      },
    });

    if (saldoBoveda) {
      console.log(`   Efectivo (cantidad): ${saldoBoveda.cantidad}`);
      console.log(`   Banco: ${saldoBoveda.bancos}`);
      console.log(`   Billetes: ${saldoBoveda.billetes}`);
      console.log(`   Monedas físicas: ${saldoBoveda.monedas_fisicas}`);
    } else {
      console.log(`   ⚠️  No hay registro de saldo para BOVEDA en EUR`);
    }

    // 8. Calcular saldo esperado basado en movimientos
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧮 Verificación de consistencia de saldos:\n`);

    const todosMovimientos = await prisma.movimientoSaldo.findMany({
      where: {
        punto_atencion_id: boveda.id,
        moneda_id: eur.id,
      },
      orderBy: {
        fecha: "asc",
      },
    });

    console.log(
      `   Total de movimientos en BOVEDA-EUR: ${todosMovimientos.length}`
    );

    if (todosMovimientos.length > 0) {
      const ultimoMovimiento = todosMovimientos[todosMovimientos.length - 1];
      console.log(
        `   Último saldo registrado en movimientos: ${ultimoMovimiento.saldo_nuevo}`
      );

      if (saldoBoveda) {
        const diferencia =
          Number(saldoBoveda.cantidad) - Number(ultimoMovimiento.saldo_nuevo);
        console.log(`   Saldo actual en tabla saldo: ${saldoBoveda.cantidad}`);
        console.log(`   Diferencia: ${diferencia}`);

        if (Math.abs(diferencia) > 0.01) {
          console.log(
            `   ⚠️  INCONSISTENCIA DETECTADA - Los saldos no coinciden`
          );
        } else {
          console.log(`   ✅ Saldos consistentes`);
        }
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`✅ Diagnóstico completado\n`);
  } catch (error) {
    console.error("❌ Error durante el diagnóstico:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar diagnóstico
diagnosticarTransferencias();
