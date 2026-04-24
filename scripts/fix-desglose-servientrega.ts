/**
 * Script para corregir el desglose físico (billetes/monedas) de ServicioExternoSaldo
 * cuando queda desincronizado con la cantidad total.
 * 
 * Uso: npx tsx scripts/fix-desglose-servientrega.ts <punto_atencion_id>
 */

import { PrismaClient, ServicioExterno } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const puntoAtencionId = process.argv[2];

  if (!puntoAtencionId) {
    console.error("❌ Uso: npx tsx scripts/fix-desglose-servientrega.ts <punto_atencion_id>");
    process.exit(1);
  }

  console.log(`🔧 Corrigiendo desglose para punto: ${puntoAtencionId}`);

  const usdId = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });

  if (!usdId) {
    console.error("❌ Moneda USD no encontrada");
    process.exit(1);
  }

  const saldo = await prisma.servicioExternoSaldo.findUnique({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: puntoAtencionId,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: usdId.id,
      },
    },
  });

  if (!saldo) {
    console.error("❌ No se encontró saldo para este punto");
    process.exit(1);
  }

  const cantidad = Number(saldo.cantidad);
  const bancos = Number(saldo.bancos);
  const efectivoTotal = Math.max(0, cantidad - bancos);
  const billetes = Number(saldo.billetes);
  const monedas = Number(saldo.monedas_fisicas);
  const efectivoDesglosado = billetes + monedas;

  console.log(`\n📊 Estado actual:`);
  console.log(`   cantidad:  $${cantidad.toFixed(2)}`);
  console.log(`   bancos:    $${bancos.toFixed(2)}`);
  console.log(`   billetes:  $${billetes.toFixed(2)}`);
  console.log(`   monedas:   $${monedas.toFixed(2)}`);
  console.log(`   efectivo esperado: $${efectivoTotal.toFixed(2)}`);
  console.log(`   efectivo desglosado: $${efectivoDesglosado.toFixed(2)}`);

  const desincronizado = Math.abs(efectivoDesglosado - efectivoTotal) > 0.01;

  if (!desincronizado) {
    console.log(`\n✅ El desglose está correcto. No se requiere corrección.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n🚨 DESGLOSE DESINCRONIZADO detectado`);
  console.log(`   Diferencia: $${Math.abs(efectivoDesglosado - efectivoTotal).toFixed(2)}`);

  // Corregir: poner todo el efectivo como billetes (asumimos que no hay monedas)
  const nuevoBilletes = efectivoTotal;
  const nuevoMonedas = 0;

  console.log(`\n🔧 Corrección propuesta:`);
  console.log(`   billetes: $${nuevoBilletes.toFixed(2)}`);
  console.log(`   monedas:  $${nuevoMonedas.toFixed(2)}`);

  await prisma.servicioExternoSaldo.update({
    where: { id: saldo.id },
    data: {
      billetes: nuevoBilletes,
      monedas_fisicas: nuevoMonedas,
      updated_at: new Date(),
    },
  });

  console.log(`\n✅ Desglose corregido exitosamente`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
