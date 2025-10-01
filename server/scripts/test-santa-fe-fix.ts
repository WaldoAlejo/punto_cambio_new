import { PrismaClient } from "@prisma/client";
import { saldoReconciliationService } from "../services/saldoReconciliationService.js";

const prisma = new PrismaClient();

async function testSantaFeFix() {
  console.log("🧪 Probando cálculo corregido para SANTA FE - USD...\n");

  const santaFe = await prisma.puntoAtencion.findFirst({
    where: { nombre: "SANTA FE" },
  });
  const usd = await prisma.moneda.findFirst({
    where: { codigo: "USD" },
  });

  if (!santaFe || !usd) {
    console.log("❌ No se encontró SANTA FE o USD");
    return;
  }

  // Saldo actual en BD
  const saldoActual = await prisma.saldo.findFirst({
    where: {
      punto_atencion_id: santaFe.id,
      moneda_id: usd.id,
    },
  });

  console.log(
    `📊 Saldo actual en BD: ${saldoActual?.cantidad || "No encontrado"}`
  );

  // Calcular saldo correcto con la lógica corregida
  const saldoCalculado = await saldoReconciliationService.calcularSaldoReal(
    santaFe.id,
    usd.id
  );
  console.log(`📊 Saldo calculado: ${saldoCalculado}`);

  const diferencia = Number(saldoActual?.cantidad || 0) - saldoCalculado;
  console.log(`📊 Diferencia: ${diferencia}`);

  if (Math.abs(diferencia) > 0.01) {
    console.log("❌ Saldo necesita corrección");

    // Aplicar corrección
    console.log("\n🔧 Aplicando corrección...");
    const resultado = await saldoReconciliationService.reconciliarSaldo(
      santaFe.id,
      usd.id
    );

    if (resultado.corregido) {
      console.log(
        `✅ Saldo corregido de ${resultado.saldoAnterior} a ${resultado.saldoCalculado}`
      );
    } else {
      console.log("❌ No se pudo corregir el saldo");
    }
  } else {
    console.log("✅ Saldo está correcto");
  }
}

testSantaFeFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
