/**
 * Script para migrar el saldo de Servientrega de 'cantidad' a 'billetes'
 * Esto es necesario porque ahora el saldo debe estar en efectivo (billetes)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrarSaldoServientrega() {
  console.log("🔄 Iniciando migración de saldo Servientrega a efectivo...");

  try {
    // Obtener todos los saldos de Servientrega
    const saldos = await prisma.servicioExternoSaldo.findMany({
      where: {
        servicio: "SERVIENTREGA",
      },
    });

    console.log(`📊 Encontrados ${saldos.length} registros de saldo Servientrega`);

    for (const saldo of saldos) {
      const cantidad = Number(saldo.cantidad || 0);
      const billetes = Number(saldo.billetes || 0);
      const monedas = Number(saldo.monedas_fisicas || 0);

      // Si hay saldo en cantidad pero no en billetes, migrarlo
      if (cantidad > 0 && billetes === 0 && monedas === 0) {
        console.log(`🔄 Migrando saldo para punto ${saldo.punto_atencion_id}:`);
        console.log(`   Cantidad: $${cantidad} -> Billetes: $${cantidad}`);

        await prisma.servicioExternoSaldo.update({
          where: { id: saldo.id },
          data: {
            billetes: cantidad,
            monedas_fisicas: 0,
            // cantidad se mantiene igual (es el total)
          },
        });

        console.log(`   ✅ Migrado exitosamente`);
      } else {
        console.log(`⏭️  Saltando punto ${saldo.punto_atencion_id}:`);
        console.log(`   Cantidad: $${cantidad}, Billetes: $${billetes}, Monedas: $${monedas}`);
      }
    }

    console.log("\n✅ Migración completada");
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrarSaldoServientrega()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
