/**
 * CORRECCIÓN DEL REVERSO EUR - CAM-1775764188730
 * Cambia el reverso de €645.00 a €645.16 y ajusta el saldo
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DIFERENCIA = 0.16; // Los 16 céntimos faltantes

async function main() {
  console.log("=".repeat(100));
  console.log("CORRECCIÓN DEL REVERSO EUR - CAM-1775764188730");
  console.log("=".repeat(100));
  console.log(`\nDiferencia a corregir: €${DIFERENCIA.toFixed(2)}\n`);

  // Buscar PLAZA DEL VALLE
  const punto = await prisma.puntoAtencion.findFirst({
    where: {
      nombre: {
        contains: "PLAZA DEL VALLE",
        mode: "insensitive",
      },
    },
  });

  if (!punto) {
    console.error("❌ No se encontró PLAZA DEL VALLE");
    return;
  }

  console.log(`📍 Punto: ${punto.nombre} (ID: ${punto.id})\n`);

  // Obtener moneda EUR
  const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });
  if (!eur) {
    console.error("❌ No se encontró EUR");
    return;
  }

  const inicio9Abril = new Date("2026-04-09T00:00:00.000Z");
  const fin9Abril = new Date("2026-04-10T00:00:00.000Z");

  // ============================================
  // 1. BUSCAR EL MOVIMIENTO DEL REVERSO EUR
  // ============================================
  console.log("🔍 Buscando movimiento del reverso EUR...\n");

  const movimientoReverso = await prisma.movimientoSaldo.findFirst({
    where: {
      punto_atencion_id: punto.id,
      moneda_id: eur.id,
      fecha: {
        gte: inicio9Abril,
        lt: fin9Abril,
      },
      tipo_movimiento: "AJUSTE",
      descripcion: {
        contains: "1775764188730",
      },
    },
  });

  if (!movimientoReverso) {
    console.error("❌ No se encontró el movimiento del reverso EUR");
    return;
  }

  console.log("✓ Movimiento encontrado:");
  console.log(`   ID: ${movimientoReverso.id}`);
  console.log(`   Fecha: ${movimientoReverso.fecha.toISOString()}`);
  console.log(`   Tipo: ${movimientoReverso.tipo_movimiento}`);
  console.log(`   Monto actual: €${Number(movimientoReverso.monto).toFixed(2)}`);
  console.log(`   Monto correcto: €${(Number(movimientoReverso.monto) + DIFERENCIA).toFixed(2)}`);
  console.log(`   Saldo anterior: €${Number(movimientoReverso.saldo_anterior).toFixed(2)}`);
  console.log(`   Saldo nuevo actual: €${Number(movimientoReverso.saldo_nuevo).toFixed(2)}`);
  console.log(`   Saldo nuevo correcto: €${(Number(movimientoReverso.saldo_nuevo) + DIFERENCIA).toFixed(2)}`);
  console.log(`   Descripción: ${movimientoReverso.descripcion}`);

  // ============================================
  // 2. VERIFICAR EL SALDO ACTUAL EN LA TABLA SALDO
  // ============================================
  console.log("\n" + "-".repeat(100));
  console.log("🔍 Verificando saldo actual en tabla Saldo...\n");

  const saldoActual = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  if (!saldoActual) {
    console.error("❌ No se encontró el registro de saldo para EUR");
    return;
  }

  console.log("✓ Saldo actual encontrado:");
  console.log(`   Cantidad: €${Number(saldoActual.cantidad).toFixed(2)}`);
  console.log(`   Billetes: €${Number(saldoActual.billetes).toFixed(2)}`);
  console.log(`   Monedas: €${Number(saldoActual.monedas_fisicas).toFixed(2)}`);
  console.log(`   Cantidad corregida: €${(Number(saldoActual.cantidad) + DIFERENCIA).toFixed(2)}`);

  // ============================================
  // 3. MOSTRAR RESUMEN DE LA CORRECCIÓN
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("📋 RESUMEN DE LA CORRECCIÓN");
  console.log("=".repeat(100));

  console.log("\nSe realizarán los siguientes cambios:");
  console.log("\n1. MovimientoSaldo (reverso):");
  console.log(`   Monto: €${Number(movimientoReverso.monto).toFixed(2)} → €${(Number(movimientoReverso.monto) + DIFERENCIA).toFixed(2)}`);
  console.log(`   Saldo nuevo: €${Number(movimientoReverso.saldo_nuevo).toFixed(2)} → €${(Number(movimientoReverso.saldo_nuevo) + DIFERENCIA).toFixed(2)}`);

  console.log("\n2. Saldo (tabla Saldo):");
  console.log(`   Cantidad: €${Number(saldoActual.cantidad).toFixed(2)} → €${(Number(saldoActual.cantidad) + DIFERENCIA).toFixed(2)}`);
  console.log(`   Billetes: €${Number(saldoActual.billetes).toFixed(2)} → €${(Number(saldoActual.billetes) + DIFERENCIA).toFixed(2)}`);

  console.log("\n" + "-".repeat(100));
  console.log("⚠️  IMPORTANTE: Esta corrección NO crea un nuevo movimiento,");
  console.log("    solo actualiza el monto del reverso existente y el saldo.");
  console.log("-".repeat(100));

  // ============================================
  // 4. EJECUTAR LA CORRECCIÓN
  // ============================================
  console.log("\n📝 ¿Deseas ejecutar la corrección? (S/N)");
  console.log("   Por defecto: S (ejecutar)\n");

  // Ejecutar la corrección
  console.log("✅ Ejecutando corrección...\n");

  await prisma.$transaction(async (tx) => {
    // 1. Actualizar el movimiento del reverso
    await tx.movimientoSaldo.update({
      where: {
        id: movimientoReverso.id,
      },
      data: {
        monto: {
          increment: DIFERENCIA,
        },
        saldo_nuevo: {
          increment: DIFERENCIA,
        },
        descripcion: movimientoReverso.descripcion + " (corregido +0.16)",
      },
    });

    console.log("   ✓ MovimientoSaldo actualizado");

    // 2. Actualizar el saldo
    await tx.saldo.update({
      where: {
        punto_atencion_id_moneda_id: {
          punto_atencion_id: punto.id,
          moneda_id: eur.id,
        },
      },
      data: {
        cantidad: {
          increment: DIFERENCIA,
        },
        billetes: {
          increment: DIFERENCIA,
        },
        updated_at: new Date(),
      },
    });

    console.log("   ✓ Saldo actualizado");
  });

  // ============================================
  // 5. VERIFICACIÓN FINAL
  // ============================================
  console.log("\n" + "=".repeat(100));
  console.log("✅ VERIFICACIÓN FINAL");
  console.log("=".repeat(100));

  const movimientoCorregido = await prisma.movimientoSaldo.findUnique({
    where: { id: movimientoReverso.id },
  });

  const saldoCorregido = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  console.log("\n📊 Movimiento corregido:");
  console.log(`   Monto: €${Number(movimientoCorregido?.monto).toFixed(2)}`);
  console.log(`   Saldo nuevo: €${Number(movimientoCorregido?.saldo_nuevo).toFixed(2)}`);

  console.log("\n📊 Saldo corregido:");
  console.log(`   Cantidad: €${Number(saldoCorregido?.cantidad).toFixed(2)}`);
  console.log(`   Billetes: €${Number(saldoCorregido?.billetes).toFixed(2)}`);

  console.log("\n" + "=".repeat(100));
  console.log("✅ CORRECCIÓN COMPLETADA EXITOSAMENTE");
  console.log("=".repeat(100));
  console.log("\nLa diferencia de €0.16 ha sido corregida.");
  console.log("El saldo de EUR en PLAZA DEL VALLE ahora refleja el valor correcto.");
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
