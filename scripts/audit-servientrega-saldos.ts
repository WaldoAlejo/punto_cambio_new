/**
 * Auditoría completa de saldos Servientrega por punto de atención
 * Revisa:
 * 1. Guías sin movimiento EGRESO
 * 2. Saldo actual vs saldo teórico (basado en movimientos)
 * 3. Puntos sin saldo asignado
 * 4. Discrepancias en el desglose físico
 */

import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 AUDITORÍA COMPLETA DE SALDOS SERVIENTREGA\n");

  // Obtener todos los puntos con Servientrega configurado
  const puntos = await prisma.puntoAtencion.findMany({
    where: {
      OR: [
        { servientrega_agencia_codigo: { not: null } },
        { servientrega_agencia_nombre: { not: null } },
      ],
    },
    select: {
      id: true,
      nombre: true,
      servientrega_agencia_codigo: true,
      servientrega_agencia_nombre: true,
    },
    orderBy: { nombre: "asc" },
  });

  console.log(`📍 Puntos con Servientrega configurado: ${puntos.length}\n`);

  const usdMoneda = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });

  if (!usdMoneda) {
    console.error("❌ Moneda USD no encontrada");
    process.exit(1);
  }

  for (const punto of puntos) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📍 ${punto.nombre}`);
    console.log(`   ID: ${punto.id}`);
    console.log(`   Agencia: ${punto.servientrega_agencia_nombre || "N/A"}`);

    // 1. Saldo actual en ServicioExternoSaldo
    const saldoActual = await prisma.servicioExternoSaldo.findUnique({
      where: {
        punto_atencion_id_servicio_moneda_id: {
          punto_atencion_id: punto.id,
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: usdMoneda.id,
        },
      },
    });

    if (!saldoActual) {
      console.log(`   ⚠️  NO TIENE SALDO ASIGNADO EN ServicioExternoSaldo`);
    } else {
      const cantidad = Number(saldoActual.cantidad);
      const billetes = Number(saldoActual.billetes);
      const monedas = Number(saldoActual.monedas_fisicas);
      const bancos = Number(saldoActual.bancos);
      const efectivoDesglosado = billetes + monedas;
      const efectivoTotal = Math.max(0, cantidad - bancos);
      const desincronizado = Math.abs(efectivoDesglosado - efectivoTotal) > 0.01;

      console.log(`   💰 Saldo actual:`);
      console.log(`      cantidad:  $${cantidad.toFixed(2)}`);
      console.log(`      billetes:  $${billetes.toFixed(2)}`);
      console.log(`      monedas:   $${monedas.toFixed(2)}`);
      console.log(`      bancos:    $${bancos.toFixed(2)}`);
      console.log(`      efectivo:  $${efectivoTotal.toFixed(2)}`);
      if (desincronizado) {
        console.log(`      🚨 DESGLOSE DESINCRONIZADO: billetes+monedas=$${efectivoDesglosado.toFixed(2)} vs efectivo=$${efectivoTotal.toFixed(2)}`);
      }
    }

    // 2. Saldo teórico basado en movimientos
    const movimientos = await prisma.servicioExternoMovimiento.aggregate({
      where: {
        punto_atencion_id: punto.id,
        servicio: ServicioExterno.SERVIENTREGA,
      },
      _sum: {
        monto: true,
      },
    });

    // 3. Guías sin EGRESO
    const guiasSinMovimiento = await prisma.$queryRaw<Array<{
      numero_guia: string;
      costo_envio: number;
      created_at: Date;
    }>>`
      SELECT 
        g.numero_guia,
        g.costo_envio,
        g.created_at
      FROM "ServientregaGuia" g
      LEFT JOIN "ServicioExternoMovimiento" m 
        ON g.numero_guia = m.numero_referencia 
        AND m.servicio = 'SERVIENTREGA'
        AND m.tipo_movimiento = 'EGRESO'
      WHERE g.punto_atencion_id = ${punto.id}
      AND g.estado = 'ACTIVA'
      AND m.numero_referencia IS NULL
      AND g.costo_envio > 0
      ORDER BY g.created_at ASC;
    `;

    if (guiasSinMovimiento.length > 0) {
      const totalPerdido = guiasSinMovimiento.reduce((sum, g) => sum + Number(g.costo_envio), 0);
      console.log(`   🚨 Guías sin EGRESO: ${guiasSinMovimiento.length} (total: $${totalPerdido.toFixed(2)})`);
      for (const g of guiasSinMovimiento) {
        console.log(`      - ${g.numero_guia}: $${Number(g.costo_envio).toFixed(2)} (${g.created_at.toISOString().split("T")[0]})`);
      }
    } else {
      console.log(`   ✅ Todas las guías tienen movimiento EGRESO`);
    }

    // 4. Movimientos recientes (últimos 5)
    const movimientosRecientes = await prisma.servicioExternoMovimiento.findMany({
      where: {
        punto_atencion_id: punto.id,
        servicio: ServicioExterno.SERVIENTREGA,
      },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        tipo_movimiento: true,
        monto: true,
        numero_referencia: true,
        descripcion: true,
        fecha: true,
      },
    });

    if (movimientosRecientes.length > 0) {
      console.log(`   📋 Movimientos recientes:`);
      for (const m of movimientosRecientes) {
        const signo = m.tipo_movimiento === "EGRESO" ? "-" : "+";
        console.log(`      ${signo}$${Number(m.monto).toFixed(2)} ${m.tipo_movimiento} | ${m.numero_referencia || "N/A"} | ${m.descripcion?.substring(0, 40)}...`);
      }
    }

    // 5. Verificar saldo legacy (ServientregaSaldo)
    const saldoLegacy = await prisma.servientregaSaldo.findUnique({
      where: { punto_atencion_id: punto.id },
    });

    if (saldoLegacy) {
      console.log(`   📦 Saldo LEGACY existe: monto_total=$${Number(saldoLegacy.monto_total).toFixed(2)}, monto_usado=$${Number(saldoLegacy.monto_usado).toFixed(2)}`);
    }
  }

  // Resumen global
  console.log(`\n${"=".repeat(70)}`);
  console.log("📊 RESUMEN GLOBAL");
  console.log("=".repeat(70));

  const totalGuiasSinMovimiento = await prisma.$queryRaw<Array<{ count: bigint; total: number }>>`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(g.costo_envio), 0) as total
    FROM "ServientregaGuia" g
    LEFT JOIN "ServicioExternoMovimiento" m 
      ON g.numero_guia = m.numero_referencia 
      AND m.servicio = 'SERVIENTREGA'
      AND m.tipo_movimiento = 'EGRESO'
    WHERE g.estado = 'ACTIVA'
    AND m.numero_referencia IS NULL
    AND g.costo_envio > 0;
  `;

  console.log(`Total guías sin EGRESO (todos los puntos): ${totalGuiasSinMovimiento[0].count}`);
  console.log(`Total no descontado: $${Number(totalGuiasSinMovimiento[0].total).toFixed(2)}`);

  const puntosSinSaldo = await prisma.puntoAtencion.count({
    where: {
      OR: [
        { servientrega_agencia_codigo: { not: null } },
        { servientrega_agencia_nombre: { not: null } },
      ],
      NOT: {
        servicioExternoSaldo: {
          some: {
            servicio: ServicioExterno.SERVIENTREGA,
            moneda_id: usdMoneda.id,
          },
        },
      },
    },
  });

  console.log(`Puntos con Servientrega configurado pero SIN saldo: ${puntosSinSaldo}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
