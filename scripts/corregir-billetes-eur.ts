/**
 * CORRECCIÓN DE BILLETES EUR
 * Sincroniza billetes + monedas = cantidad
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(100));
  console.log("CORRECCIÓN DE BILLETES EUR");
  console.log("=".repeat(100));
  console.log("\nSincronizando billetes + monedas = cantidad\n");

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

  console.log(`📍 Punto: ${punto.nombre}\n`);

  const eur = await prisma.moneda.findFirst({ where: { codigo: "EUR" } });
  if (!eur) {
    console.error("❌ No se encontró EUR");
    return;
  }

  // Obtener saldo actual
  const saldo = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  if (!saldo) {
    console.error("❌ No se encontró saldo EUR");
    return;
  }

  const cantidad = Number(saldo.cantidad);
  const billetes = Number(saldo.billetes);
  const monedas = Number(saldo.monedas_fisicas);

  console.log("📊 Saldos actuales:");
  console.log(`   cantidad: €${cantidad.toFixed(2)}`);
  console.log(`   billetes: €${billetes.toFixed(2)}`);
  console.log(`   monedas: €${monedas.toFixed(2)}`);
  console.log(`   billetes + monedas: €${(billetes + monedas).toFixed(2)}`);
  console.log(`   diferencia: €${(cantidad - billetes - monedas).toFixed(2)}`);

  // Calcular nuevo valor de billetes
  const nuevoBilletes = cantidad - monedas;

  console.log("\n📋 Cambio a realizar:");
  console.log(`   billetes: €${billetes.toFixed(2)} → €${nuevoBilletes.toFixed(2)}`);

  // Ejecutar corrección
  console.log("\n✅ Ejecutando corrección...\n");

  await prisma.saldo.update({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
    data: {
      billetes: nuevoBilletes,
      updated_at: new Date(),
    },
  });

  // Verificar
  const saldoCorregido = await prisma.saldo.findUnique({
    where: {
      punto_atencion_id_moneda_id: {
        punto_atencion_id: punto.id,
        moneda_id: eur.id,
      },
    },
  });

  console.log("📊 Saldos corregidos:");
  console.log(`   cantidad: €${Number(saldoCorregido?.cantidad).toFixed(2)}`);
  console.log(`   billetes: €${Number(saldoCorregido?.billetes).toFixed(2)}`);
  console.log(`   monedas: €${Number(saldoCorregido?.monedas_fisicas).toFixed(2)}`);
  console.log(`   billetes + monedas: €${(Number(saldoCorregido?.billetes) + Number(saldoCorregido?.monedas_fisicas)).toFixed(2)}`);

  const disponible = Number(saldoCorregido?.billetes) + Number(saldoCorregido?.monedas_fisicas);
  console.log(`\n✅ Saldo disponible para transacciones: €${disponible.toFixed(2)}`);
  console.log(`   (Ahora el operador puede hacer el cambio de €645.16)`);

  console.log("\n" + "=".repeat(100));
  console.log("✅ CORRECCIÓN COMPLETADA");
  console.log("=".repeat(100));
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
