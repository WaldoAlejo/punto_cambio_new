/**
 * Script para corregir el saldo de Servientrega del punto EL BOSQUE
 * El campo cantidad muestra $4.92 pero debería ser $5.92 (billetes $5.00 + monedas $0.92)
 * 
 * Ejecutar: npx tsx scripts/fix-saldo-servientrega-bosque.ts
 */
import prisma from "../server/lib/prisma.js";
import { ServicioExterno } from "@prisma/client";

async function fixSaldo() {
  console.log("🔧 Corrigiendo saldo de Servientrega del punto EL BOSQUE...\n");

  const PUNTO_ID = "3f13bb4e-181b-4026-b1bf-4ae00f1d1391";
  
  // Obtener ID de USD
  const usd = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });

  if (!usd) {
    console.error("❌ No se encontró la moneda USD");
    process.exit(1);
  }

  const usdId = usd.id;

  // Buscar saldo actual
  const saldoActual = await prisma.servicioExternoSaldo.findUnique({
    where: {
      punto_atencion_id_servicio_moneda_id: {
        punto_atencion_id: PUNTO_ID,
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: usdId,
      },
    },
  });

  if (!saldoActual) {
    console.error("❌ No se encontró saldo de Servientrega para el punto EL BOSQUE");
    process.exit(1);
  }

  console.log("📊 Saldo actual:");
  console.log(`   - cantidad: $${saldoActual.cantidad}`);
  console.log(`   - billetes: $${saldoActual.billetes}`);
  console.log(`   - monedas_fisicas: $${saldoActual.monedas_fisicas}`);
  console.log(`   - bancos: $${saldoActual.bancos || 0}`);

  // Calcular saldo correcto
  const billetes = Number(saldoActual.billetes || 0);
  const monedas = Number(saldoActual.monedas_fisicas || 0);
  const bancos = Number(saldoActual.bancos || 0);
  const saldoCorrecto = billetes + monedas + bancos;

  console.log(`\n📊 Saldo calculado (billetes + monedas + bancos): $${saldoCorrecto.toFixed(2)}`);

  if (Number(saldoActual.cantidad) === saldoCorrecto) {
    console.log("\n✅ El saldo ya está correcto. No se necesita corrección.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n⚠️  Inconsistencia detectada:`);
  console.log(`   - cantidad actual: $${saldoActual.cantidad}`);
  console.log(`   - cantidad correcta: $${saldoCorrecto.toFixed(2)}`);
  console.log(`   - diferencia: $${(saldoCorrecto - Number(saldoActual.cantidad)).toFixed(2)}`);

  // Actualizar saldo
  const actualizado = await prisma.servicioExternoSaldo.update({
    where: { id: saldoActual.id },
    data: {
      cantidad: saldoCorrecto,
      updated_at: new Date(),
    },
  });

  console.log(`\n✅ Saldo corregido:`);
  console.log(`   - cantidad anterior: $${saldoActual.cantidad}`);
  console.log(`   - cantidad nueva: $${actualizado.cantidad}`);
  console.log(`   - billetes: $${actualizado.billetes}`);
  console.log(`   - monedas: $${actualizado.monedas_fisicas}`);
  console.log(`   - bancos: $${actualizado.bancos || 0}`);

  await prisma.$disconnect();
}

fixSaldo().catch((e) => {
  console.error(e);
  process.exit(1);
});
